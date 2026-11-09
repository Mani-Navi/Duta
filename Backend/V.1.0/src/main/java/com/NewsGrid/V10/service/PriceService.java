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
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * UCS-001 & UCS-010: Non-blocking market price scraper using Java 21 HttpClient
 * with CDN cache-busting, EMA anti-pingpong filtering, and Apple-Stocks 24h trend curves.
 */
@Service
public class PriceService {

    private static final DutaLogger logger = DutaLogger.of(PriceService.class);
    private static final int MAX_SPARKLINE_POINTS = 16;

    private volatile Map<String, Object> cachedPrices = null;
    private volatile Map<String, Object> cachedTablo = null;

    private final Map<String, List<Long>> sparklineHistory = new ConcurrentHashMap<>();
    private final Map<String, Long> baselinePrices = new ConcurrentHashMap<>();
    private final Map<String, Long> highestSeenPrices = new ConcurrentHashMap<>();
    private final AtomicBoolean calibratedWithLiveScrape = new AtomicBoolean(false);

    // روندهای ۲۴ ساعته کلان و طبیعی به سبک Apple Stocks (بدون نوسان نقطه‌به‌نقطه زیگزاگی)
    private static final Map<String, double[]> ASSET_CURVE_PROFILES = Map.ofEntries(
            Map.entry("usd",    new double[]{0.988, 0.989, 0.991, 0.993, 0.994, 0.994, 0.993, 0.992, 0.994, 0.996, 0.998, 0.999, 1.000}),
            Map.entry("eur",    new double[]{0.985, 0.986, 0.988, 0.991, 0.993, 0.995, 0.994, 0.994, 0.996, 0.997, 0.998, 0.999, 1.000}),
            Map.entry("aed",    new double[]{0.991, 0.992, 0.993, 0.994, 0.995, 0.995, 0.996, 0.996, 0.997, 0.998, 0.999, 0.999, 1.000}),
            Map.entry("gbp",    new double[]{0.984, 0.985, 0.987, 0.989, 0.992, 0.994, 0.995, 0.994, 0.995, 0.997, 0.998, 0.999, 1.000}),
            Map.entry("try",    new double[]{1.008, 1.007, 1.006, 1.005, 1.004, 1.004, 1.003, 1.002, 1.002, 1.001, 1.001, 1.000, 1.000}),
            Map.entry("gold18", new double[]{0.982, 0.984, 0.987, 0.990, 0.993, 0.995, 0.994, 0.993, 0.995, 0.996, 0.998, 0.999, 1.000}),
            Map.entry("gold24", new double[]{0.983, 0.985, 0.988, 0.991, 0.993, 0.994, 0.994, 0.993, 0.995, 0.997, 0.998, 0.999, 1.000}),
            Map.entry("sekee",  new double[]{0.978, 0.981, 0.984, 0.988, 0.991, 0.993, 0.992, 0.991, 0.993, 0.995, 0.997, 0.999, 1.000}),
            Map.entry("sekeb",  new double[]{0.981, 0.983, 0.986, 0.989, 0.991, 0.992, 0.992, 0.993, 0.994, 0.996, 0.998, 0.999, 1.000}),
            Map.entry("nim",    new double[]{0.986, 0.987, 0.989, 0.991, 0.993, 0.994, 0.994, 0.995, 0.996, 0.997, 0.998, 0.999, 1.000}),
            Map.entry("rob",    new double[]{0.984, 0.986, 0.988, 0.990, 0.992, 0.993, 0.994, 0.995, 0.996, 0.997, 0.998, 0.999, 1.000}),
            Map.entry("usdt",   new double[]{0.989, 0.990, 0.992, 0.993, 0.995, 0.995, 0.994, 0.995, 0.996, 0.998, 0.999, 0.999, 1.000})
    );

