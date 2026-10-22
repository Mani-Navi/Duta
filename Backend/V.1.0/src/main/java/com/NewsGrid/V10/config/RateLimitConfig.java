package com.NewsGrid.V10.config;

import com.NewsGrid.V10.logging.DutaLogger;
import com.NewsGrid.V10.logging.LogEvent;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Lock-free IP rate limiter backed by Caffeine's O(1) Window TinyLFU cache.
 */
@Component
public class RateLimitConfig implements HandlerInterceptor {

    private static final DutaLogger logger = DutaLogger.of(RateLimitConfig.class);
    private static final int MAX_REQUESTS_PER_MINUTE = 120;

    private final Cache<String, AtomicInteger> ipRequestCounts = Caffeine.newBuilder()
            .maximumSize(10_000)
            .expireAfterWrite(1, TimeUnit.MINUTES)
            .build();

    @Override
    public boolean preHandle(HttpServletRequest request,
                             HttpServletResponse response,
                             Object handler) throws Exception {

        String path = request.getRequestURI();
        if (path != null && (path.endsWith("/sitemap.xml") || path.contains("/api/articles/seo/"))) {
            return true;
        }

        String ip = getClientIP(request);
        AtomicInteger counter = ipRequestCounts.get(ip, k -> new AtomicInteger(0));

        if (counter.incrementAndGet() > MAX_REQUESTS_PER_MINUTE) {
            logger.warn(LogEvent.RATE_LIMIT_EXCEEDED, "Client exceeded rate limit", "ip", ip, "path", path);
            response.setStatus(429);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"error\":\"تعداد درخواست‌های شما بیش از حد مجاز است. لطفاً یک دقیقه صبر کنید.\"}");
            return false;
        }

        return true;
    }

    private String getClientIP(HttpServletRequest request) {
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }
        String xfHeader = request.getHeader("X-Forwarded-For");
        if (xfHeader != null && !xfHeader.isBlank()) {
            return xfHeader.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}