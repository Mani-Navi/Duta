package com.NewsGrid.V10.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;

@Configuration
public class SecurityConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                // فقط دامنه‌های مجاز — wildcard * حذف شد
                .allowedOrigins(
                        "https://news-grid-pi.vercel.app",
                        "http://localhost:5173",
                        "http://localhost:4173"
                )
                .allowedMethods("GET")
                .allowedHeaders("Content-Type", "Accept", "X-Requested-With")
                .maxAge(3600);
    }

    // Security Headers روی همه response های Backend
    @Bean
    public Filter securityHeadersFilter() {
        return (ServletRequest req, ServletResponse res, FilterChain chain) -> {
            HttpServletResponse response = (HttpServletResponse) res;

            response.setHeader("X-Content-Type-Options", "nosniff");
            response.setHeader("X-Frame-Options", "DENY");
            response.setHeader("X-XSS-Protection", "1; mode=block");
            response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
            response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
            // حذف اطلاعات سرور
            response.setHeader("Server", "");

            chain.doFilter(req, res);
        };
    }
}