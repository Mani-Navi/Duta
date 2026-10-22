package com.NewsGrid.V10.service;

import com.NewsGrid.V10.logging.DutaLogger;
import com.NewsGrid.V10.logging.LogEvent;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

@Service
public class PriceService {

    private static final DutaLogger logger = DutaLogger.of(PriceService.class);

    // FIXED: Volatile reference for lock-free 0ms reads on HTTP threads
    private volatile Map<String, Object> cachedPrices = null;

    public Map<String, Object> getPrices() {
        Map<String, Object> current = this.cachedPrices;
        if (current != null) {
            return current;
        }
        return Map.of("error", "داده‌ای در دسترس نیست");
    }

    // OPTIMIZED: Background scheduled scraping every 5 minutes (starts 1s after boot)
    @Scheduled(fixedRate = 300000, initialDelay = 1000)
    public void refreshPricesBackground() {
        var timer = logger.startTimer();
        logger.debug(LogEvent.PRICE_FETCH_START, "Fetching live USD and Gold prices from TGJU");

        try {
            Map<String, Object> result = fetchPricesFromTgjuHomepage();
            if (!result.isEmpty() && result.containsKey("usd") && result.containsKey("gold")) {
                this.cachedPrices = Collections.unmodifiableMap(result);
                logger.info(LogEvent.PRICE_FETCH_OK, "Live prices updated successfully",
                        "duration_ms", timer.stop());
            } else {
                logger.warn(LogEvent.PRICE_FETCH_FAILED, "Incomplete price data scraped from TGJU",
                        "duration_ms", timer.stop());
            }
        } catch (Exception e) {
            logger.warn(LogEvent.PRICE_FETCH_FAILED, "PriceService background fetch error",
                    "error", e.getMessage(), "duration_ms", timer.stop());
        }
    }

    private Map<String, Object> fetchPricesFromTgjuHomepage() {
        Map<String, Object> result = new HashMap<>();

        try {
            Document doc = Jsoup.connect("https://www.tgju.org/")
                    .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
                    .referrer("https://www.google.com")
                    .timeout(8000)
                    .get();

            // 1. Extract Live USD Price
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
                    }
                }
            }

            // 2. Extract Live 18K Gold Price
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
                    }
                }
            }

            result.put("updatedAt", Instant.now().toString());

        } catch (Exception e) {
            logger.warn(LogEvent.PRICE_FETCH_FAILED, "Failed to scrape live prices from TGJU homepage",
                    "error", e.getMessage());
        }

        return result;
    }
}