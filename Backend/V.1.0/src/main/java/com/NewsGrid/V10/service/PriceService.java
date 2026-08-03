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
            Map<String, Object> result = fetchPricesFromTgjuHomepage();
            if (!result.isEmpty() && result.containsKey("usd") && result.containsKey("gold")) {
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

    private Map<String, Object> fetchPricesFromTgjuHomepage() {
        Map<String, Object> result = new HashMap<>();

        try {
            // Fetch TGJU homepage directly with full Chrome headers
            Document doc = Jsoup.connect("https://www.tgju.org/")
                    .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
                    .referrer("https://www.google.com")
                    .timeout(8000)
                    .get();

            // 1. Extract Live USD Price from main homepage table row
            Element usdRow = doc.selectFirst("tr[data-market-row='price_dollar_rl']");
            if (usdRow != null) {
                Element usdPriceEl = usdRow.selectFirst("td.info-price, td");
                if (usdPriceEl != null && !usdPriceEl.text().isBlank()) {
                    String rawStr = usdPriceEl.text().replaceAll("[^0-9]", "");
                    if (!rawStr.isBlank()) {
                        long rawNum = Long.parseLong(rawStr);
                        long tomanPrice = (rawNum > 100000) ? (rawNum / 10) : rawNum;

                        Map<String, String> usd = new HashMap<>();
                        usd.put("price", String.format("%,d", tomanPrice));
                        usd.put("label", "دلار");
                        result.put("usd", usd);
                        log.info("Live USD Price extracted: {} Toman", tomanPrice);
                    }
                }
            }

            // 2. Extract Live 18K Gold Price from main homepage table row
            Element goldRow = doc.selectFirst("tr[data-market-row='geram18']");
            if (goldRow != null) {
                Element goldPriceEl = goldRow.selectFirst("td.info-price, td");
                if (goldPriceEl != null && !goldPriceEl.text().isBlank()) {
                    String rawStr = goldPriceEl.text().replaceAll("[^0-9]", "");
                    if (!rawStr.isBlank()) {
                        long rawNum = Long.parseLong(rawStr);
                        long tomanPrice = (rawNum > 10000000) ? (rawNum / 10) : rawNum;

                        Map<String, String> gold = new HashMap<>();
                        gold.put("price", String.format("%,d", tomanPrice));
                        gold.put("label", "طلا (۱۸ عیار)");
                        result.put("gold", gold);
                        log.info("Live Gold 18K Price extracted: {} Toman", tomanPrice);
                    }
                }
            }

            result.put("updatedAt", Instant.now().toString());

        } catch (Exception e) {
            log.error("Failed to scrape live prices from TGJU homepage: {}", e.getMessage());
        }

        return result;
    }
}