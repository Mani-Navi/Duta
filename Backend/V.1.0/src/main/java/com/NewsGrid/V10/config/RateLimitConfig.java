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
 * Lock-free dual-tier IP rate limiter backed by Caffeine's O(1) Window TinyLFU cache.
 * Enforces 120 req/min globally and a strict 10 req/min limit on /api/auth/* against Brute-Force attacks.
 */
@Component
public class RateLimitConfig implements HandlerInterceptor {

    private static final DutaLogger logger = DutaLogger.of(RateLimitConfig.class);
    private static final int MAX_REQUESTS_PER_MINUTE = 120;
    private static final int MAX_AUTH_REQUESTS_PER_MINUTE = 10;

    private final Cache<String, AtomicInteger> ipRequestCounts = Caffeine.newBuilder()
            .maximumSize(10_000)
            .expireAfterWrite(1, TimeUnit.MINUTES)
            .build();

    private final Cache<String, AtomicInteger> authIpRequestCounts = Caffeine.newBuilder()
            .maximumSize(5_000)
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

        // Strict tier for authentication endpoints (/api/auth/login, /register, /google)
        if (path != null && path.startsWith("/api/auth/")) {
            AtomicInteger authCounter = authIpRequestCounts.get(ip, k -> new AtomicInteger(0));
            if (authCounter.incrementAndGet() > MAX_AUTH_REQUESTS_PER_MINUTE) {
                logger.warn(LogEvent.RATE_LIMIT_EXCEEDED, "Client exceeded strict auth rate limit", "ip", ip, "path", path);
                writeRateLimitResponse(response, "تعداد تلاش‌های ورود بیش از حد مجاز است. لطفاً یک دقیقه صبر کنید.");
                return false;
            }
        }

        AtomicInteger counter = ipRequestCounts.get(ip, k -> new AtomicInteger(0));
        if (counter.incrementAndGet() > MAX_REQUESTS_PER_MINUTE) {
            logger.warn(LogEvent.RATE_LIMIT_EXCEEDED, "Client exceeded global rate limit", "ip", ip, "path", path);
            writeRateLimitResponse(response, "تعداد درخواست‌های شما بیش از حد مجاز است. لطفاً یک دقیقه صبر کنید.");
            return false;
        }

        return true;
    }

    private void writeRateLimitResponse(HttpServletResponse response, String message) throws Exception {
        response.setStatus(429);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"error\":\"" + message + "\"}");
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