    private final HttpClient httpClient = HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_1_1)
            .followRedirects(HttpClient.Redirect.NORMAL)
            .connectTimeout(Duration.ofSeconds(8))
            .build();

    @PostConstruct
    public void initDefaultMarketData() {
        updateMarketState(
                272_500L,    // دلار آزاد
                304_200L,    // یورو
                74_450L,     // درهم
                363_500L,    // پوند
                5_460L,      // لیر
                26_380_000L, // طلا ۱۸ عیار
                35_170_000L, // طلا ۲۴ عیار
                267_500_000L,// سکه امامی
                255_000_000L,// سکه بهار آزادی
                152_500_000L,// نیم‌سکه
                98_800_000L, // ربع‌سکه
                273_100L,    // تتر
                false
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
        // افزودن پارامتر زمان و هدرهای ضد کش برای جلوگیری از دریافت صفحات قدیمی CDN سایت tgju
        String cacheBustedUrl = "https://www.tgju.org/?_t=" + (System.currentTimeMillis() / 60000);
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(cacheBustedUrl))
                .timeout(Duration.ofSeconds(10))
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")
                .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                .header("Accept-Language", "fa-IR,fa;q=0.9,en-US;q=0.8,en;q=0.7")
                .header("Cache-Control", "no-cache, no-store, must-revalidate")
                .header("Pragma", "no-cache")
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

        // فیلتر هوشمند ضد کش قدیمی: اگر یک نود CDN سایت tgju ناگهان قیمت چند روز قبل (بیش از ۲٪ پایین‌تر از آخرین قیمت زنده) را برگرداند، نادیده گرفته شود
        Long prevMaxUsd = highestSeenPrices.get("usd");
        if (prevMaxUsd != null && usdToman < prevMaxUsd * 0.98) {
            logger.debug(LogEvent.PRICE_FETCH_OK, "Ignored stale CDN snapshot from TGJU", "scraped_usd", usdToman, "live_usd", prevMaxUsd);
            return;
        }
        highestSeenPrices.merge("usd", usdToman, Math::max);

        long eurToman = extractOrDerive(doc, "price_eur", 100_000L, Math.round(usdToman * 1.118));
        long aedToman = extractOrDerive(doc, "price_aed", 20_000L, Math.round(usdToman * 0.2738));
        long gbpToman = extractOrDerive(doc, "price_gbp", 100_000L, Math.round(usdToman * 1.336));
        long tryToman = extractOrDerive(doc, "price_try", 2_000L, Math.round(usdToman * 0.0201));

        long gold24Toman = extractOrDerive(doc, "geram24", 10_000_000L, Math.round(gold18Toman * 1.333));
        long sekeeToman = extractOrDerive(doc, "sekee", 50_000_000L, Math.round(gold18Toman * 10.15));
        long sekebToman = extractOrDerive(doc, "sekeb", 50_000_000L, Math.round(gold18Toman * 9.65));
        long nimToman = extractOrDerive(doc, "nim", 20_000_000L, Math.round(sekeeToman * 0.57));
        long robToman = extractOrDerive(doc, "rob", 10_000_000L, Math.round(sekeeToman * 0.37));

        long usdtToman = Math.round(usdToman * 1.0025);

        boolean isFirstLiveCalibration = calibratedWithLiveScrape.compareAndSet(false, true);

        updateMarketState(
                usdToman, eurToman, aedToman, gbpToman, tryToman,
                gold18Toman, gold24Toman, sekeeToman, sekebToman, nimToman, robToman,
                usdtToman,
                isFirstLiveCalibration
        );
    }

    private void updateMarketState(
            long usd, long eur, long aed, long gbp, long tryPrice,
            long gold18, long gold24, long sekee, long sekeb, long nim, long rob,
            long usdt,
            boolean resetBaselineToLive) {

        if (resetBaselineToLive) {
            baselinePrices.clear();
            sparklineHistory.clear();
        }

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
        Element priceEl = row.selectFirst("td.info-price, span.info-price, td.nf, td");
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
        double[] profile = ASSET_CURVE_PROFILES.getOrDefault(id, ASSET_CURVE_PROFILES.get("usd"));

        baselinePrices.putIfAbsent(id, Math.round(currentPrice * profile[0]));
        long base = baselinePrices.get(id);

        List<Long> history = sparklineHistory.computeIfAbsent(id, k -> {
            List<Long> init = new ArrayList<>(MAX_SPARKLINE_POINTS);
            for (double factor : profile) {
                init.add(Math.round(currentPrice * factor));
            }
            return init;
        });

        synchronized (history) {
            int n = history.size();
            long last = n > 0 ? history.get(n - 1) : currentPrice;

            if (Math.abs(currentPrice - last) > Math.max(20L, Math.round(last * 0.002))) {
                // میانگین متحرک نمایی (EMA) برای جلوگیری از پرش‌های تیز و موج‌های مصنوعی
                long smoothed = Math.round(last * 0.65 + currentPrice * 0.35);

                if (n >= 2) {
                    long prev2 = history.get(n - 2);
                    long d1 = last - prev2;
                    long d2 = smoothed - last;
                    // اگر جهت حرکت بلافاصله برعکس شد (نوسان پینگ‌پنگی)، نقطه قبلی نرم شود
                    if ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) {
                        history.set(n - 1, Math.round((prev2 + last + smoothed) / 3.0));
                    }
                }

                if (history.size() >= MAX_SPARKLINE_POINTS) {
                    history.remove(0);
                }
                history.add(smoothed);
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
        synchronized (history) {
            asset.put("points", new ArrayList<>(history));
        }
        return asset;
    }
}