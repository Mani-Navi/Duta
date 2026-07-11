package com.NewsGrid.V10.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Component
public class RateLimitConfig implements HandlerInterceptor {

    // هر IP حداکثر ۶۰ request در دقیقه
    private static final int MAX_REQUESTS = 60;
    private static final long TIME_WINDOW = 60_000L;

    private final Map<String, AtomicInteger> requestCounts = new ConcurrentHashMap<>();
    private final Map<String, Long> windowStart = new ConcurrentHashMap<>();

    @Override
    public boolean preHandle(HttpServletRequest request,
                             HttpServletResponse response,
                             Object handler) throws Exception {

        String ip = request.getRemoteAddr();
        long now = System.currentTimeMillis();

        windowStart.putIfAbsent(ip, now);
        requestCounts.putIfAbsent(ip, new AtomicInteger(0));

        // اگه پنجره زمانی تموم شد، reset کن
        if (now - windowStart.get(ip) > TIME_WINDOW) {
            windowStart.put(ip, now);
            requestCounts.get(ip).set(0);
        }

        int count = requestCounts.get(ip).incrementAndGet();

        if (count > MAX_REQUESTS) {
            response.setStatus(429); // Too Many Requests
            response.getWriter().write("{\"error\":\"Too many requests\"}");
            return false;
        }

        return true;
    }
}