package com.NewsGrid.V10.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Slf4j
@Component
public class RateLimitConfig implements HandlerInterceptor {

    private static final int MAX_REQUESTS = 60;
    private static final long TIME_WINDOW = 60_000L; // 1 minute
    private static final int MAX_MAP_SIZE = 3000;   // Safety ceiling for IP cache

    private final Map<String, AtomicInteger> requestCounts = new ConcurrentHashMap<>();
    private final Map<String, Long> windowStart = new ConcurrentHashMap<>();

    @Override
    public boolean preHandle(HttpServletRequest request,
                             HttpServletResponse response,
                             Object handler) throws Exception {

        String ip = getClientIP(request);
        long now = System.currentTimeMillis();

        // OPTIMIZED: Evict expired IP entries to prevent Unbounded Memory Leak
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
            response.setStatus(429);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"error\":\"تعداد درخواست‌های شما بیش از حد مجاز است. لطفاً یک دقیقه صبر کنید.\"}");
            return false;
        }

        return true;
    }

    private String getClientIP(HttpServletRequest request) {
        String xfHeader = request.getHeader("X-Forwarded-For");
        if (xfHeader == null || xfHeader.isEmpty()) {
            return request.getRemoteAddr();
        }
        return xfHeader.split(",")[0].trim();
    }

    private void cleanupExpiredIPs(long now) {
        windowStart.entrySet().removeIf(entry -> (now - entry.getValue()) > TIME_WINDOW);
        requestCounts.keySet().removeIf(ip -> !windowStart.containsKey(ip));
    }
}