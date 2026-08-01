package com.NewsGrid.V10.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class PriceService {

    private Map<String, Object> cachedPrices = null;
    private Instant lastFetch = Instant.EPOCH;
    private static final long CACHE_SECONDS = 300;

    // OPTIMIZED: Reusable RestTemplate instance with 5s timeout to prevent Thread blocking
    private final RestTemplate restTemplate;

    public PriceService(RestTemplateBuilder builder) {
        this.restTemplate = builder
                .setConnectTimeout(Duration.ofSeconds(5))
                .setReadTimeout(Duration.ofSeconds(5))
                .build();
    }

    public synchronized Map<String, Object> getPrices() {
        long secondsSince = Instant.now().getEpochSecond() - lastFetch.getEpochSecond();
        if (cachedPrices != null && secondsSince < CACHE_SECONDS) {
            return cachedPrices;
        }

        try {
            Map<String, Object> result = fetchFromBonbast();
            if (!result.isEmpty()) {
                cachedPrices = result;
                lastFetch = Instant.now();
                return cachedPrices;
            }
        } catch (Exception e) {
            log.error("PriceService fetch error: {}", e.getMessage());
        }

        if (cachedPrices != null) return cachedPrices;
        return Map.of("error", "داده‌ای در دسترس نیست");
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> fetchFromBonbast() throws Exception {
        HttpHeaders h1 = new HttpHeaders();
        h1.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
        h1.set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
        h1.set("Accept-Language", "fa,en-US;q=0.7,en;q=0.3");

        ResponseEntity<String> mainResp = restTemplate.exchange(
                "https://bonbast.com", HttpMethod.GET, new HttpEntity<>(h1), String.class);

        String html = mainResp.getBody();

        List<String> setCookies = mainResp.getHeaders().get("Set-Cookie");
        StringBuilder cookieHeader = new StringBuilder();
        if (setCookies != null) {
            for (String c : setCookies) {
                if (cookieHeader.length() > 0) cookieHeader.append("; ");
                cookieHeader.append(c.split(";")[0]);
            }
        }

        String param = extractParam(html);
        if (param == null) return new HashMap<>();

        HttpHeaders h2 = new HttpHeaders();
        h2.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        h2.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
        h2.set("Referer", "https://bonbast.com/");
        h2.set("X-Requested-With", "XMLHttpRequest");
        if (cookieHeader.length() > 0) {
            h2.set("Cookie", cookieHeader.toString());
        }

        HttpEntity<String> postEntity = new HttpEntity<>("param=" + param, h2);
        ResponseEntity<Map> jsonResp = restTemplate.exchange(
                "https://bonbast.com/json", HttpMethod.POST, postEntity, Map.class);

        Map<String, Object> raw = jsonResp.getBody();
        if (raw == null || raw.containsKey("reset") || raw.containsKey("rest")) {
            return new HashMap<>();
        }

        return parseResponse(raw);
    }

    private String extractParam(String html) {
        if (html == null) return null;
        String[] markers = {"param: \"", "param:\"", "param: '", "param:'"};
        for (String marker : markers) {
            int idx = html.indexOf(marker);
            if (idx != -1) {
                int start = idx + marker.length();
                char quote = marker.endsWith("\"") ? '"' : '\'';
                int end = html.indexOf(quote, start);
                if (end != -1) return html.substring(start, end);
            }
        }
        return null;
    }

    private Map<String, Object> parseResponse(Map<String, Object> raw) {
        Map<String, Object> result = new HashMap<>();
        addItem(result, raw, "usd", "دلار", new String[]{"usd1", "usd"});
        addItem(result, raw, "gold", "طلا (۱۸ عیار)", new String[]{"gol18", "gold18", "gold"});
        result.put("updatedAt", Instant.now().toString());
        return result;
    }

    private void addItem(Map<String, Object> result, Map<String, Object> raw,
                         String key, String label, String[] candidates) {
        for (String candidate : candidates) {
            Object val = raw.get(candidate);
            if (val != null) {
                Map<String, String> entry = new HashMap<>();
                entry.put("price", formatPrice(val.toString()));
                entry.put("label", label);
                result.put(key, entry);
                return;
            }
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