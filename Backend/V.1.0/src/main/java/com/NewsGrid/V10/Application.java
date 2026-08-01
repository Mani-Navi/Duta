package com.NewsGrid.V10;

import jakarta.annotation.PostConstruct;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.util.TimeZone;

@SpringBootApplication(scanBasePackages = "com.NewsGrid.V10")
@EnableScheduling
// OPTIMIZED: Enable Spring Async processing for background scraping & clustering tasks
@EnableAsync
public class Application {

	public static void main(String[] args) {
		SpringApplication.run(Application.class, args);
	}

	/**
	 * OPTIMIZED: Force system timezone to UTC to prevent timestamp mismatch issues
	 * across different cloud server locations and local environments.
	 */
	@PostConstruct
	public void init() {
		TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
	}
}