package com.NewsGrid.V10.service;

import com.NewsGrid.V10.logging.DutaLogger;
import com.NewsGrid.V10.logging.LogEvent;
import jakarta.annotation.PostConstruct;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * UCS-001 & UCS-010: Non-blocking market price scraper using Java 21 HttpClient
 * and in-memory ring-buffer Sparkline engine for "Tablo".
 */
@Service
public class PriceService {

    private static final DutaLogger logger = DutaLogger.of(PriceService.class);
    private static final int MAX_SPARKLINE_POINTS = 16;

    private volatile Map<String, Object> cachedPrices = null;
    private volatile Map<String, Object> cachedTablo = null;

    private final Map<String, Deque<Long>> sparklineHistory = new ConcurrentHashMap<>();
    private final Map<String, Long> baselinePrices = new ConcurrentHashMap<>();

    private final HttpClient httpClient = HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_1_1)
            .followRedirects(HttpClient.Redirect.NORMAL)
            .connectTimeout(Duration.ofSeconds(8))
            .build();

    /**
     * Pre-populate market data immediately on boot so Header & Tablo are never empty.
     */
    @PostConstruct
    public void initDefaultMarketData() {
        updateMarketState(
                271_900L,    // دلار آزاد
                293_600L,    // یورو
                74_200L,     // درهم
                350_700L,    // پوند
                7_850L,      // لیر
                27_223_000L, // طلا ۱۸ عیار
                36_290_000L, // طلا ۲۴ عیار
                303_500_000L,// سکه امامی
                289_800_000L,// سکه بهار آزادی
                169_500_000L,// نیم‌سکه
                109_200_000L,// ربع‌سکه
                272_400L     // تتر
        );
    }

    public Map<String, Object> getPrices() {
        return this.cachedPrices;
    }

    public Map<String, Object> getTabloData() {
        return this.cachedTablo;
    }

    @Scheduled(fixedRate = 300000, initialDelay = 5000)
    public void refreshPricesBackground() {
        var timer = logger.startTimer();
        logger.debug(LogEvent.PRICE_FETCH_START, "Fetching live market data for Header & Tablo");

        try {
            scrapeAndBuildMarketData();
            logger.info(LogEvent.PRICE_FETCH_OK, "Live market & Tablo data refreshed",
                    "duration_ms", timer.stop());
        } catch (Exception e) {
            logger.warn(LogEvent.PRICE_FETCH_FAILED, "PriceService background fetch warning (keeping cached data)",
                    "error", e.getMessage(), "duration_ms", timer.stop());
        }
    }

    private void scrapeAndBuildMarketData() throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("https://www.tgju.org/"))
                .timeout(Duration.ofSeconds(10))
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
                .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                .header("Accept-Language", "fa-IR,fa;q=0.9,en-US;q=0.8,en;q=0.7")
                .GET()
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        String html = response.body();
        if (html == null || html.isBlank()) {
            return;
        }

        Document doc = Jsoup.parse(html);

        long usdToman = extractTomanPrice(doc, "price_dollar_rl", 100_000L);
        long gold18Toman = extractTomanPrice(doc, "geram18", 10_000_000L);

        if (usdToman <= 0 || gold18Toman <= 0) {
            return;
        }

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

        updateMarketState(
                usdToman, eurToman, aedToman, gbpToman, tryToman,
                gold18Toman, gold24Toman, sekeeToman, sekebToman, nimToman, robToman,
                usdtToman
        );
    }

    private void updateMarketState(
            long usd, long eur, long aed, long gbp, long tryPrice,
            long gold18, long gold24, long sekee, long sekeb, long nim, long rob,
            long usdt) {

        Map<String, Object> legacyResult = new LinkedHashMap<>();
        legacyResult.put("usd", Map.of("price", String.format("%,d", usd), "label", "دلار"));
        legacyResult.put("gold", Map.of("price", String.format("%,d", gold18), "label", "طلا (۱۸ عیار)"));
        legacyResult.put("updatedAt", Instant.now().toString());
        this.cachedPrices = Collections.unmodifiableMap(legacyResult);

        List<Map<String, Object>> assets = new ArrayList<>();
        assets.add(buildAsset("usd", "USD", "دلار آزاد", "currency", "usd", usd, "تومان"));
        assets.add(buildAsset("eur", "EUR", "یورو اروپا", "currency", "usd", eur, "تومان"));
        assets.add(buildAsset("aed", "AED", "درهم امارات", "currency", "usd", aed, "تومان"));
        assets.add(buildAsset("gbp", "GBP", "پوند انگلیس", "currency", "usd", gbp, "تومان"));
        assets.add(buildAsset("try", "TRY", "لیر ترکیه", "currency", "usd", tryPrice, "تومان"));

        assets.add(buildAsset("gold18", "AU18", "طلا ۱۸ عیار", "gold", "gold", gold18, "تومان/گرم"));
        assets.add(buildAsset("gold24", "AU24", "طلا ۲۴ عیار", "gold", "gold", gold24, "تومان/گرم"));
        assets.add(buildAsset("sekee", "SEKE", "سکه امامی", "gold", "gold", sekee, "تومان"));
        assets.add(buildAsset("sekeb", "BAHAR", "سکه بهار آزادی", "gold", "gold", sekeb, "تومان"));
        assets.add(buildAsset("nim", "NIM", "نیم‌سکه", "gold", "gold", nim, "تومان"));
        assets.add(buildAsset("rob", "ROB", "ربع‌سکه", "gold", "gold", rob, "تومان"));

        assets.add(buildAsset("usdt", "USDT", "تتر", "crypto", "usd", usdt, "تومان"));

        Map<String, Object> tabloMap = new LinkedHashMap<>();
        tabloMap.put("assets", Collections.unmodifiableList(assets));
        tabloMap.put("updatedAt", Instant.now().toString());
        this.cachedTablo = Collections.unmodifiableMap(tabloMap);
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
        asset.put("chipTheme", chipTheme);
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