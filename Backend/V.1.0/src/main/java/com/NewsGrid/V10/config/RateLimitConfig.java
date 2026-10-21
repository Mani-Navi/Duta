package com.NewsGrid.V10.config;

import com.NewsGrid.V10.logging.DutaLogger;
import com.NewsGrid.V10.logging.LogEvent;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Component
public class RateLimitConfig implements HandlerInterceptor {

    private static final DutaLogger logger = DutaLogger.of(RateLimitConfig.class);

    private static final int MAX_REQUESTS = 120;    // 120 requests per minute for smooth browsing
    private static final long TIME_WINDOW = 60_000L; // 1 minute
    private static final int MAX_MAP_SIZE = 3000;

    private final Map<String, AtomicInteger> requestCounts = new ConcurrentHashMap<>();
    private final Map<String, Long> windowStart = new ConcurrentHashMap<>();

    @Override
    public boolean preHandle(HttpServletRequest request,
                             HttpServletResponse response,
                             Object handler) throws Exception {

        String path = request.getRequestURI();
        // Do not block SEO sitemap or crawler metadata endpoints
        if (path != null && (path.endsWith("/sitemap.xml") || path.contains("/api/articles/seo/"))) {
            return true;
        }

        String ip = getClientIP(request);
        long now = System.currentTimeMillis();

        if (requestCounts.size() > MAX_MAP_SIZE) {
            cleanupExpiredIPs(now);
        }

        windowStart.putIfAbsent(ip, now);
        requestCounts.putIfAbsent(ip, new AtomicInteger(0));

        if (now - windowStart.get(ip) > TIME_WINDOW) {
            windowStart.put(ip, now);
            requestCounts.get(ip).set(0);
        }

        int count = requestCounts.get(ip).incrementAndGet();

        if (count > MAX_REQUESTS) {
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

    private void cleanupExpiredIPs(long now) {
        windowStart.entrySet().removeIf(entry -> (now - entry.getValue()) > TIME_WINDOW);
        requestCounts.keySet().removeIf(ip -> !windowStart.containsKey(ip));
    }
}