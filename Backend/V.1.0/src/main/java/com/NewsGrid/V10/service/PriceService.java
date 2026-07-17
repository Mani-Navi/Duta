package com.NewsGrid.V10.service;

import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.*;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@Service
public class PriceService {

    private Map<String, Object> cachedPrices = null;
    private Instant lastFetch = Instant.EPOCH;
    private static final long CACHE_SECONDS = 300;

    private final RestTemplate restTemplate = new RestTemplate();

    public Map<String, Object> getPrices() {
        long secondsSince = Instant.now().getEpochSecond() - lastFetch.getEpochSecond();
        if (cachedPrices != null && secondsSince < CACHE_SECONDS) {
            return cachedPrices;
        }

        try {
            // مرحله ۱: HTML بگیر و param رو استخراج کن
            String html = fetchHtml("https://bonbast.com");
            String param = extractParam(html);

            if (param != null) {
                // مرحله ۲: با param به /json پست کن
                Map<String, Object> result = fetchPrices(param);
                if (!result.isEmpty()) {
                    cachedPrices = result;
                    lastFetch = Instant.now();
                    return cachedPrices;
                }
            }
        } catch (Exception e) {
            System.err.println("PriceService error: " + e.getMessage());
        }

        if (cachedPrices != null) return cachedPrices;
        return Map.of("error", "داده‌ای در دسترس نیست");
    }

    private String fetchHtml(String url) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
        headers.set("Accept", "text/html,application/xhtml+xml");
        HttpEntity<Void> entity = new HttpEntity<>(headers);
        ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);
        return response.getBody();
    }

    private String extractParam(String html) {
        // دنبال: $.post('/json', {param: "VALUE"}
        String marker = "param: \"";
        int idx = html.indexOf(marker);
        if (idx == -1) {
            marker = "param:\"";
            idx = html.indexOf(marker);
        }
        if (idx == -1) return null;

        int start = idx + marker.length();
        int end = html.indexOf("\"", start);
        if (end == -1) return null;

        return html.substring(start, end);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> fetchPrices(String param) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        headers.set("User-Agent", "Mozilla/5.0");
        headers.set("Referer", "https://bonbast.com/");
        headers.set("X-Requested-With", "XMLHttpRequest");

        String body = "param=" + param;
        HttpEntity<String> entity = new HttpEntity<>(body, headers);

        ResponseEntity<Map> response = restTemplate.exchange(
                "https://bonbast.com/json",
                HttpMethod.POST,
                entity,
                Map.class
        );

        Map<String, Object> raw = response.getBody();
        if (raw == null || raw.containsKey("reset")) return new HashMap<>();

        return parseResponse(raw);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseResponse(Map<String, Object> raw) {
        Map<String, Object> result = new HashMap<>();

        addItem(result, raw, "usd",    "دلار",          "usd1");
        addItem(result, raw, "tether", "تتر",           "tether1");
        addItem(result, raw, "gold",   "طلا (۱۸ عیار)", "gol18");
        addItem(result, raw, "silver", "نقره",          "silver");

        result.put("updatedAt", Instant.now().toString());
        return result;
    }

    private void addItem(Map<String, Object> result, Map<String, Object> raw,
                         String key, String label, String rawKey) {
        Object val = raw.get(rawKey);
        if (val != null) {
            Map<String, String> entry = new HashMap<>();
            entry.put("price", formatPrice(val.toString()));
            entry.put("label", label);
            result.put(key, entry);
        }
    }

    private String formatPrice(String raw) {
        try {
            long num = Long.parseLong(raw.replaceAll("[^0-9]", ""));
            return String.format("%,d", num);
        } catch (Exception e) {
            return raw;
        }
    }
}