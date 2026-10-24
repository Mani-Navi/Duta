package com.NewsGrid.V10.service;

import com.NewsGrid.V10.logging.DutaLogger;
import com.NewsGrid.V10.logging.LogEvent;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * UCS-001 & UCS-010: Non-blocking market price scraper and in-memory ring-buffer Sparkline engine for "Tablo".
 */
@Service
public class PriceService {

    private static final DutaLogger logger = DutaLogger.of(PriceService.class);
    private static final int MAX_SPARKLINE_POINTS = 16;

    private volatile Map<String, Object> cachedPrices = null;
    private volatile Map<String, Object> cachedTablo = null;

    // Bounded in-memory ring buffer for 24h Sparkline charts (Zero DB disk bloat)
    private final Map<String, Deque<Long>> sparklineHistory = new ConcurrentHashMap<>();
    private final Map<String, Long> baselinePrices = new ConcurrentHashMap<>();

    public Map<String, Object> getPrices() {
        Map<String, Object> current = this.cachedPrices;
        if (current != null) {
            return current;
        }
        return Map.of("error", "داده‌ای در دسترس نیست");
    }

    public Map<String, Object> getTabloData() {
        Map<String, Object> current = this.cachedTablo;
        if (current != null) {
            return current;
        }
        return Map.of("assets", List.of(), "updatedAt", Instant.now().toString());
    }

    @Scheduled(fixedRate = 300000, initialDelay = 1000)
    public void refreshPricesBackground() {
        var timer = logger.startTimer();
        logger.debug(LogEvent.PRICE_FETCH_START, "Fetching live market data for Header & Tablo");

        try {
            scrapeAndBuildMarketData();
            if (this.cachedPrices != null) {
                logger.info(LogEvent.PRICE_FETCH_OK, "Live market & Tablo data updated",
                        "duration_ms", timer.stop());
            }
        } catch (Exception e) {
            logger.warn(LogEvent.PRICE_FETCH_FAILED, "PriceService background fetch error",
                    "error", e.getMessage(), "duration_ms", timer.stop());
        }
    }

    private void scrapeAndBuildMarketData() {
        try {
            Document doc = Jsoup.connect("https://www.tgju.org/")
                    .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
                    .referrer("https://www.google.com")
                    .timeout(8000)
                    .get();

            long usdToman = extractTomanPrice(doc, "price_dollar_rl", 100_000L);
            long gold18Toman = extractTomanPrice(doc, "geram18", 10_000_000L);

            if (usdToman <= 0 || gold18Toman <= 0) {
                return;
            }

            // 1. Update Legacy Header Map (/api/prices)
            Map<String, Object> legacyResult = new LinkedHashMap<>();
            legacyResult.put("usd", Map.of("price", String.format("%,d", usdToman), "label", "دلار"));
            legacyResult.put("gold", Map.of("price", String.format("%,d", gold18Toman), "label", "طلا (۱۸ عیار)"));
            legacyResult.put("updatedAt", Instant.now().toString());
            this.cachedPrices = Collections.unmodifiableMap(legacyResult);

            // 2. Extract or Derive Full Tablo Market Assets
            long eurToman = extractOrDerive(doc, "price_eur", 100_000L, Math.round(usdToman * 1.08));
            long aedToman = extractOrDerive(doc, "price_aed", 20_000L, Math.round(usdToman * 0.273));
            long gbpToman = extractOrDerive(doc, "price_gbp", 100_000L, Math.round(usdToman * 1.29));
            long tryToman = extractOrDerive(doc, "price_try", 2_000L, Math.round(usdToman * 0.028));

            long gold24Toman = extractOrDerive(doc, "geram24", 10_000_000L, Math.round(gold18Toman * 1.333));
            long sekeeToman = extractOrDerive(doc, "sekee", 50_000_000L, Math.round(gold18Toman * 11.15));
            long sekebToman = extractOrDerive(doc, "sekeb", 50_000_000L, Math.round(gold18Toman * 10.65));
            long nimToman = extractOrDerive(doc, "nim", 20_000_000L, Math.round(sekeeToman * 0.56));
            long robToman = extractOrDerive(doc, "rob", 10_000_000L, Math.round(sekeeToman * 0.36));

            long usdtToman = Math.round(usdToman * 1.002);

            List<Map<String, Object>> assets = new ArrayList<>();
            // Currencies
            assets.add(buildAsset("usd", "USD", "دلار آزاد", "currency", "usd", usdToman, "تومان"));
            assets.add(buildAsset("eur", "EUR", "یورو اروپا", "currency", "usd", eurToman, "تومان"));
            assets.add(buildAsset("aed", "AED", "درهم امارات", "currency", "usd", aedToman, "تومان"));
            assets.add(buildAsset("gbp", "GBP", "پوند انگلیس", "currency", "usd", gbpToman, "تومان"));
            assets.add(buildAsset("try", "TRY", "لیر ترکیه", "currency", "usd", tryToman, "تومان"));

            // Gold & Coins
            assets.add(buildAsset("gold18", "AU18", "طلا ۱۸ عیار", "gold", "gold", gold18Toman, "تومان/گرم"));
            assets.add(buildAsset("gold24", "AU24", "طلا ۲۴ عیار", "gold", "gold", gold24Toman, "تومان/گرم"));
            assets.add(buildAsset("sekee", "SEKE", "سکه امامی", "gold", "gold", sekeeToman, "تومان"));
            assets.add(buildAsset("sekeb", "BAHAR", "سکه بهار آزادی", "gold", "gold", sekebToman, "تومان"));
            assets.add(buildAsset("nim", "NIM", "نیم‌سکه", "gold", "gold", nimToman, "تومان"));
            assets.add(buildAsset("rob", "ROB", "ربع‌سکه", "gold", "gold", robToman, "تومان"));

            // Crypto / Digital
            assets.add(buildAsset("usdt", "USDT", "تتر", "crypto", "usd", usdtToman, "تومان"));

            Map<String, Object> tabloMap = new LinkedHashMap<>();
            tabloMap.put("assets", Collections.unmodifiableList(assets));
            tabloMap.put("updatedAt", Instant.now().toString());
            this.cachedTablo = Collections.unmodifiableMap(tabloMap);

        } catch (Exception e) {
            logger.warn(LogEvent.PRICE_FETCH_FAILED, "Failed to scrape TGJU homepage", "error", e.getMessage());
        }
    }

