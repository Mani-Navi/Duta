package com.NewsGrid.V10.service;

import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
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
            Map<String, Object> result = new HashMap<>();

            // 1. Live USD Price from Nobitex API (100% Accurate & Unblocked)
            fetchLiveUsdFromNobitex(result);

            // 2. Live 18K Gold Price from TGJU Main Price Table
            fetchLiveGoldFromTgju(result);

            if (!result.isEmpty()) {
                result.put("updatedAt", Instant.now().toString());
                cachedPrices = result;
                lastFetch = Instant.now();
                return cachedPrices;
            }
        } catch (Exception e) {
            log.warn("PriceService fetch error: {}", e.getMessage());
        }

        if (cachedPrices != null) {
            return cachedPrices;
        }

        return Map.of("error", "داده‌ای در دسترس نیست");
    }

    @SuppressWarnings("unchecked")
    private void fetchLiveUsdFromNobitex(Map<String, Object> result) {
        try {
            String url = "https://api.nobitex.ir/v2/orderbook/USDTIRT";
            ResponseEntity<Map> response = restTemplate.getForEntity(url, Map.class);
            Map<String, Object> body = response.getBody();

            if (body != null && body.containsKey("lastTradePrice")) {
                String rawRial = body.get("lastTradePrice").toString().replaceAll("[^0-9]", "");
                if (!rawRial.isBlank()) {
                    long tomanPrice = Long.parseLong(rawRial) / 10;
                    Map<String, String> usd = new HashMap<>();
                    usd.put("price", String.format("%,d", tomanPrice));
                    usd.put("label", "دلار");
                    result.put("usd", usd);
                    log.info("Accurate USD price fetched: {} Toman", tomanPrice);
                }
            }
        } catch (Exception e) {
            log.warn("Nobitex USD fetch error: {}", e.getMessage());
        }
    }

    private void fetchLiveGoldFromTgju(Map<String, Object> result) {
        try {
            Document docGold = Jsoup.connect("https://www.tgju.org/profile/geram18")
                    .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36")
                    .referrer("https://www.google.com")
                    .timeout(6000)
                    .get();

            // Target the exact main price cell in TGJU table
            Element goldEl = docGold.selectFirst("td[data-col='info.last_trade.P'], th[data-col='info.last_trade.P']");
            if (goldEl != null && !goldEl.text().isBlank()) {
                String rawRial = goldEl.text().replaceAll("[^0-9]", "");
                if (!rawRial.isBlank()) {
                    long rawNum = Long.parseLong(rawRial);
                    long tomanPrice = (rawNum > 10000000) ? (rawNum / 10) : rawNum;

                    Map<String, String> gold = new HashMap<>();
                    gold.put("price", String.format("%,d", tomanPrice));
                    gold.put("label", "طلا (۱۸ عیار)");
                    result.put("gold", gold);
                    log.info("Accurate Gold 18K price fetched: {} Toman", tomanPrice);
                }
            }
        } catch (Exception e) {
            log.warn("TGJU Gold fetch error: {}", e.getMessage());
        }
    }
}