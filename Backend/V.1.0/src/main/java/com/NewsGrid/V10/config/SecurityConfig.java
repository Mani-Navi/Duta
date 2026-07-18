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
        registry.addMapping("/api/**")
                .allowedOriginPatterns(
                        "https://news-grid-pi.vercel.app",
                        "https://*.vercel.app",
                        "http://localhost:5173",
                        "http://localhost:4173"
                )
                .allowedMethods("GET")
                .allowedHeaders("Content-Type", "Accept", "X-Requested-With")
                .maxAge(3600);
    }

    @Bean
    public Filter securityHeadersFilter() {
        return new Filter() {
            @Override
            public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
                    throws IOException, ServletException {
                HttpServletResponse response = (HttpServletResponse) res;
                response.setHeader("X-Content-Type-Options", "nosniff");
                response.setHeader("X-Frame-Options", "DENY");
                response.setHeader("X-XSS-Protection", "1; mode=block");
                response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
                response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
                response.setHeader("Server", "");
                chain.doFilter(req, res);
            }
        };
    }
}