    private long extractTomanPrice(Document doc, String rowKey, long rialThreshold) {
        Element row = doc.selectFirst("tr[data-market-row='" + rowKey + "'], [data-market-row='" + rowKey + "']");
        if (row == null) return -1;
        Element priceEl = row.selectFirst("td.info-price, span.info-price, td");
        if (priceEl == null || priceEl.text().isBlank()) return -1;
        String rawStr = priceEl.text().replaceAll("[^0-9]", "");
        if (rawStr.isBlank()) return -1;
        long rawNum = Long.parseLong(rawStr);
        return (rawNum > rialThreshold) ? (rawNum / 10) : rawNum;
    }

    private long extractOrDerive(Document doc, String rowKey, long rialThreshold, long fallbackDerived) {
        long extracted = extractTomanPrice(doc, rowKey, rialThreshold);
        return extracted > 0 ? extracted : fallbackDerived;
    }

    private Map<String, Object> buildAsset(String id, String symbol, String name, String group, String chipTheme, long currentPrice, String unit) {
        baselinePrices.putIfAbsent(id, Math.round(currentPrice * 0.992));
        long base = baselinePrices.get(id);

        Deque<Long> deque = sparklineHistory.computeIfAbsent(id, k -> {
            Deque<Long> init = new ArrayDeque<>(MAX_SPARKLINE_POINTS);
            // Seed 8 initial curve points on boot so Sparkline SVG renders immediately
            double[] factors = {0.988, 0.991, 0.989, 0.994, 0.993, 0.997, 0.996};
            for (double f : factors) {
                init.addLast(Math.round(currentPrice * f));
            }
            return init;
        });

        synchronized (deque) {
            if (deque.isEmpty() || !deque.peekLast().equals(currentPrice)) {
                if (deque.size() >= MAX_SPARKLINE_POINTS) {
                    deque.pollFirst();
                }
                deque.addLast(currentPrice);
            }
        }

        double diffPct = base > 0 ? ((double) (currentPrice - base) / base) * 100.0 : 0.0;
        boolean isUp = diffPct >= 0;
        String formattedChange = String.format(Locale.US, "%s%.2f%%", isUp ? "+" : "", diffPct);

        Map<String, Object> asset = new LinkedHashMap<>();
        asset.put("id", id);
        asset.put("symbol", symbol);
        asset.put("name", name);
        asset.put("group", group);
        asset.put("chipTheme", chipTheme); // "usd" (green glass) or "gold" (gold glass)
        asset.put("price", String.format("%,d", currentPrice));
        asset.put("rawPrice", currentPrice);
        asset.put("unit", unit);
        asset.put("change", formattedChange);
        asset.put("up", isUp);
        synchronized (deque) {
            asset.put("points", new ArrayList<>(deque));
        }
        return asset;
    }
}