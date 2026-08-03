package com.NewsGrid.V10.service;

import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@Service
public class PriceService {

    private Map<String, Object> cachedPrices = null;
    private Instant lastFetch = Instant.EPOCH;
    private static final long CACHE_SECONDS = 300;

    public synchronized Map<String, Object> getPrices() {
        long secondsSince = Instant.now().getEpochSecond() - lastFetch.getEpochSecond();
        if (cachedPrices != null && secondsSince < CACHE_SECONDS) {
            return cachedPrices;
        }

        try {
            Map<String, Object> result = fetchPricesWithJsoup();
            if (!result.isEmpty() && result.containsKey("usd") && result.containsKey("gold")) {
                cachedPrices = result;
                lastFetch = Instant.now();
                return cachedPrices;
            }
        } catch (Exception e) {
            log.warn("PriceService Jsoup fetch error: {}", e.getMessage());
        }

        if (cachedPrices != null) {
            return cachedPrices;
        }

        return Map.of("error", "داده‌ای در دسترس نیست");
    }

    private Map<String, Object> fetchPricesWithJsoup() {
        Map<String, Object> result = new HashMap<>();

        // 1. Extract Live USD Price from TGJU Profile
        try {
            Document docDollar = Jsoup.connect("https://www.tgju.org/profile/price_dollar_rl")
                    .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36")
                    .referrer("https://www.google.com")
                    .timeout(6000)
                    .get();

            Element dollarEl = docDollar.selectFirst("span.info-price, span[data-col='info.last_trade.P']");
            if (dollarEl != null && !dollarEl.text().isBlank()) {
                String rawPrice = dollarEl.text().replaceAll("[^0-9]", "");
                if (!rawPrice.isBlank()) {
                    long tomanPrice = Long.parseLong(rawPrice) / 10;
                    Map<String, String> usd = new HashMap<>();
                    usd.put("price", String.format("%,d", tomanPrice));
                    usd.put("label", "دلار");
                    result.put("usd", usd);
                }
            }
        } catch (Exception e) {
            log.warn("Failed to fetch USD price from TGJU: {}", e.getMessage());
        }

        // 2. Extract Live 18K Gold Price from TGJU Profile
        try {
            Document docGold = Jsoup.connect("https://www.tgju.org/profile/geram18")
                    .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36")
                    .referrer("https://www.google.com")
                    .timeout(6000)
                    .get();

            Element goldEl = docGold.selectFirst("span.info-price, span[data-col='info.last_trade.P']");
            if (goldEl != null && !goldEl.text().isBlank()) {
                String rawPrice = goldEl.text().replaceAll("[^0-9]", "");
                if (!rawPrice.isBlank()) {
                    long tomanPrice = Long.parseLong(rawPrice) / 10;
                    Map<String, String> gold = new HashMap<>();
                    gold.put("price", String.format("%,d", tomanPrice));
                    gold.put("label", "طلا (۱۸ عیار)");
                    result.put("gold", gold);
                }
            }
        } catch (Exception e) {
            log.warn("Failed to fetch Gold price from TGJU: {}", e.getMessage());
        }

        result.put("updatedAt", Instant.now().toString());
        return result;
    }
}