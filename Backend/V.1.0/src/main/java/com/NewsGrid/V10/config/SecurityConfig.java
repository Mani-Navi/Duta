package com.NewsGrid.V10.config;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.io.IOException;

@Configuration
public class SecurityConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        // OPTIMIZED: Restrict CORS strictly to verified Vercel production and local dev domains
        registry.addMapping("/api/**")
                .allowedOriginPatterns(
                        "https://news-grid-pi.vercel.app",
                        "https://*.vercel.app",
                        "http://localhost:5173",
                        "http://localhost:4173"
                )
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .maxAge(3600);
    }

    @Bean
    public Filter securityHeadersFilter() {
        return new Filter() {
            @Override
            public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
                    throws IOException, ServletException {
                HttpServletResponse response = (HttpServletResponse) res;

                // 1. Anti-Clickjacking Protection
                response.setHeader("X-Frame-Options", "DENY");

                // 2. MIME Type Sniffing Prevention
                response.setHeader("X-Content-Type-Options", "nosniff");

                // 3. XSS Protection Filter
                response.setHeader("X-XSS-Protection", "1; mode=block");

                // 4. Strict Transport Security (HSTS - 1 Year)
                response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");

                // 5. Referrer Policy
                response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

                // 6. Content Security Policy (CSP - OWASP ZAP Compliant)
                response.setHeader("Content-Security-Policy",
                        "default-src 'self'; " +
                                "script-src 'self' 'unsafe-inline'; " +
                                "style-src 'self' 'unsafe-inline'; " +
                                "img-src 'self' data: https: http:; " +
                                "font-src 'self' data: https:; " +
                                "connect-src 'self' https://newsgrid-production-16cb.up.railway.app https://*.up.railway.app; " +
                                "frame-ancestors 'none';");

                // 7. Dynamic API Cache-Control (Prevent Stale Data Caching)
                response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
                response.setHeader("Pragma", "no-cache");

                chain.doFilter(req, res);
            }
        };
    }
}