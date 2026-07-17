package com.NewsGrid.V10.service;

import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.*;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@Service
public class PriceService {

    // کش قیمت‌ها — هر ۵ دقیقه رفرش میشه
    private Map<String, Object> cachedPrices = null;
    private Instant lastFetch = Instant.EPOCH;
    private static final long CACHE_SECONDS = 300; // 5 دقیقه

    private final RestTemplate restTemplate = new RestTemplate();

    // آدرس API — بدون نیاز به key
    private static final String API_URL =
            "https://api.accessban.com/v1/market/indicator";

    public Map<String, Object> getPrices() {
        long secondsSinceLastFetch = Instant.now().getEpochSecond() - lastFetch.getEpochSecond();

        if (cachedPrices != null && secondsSinceLastFetch < CACHE_SECONDS) {
            return cachedPrices;
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("User-Agent", "NewsGrid/1.0");
            HttpEntity<Void> entity = new HttpEntity<>(headers);

            ResponseEntity<Map> response = restTemplate.exchange(
                    API_URL,
                    HttpMethod.GET,
                    entity,
                    Map.class
            );

            Map<String, Object> raw = response.getBody();
            if (raw != null) {
                cachedPrices = parseResponse(raw);
                lastFetch = Instant.now();
                return cachedPrices;
            }

        } catch (Exception e) {
            // اگه API داون بود، کش قدیمی رو برگردون
            if (cachedPrices != null) return cachedPrices;
        }

        // fallback خالی
        return Map.of("error", "داده‌ای در دسترس نیست");
    }

    private Map<String, Object> parseResponse(Map<String, Object> raw) {
        Map<String, Object> result = new HashMap<>();

        // ساختار پاسخ accessban.com:
        // { "usd": { "price": "62500", ... }, "gold": { "price": "..." }, ... }
        String[] keys = {"usd", "gold", "silver", "tether"};
        String[] labels = {"دلار", "طلا", "نقره", "تتر"};
        String[] units = {"تومان", "تومان", "تومان", "تومان"};

        for (int i = 0; i < keys.length; i++) {
            Object item = raw.get(keys[i]);
            if (item instanceof Map itemMap) {
                Map<String, String> entry = new HashMap<>();
                Object priceVal = itemMap.get("price");
                String priceStr = priceVal != null ? priceVal.toString() : "—";
                entry.put("price", formatPrice(priceStr));
                entry.put("label", labels[i]);
                entry.put("unit", units[i]);
                result.put(keys[i], entry);
            }
        }

        result.put("updatedAt", Instant.now().toString());
        return result;
    }

    private String formatPrice(String raw) {
        try {
            long num = Long.parseLong(raw.replaceAll("[^0-9]", ""));
            // فرمت با جداکننده هزار
            return String.format("%,d", num);
        } catch (Exception e) {
            return raw;
        }
    }
}