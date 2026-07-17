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
    private static final long CACHE_SECONDS = 300; // 5 دقیقه

    private final RestTemplate restTemplate = new RestTemplate();

    public Map<String, Object> getPrices() {
        long secondsSince = Instant.now().getEpochSecond() - lastFetch.getEpochSecond();

        if (cachedPrices != null && secondsSince < CACHE_SECONDS) {
            return cachedPrices;
        }

        Map<String, Object> result = new HashMap<>();

        try {
            String html = fetchHtml("https://bonbast.com");
            String token = extractToken(html);

            if (token != null) {
                result = fetchPrices(token);
            }

            if (!result.isEmpty()) {
                cachedPrices = result;
                lastFetch = Instant.now();
                return cachedPrices;
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
        headers.set("Accept-Language", "fa,en;q=0.9");

        HttpEntity<Void> entity = new HttpEntity<>(headers);
        ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);
        return response.getBody();
    }

    private String extractToken(String html) {
        // bonbast توی HTML یه value داره به اسم pp که token هست
        String marker = "\"pp\":\"";
        int idx = html.indexOf(marker);
        if (idx == -1) {
            marker = "pp: '";
            idx = html.indexOf(marker);
            if (idx == -1) return null;
        }
        int start = idx + marker.length();
        int end = html.indexOf("\"", start);
        if (end == -1) end = html.indexOf("'", start);
        if (end == -1) return null;
        return html.substring(start, end);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> fetchPrices(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        headers.set("User-Agent", "Mozilla/5.0");
        headers.set("Referer", "https://bonbast.com/");
        headers.set("X-Requested-With", "XMLHttpRequest");

        String body = "pp=" + token;
        HttpEntity<String> entity = new HttpEntity<>(body, headers);

        ResponseEntity<Map> response = restTemplate.exchange(
                "https://bonbast.com/json",
                HttpMethod.POST,
                entity,
                Map.class
        );

        Map<String, Object> raw = response.getBody();
        if (raw == null) return new HashMap<>();

        return parseResponse(raw);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseResponse(Map<String, Object> raw) {
        Map<String, Object> result = new HashMap<>();

        addCurrency(result, raw, "usd",    "دلار",        "usd1");
        addCurrency(result, raw, "tether", "تتر",         "tether1");
        addCurrency(result, raw, "gold",   "طلا (۱۸ عیار)", "gol18");
        addCurrency(result, raw, "silver", "نقره",        "silver");

        result.put("updatedAt", Instant.now().toString());
        return result;
    }

    private void addCurrency(Map<String, Object> result, Map<String, Object> raw,
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