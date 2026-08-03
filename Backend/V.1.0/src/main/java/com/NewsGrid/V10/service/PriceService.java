package com.NewsGrid.V10.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@Service
public class PriceService {

    private Map<String, Object> cachedPrices = null;
    private Instant lastFetch = Instant.EPOCH;
    private static final long CACHE_SECONDS = 300;

    private final RestTemplate restTemplate;

    public PriceService(RestTemplateBuilder builder) {
        this.restTemplate = builder
                .setConnectTimeout(Duration.ofSeconds(6))
                .setReadTimeout(Duration.ofSeconds(6))
                .build();
    }

    public synchronized Map<String, Object> getPrices() {
        long secondsSince = Instant.now().getEpochSecond() - lastFetch.getEpochSecond();
        if (cachedPrices != null && secondsSince < CACHE_SECONDS) {
            return cachedPrices;
        }

        try {
            Map<String, Object> result = fetchLivePricesFromTgju();
            if (!result.isEmpty()) {
                cachedPrices = result;
                lastFetch = Instant.now();
                return cachedPrices;
            }
        } catch (Exception e) {
            log.warn("PriceService live fetch error: {}", e.getMessage());
        }

        if (cachedPrices != null) {
            return cachedPrices;
        }

        return Map.of("error", "داده‌ای در دسترس نیست");
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> fetchLivePricesFromTgju() {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36");
            headers.set("Accept", "application/json, text/plain, */*");
            headers.set("Referer", "https://www.tgju.org/");

            // Official TGJU Live Market Feed
            String url = "https://call.tgju.org/ajax.json";
            ResponseEntity<Map> response = restTemplate.exchange(
                    url, HttpMethod.GET, new HttpEntity<>(headers), Map.class);

            Map<String, Object> raw = response.getBody();
            if (raw == null || raw.isEmpty()) return new HashMap<>();

            Map<String, Object> result = new HashMap<>();

            // Extract Live Dollar Price
            if (raw.containsKey("price_dollar_rl")) {
                Map<String, Object> dollarData = (Map<String, Object>) raw.get("price_dollar_rl");
                if (dollarData != null && dollarData.containsKey("p")) {
                    String rawPrice = dollarData.get("p").toString().replaceAll("[^0-9]", "");
                    long tomanPrice = Long.parseLong(rawPrice) / 10; // Convert Rial to Toman
                    Map<String, String> usd = new HashMap<>();
                    usd.put("price", String.format("%,d", tomanPrice));
                    usd.put("label", "دلار");
                    result.put("usd", usd);
                }
            }

            // Extract Live 18K Gold Price
            if (raw.containsKey("geram18")) {
                Map<String, Object> goldData = (Map<String, Object>) raw.get("geram18");
                if (goldData != null && goldData.containsKey("p")) {
                    String rawPrice = goldData.get("p").toString().replaceAll("[^0-9]", "");
                    long tomanPrice = Long.parseLong(rawPrice) / 10; // Convert Rial to Toman
                    Map<String, String> gold = new HashMap<>();
                    gold.put("price", String.format("%,d", tomanPrice));
                    gold.put("label", "طلا (۱۸ عیار)");
                    result.put("gold", gold);
                }
            }

            result.put("updatedAt", Instant.now().toString());
            return result;

        } catch (Exception e) {
            log.error("Failed to fetch live prices from TGJU: {}", e.getMessage());
            return new HashMap<>();
        }
    }
}