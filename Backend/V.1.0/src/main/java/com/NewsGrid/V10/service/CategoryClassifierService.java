package com.NewsGrid.V10.service;

import com.NewsGrid.V10.entity.Source;
import com.rometools.rome.feed.synd.SyndCategory;
import com.rometools.rome.feed.synd.SyndEntry;
import org.jdom2.Element;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.select.Elements;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLDecoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Locale;

/**
 * Pure Publisher-Declared Category Extractor (Zero Source Base Category & Zero Title Guessing).
 * Extracts the exact category declared by the news website via:
 * 1. RSS <category> and <dc:subject> tags
 * 2. URL-decoded RSS <link> section path (e.g. /بخش-ورزشی-67/, /sport/, /economy/)
 * 3. Webpage HTML Breadcrumb ("خانه ◀ ورزشی ◀ ورزش جهان") and <meta property="article:section">
 */
@Service
public class CategoryClassifierService {

    private final HttpClient httpClient = HttpClient.newBuilder()
            .followRedirects(HttpClient.Redirect.NORMAL)
            .connectTimeout(Duration.ofSeconds(4))
            .build();

    public String extractCategoryFromRssEntry(SyndEntry entry, String link) {
        // ۱. بررسی تگ‌های <category> داخل آیتم RSS
        if (entry != null && entry.getCategories() != null) {
            for (SyndCategory cat : entry.getCategories()) {
                if (cat != null && cat.getName() != null) {
                    String mapped = mapPublisherCategory(cat.getName());
                    if (mapped != null) return mapped;
                }
            }
        }

        // ۲. بررسی تگ‌های <dc:subject> یا مارکاپ‌های اضافی داخل آیتم RSS
        if (entry != null && entry.getForeignMarkup() != null) {
            for (Element el : entry.getForeignMarkup()) {
                if (el != null && el.getTextNormalize() != null) {
                    String mapped = mapPublisherCategory(el.getTextNormalize());
                    if (mapped != null) return mapped;
                }
            }
        }

        // ۳. بررسی مسیر لینک خبر در RSS (مانند ایلنا، فرارو، تابناک: /بخش-ورزشی-67/ یا /service/sport/)
        String fromUrl = extractCategoryFromUrlPath(link);
        if (fromUrl != null) return fromUrl;

        // ۴. خواندن مستقیم نوار دسته‌بندی (Breadcrumb: خانه ◀ ورزشی) و متاتگ article:section از صفحه خبر
        String fromHtml = fetchAndExtractPageBreadcrumbCategory(link);
        if (fromHtml != null) return fromHtml;

        return "اجتماعی";
    }

    public String classifyFromRssCategories(List<SyndCategory> rssCategories, Source ignoredSource) {
        if (rssCategories != null) {
            for (SyndCategory cat : rssCategories) {
                if (cat != null && cat.getName() != null) {
                    String mapped = mapPublisherCategory(cat.getName());
                    if (mapped != null) return mapped;
                }
            }
        }
        return "اجتماعی";
    }

    public String classifyFromHtmlCategory(String htmlCategoryTag, String link) {
        if (htmlCategoryTag != null && !htmlCategoryTag.isBlank()) {
            String mapped = mapPublisherCategory(htmlCategoryTag);
            if (mapped != null) return mapped;
        }
        String fromUrl = extractCategoryFromUrlPath(link);
        if (fromUrl != null) return fromUrl;

        String fromHtml = fetchAndExtractPageBreadcrumbCategory(link);
        if (fromHtml != null) return fromHtml;

        return "اجتماعی";
    }

    public String classify(String ignoredTitle, Source ignoredSource) {
        return "اجتماعی";
    }

    public String classify(String ignoredTitle) {
        return "اجتماعی";
    }

    public String extractCategoryFromUrlPath(String url) {
        if (url == null || url.isBlank()) return null;
        try {
            String decoded = URLDecoder.decode(url, StandardCharsets.UTF_8).toLowerCase(Locale.ROOT);
            // بررسی سگمنت‌های مسیر URL (بدون بررسی اسلاگ تیتر انتهای لینک)
            URI uri = URI.create(url);
            String host = uri.getHost() != null ? uri.getHost().toLowerCase(Locale.ROOT) : "";
            String rawPath = uri.getRawPath() != null ? URLDecoder.decode(uri.getRawPath(), StandardCharsets.UTF_8) : "";

            // بررسی مسیرهای بخش‌بندی رایج در CMS خبرگزاری‌ها (مانند /بخش-ورزشی-67/ یا /category/tech/)
            String[] segments = rawPath.split("/");
            for (int i = 0; i < segments.length - 1; i++) {
                String seg = segments[i].trim();
                if (seg.isEmpty() || seg.matches("^\\d+$") || seg.equals("fa") || seg.equals("news")) continue;
                String mapped = mapPublisherCategory(seg);
                if (mapped != null) return mapped;
            }

            // بررسی دامنه سایت‌های تک‌موضوعی که کل سایتشان یک دسته‌بندی واحد است
            if (host.contains("varzesh3") || host.contains("tarafdari") || host.contains("khabarvarzeshi") || host.contains("footballi")) return "ورزشی";
            if (host.contains("zoomit") || host.contains("digiato") || host.contains("gadgetnews") || host.contains("itiran")) return "تکنولوژی";
            if (host.contains("arzdigital") || host.contains("mihanblockchain") || host.contains("ramzarz")) return "رمزارز";
            if (host.contains("pedal") || host.contains("khodrobank") || host.contains("اسب بخار") || host.contains("asbe-bokhar")) return "خودرو";
            if (host.contains("zoomg") || host.contains("gamefa") || host.contains("vigiato")) return "سرگرمی";
            if (host.contains("metadars") || host.contains("kanoon") || host.contains("sanjesh")) return "آموزشی";
            if (host.contains("boursenews") || host.contains("donya-e-eqtesad") || host.contains("ecoiran") || host.contains("eghtesadnews") || host.contains("tejaratnews")) return "اقتصادی";
            if (host.contains("ibna") || host.contains("honaronline") || host.contains("cinemapress")) return "فرهنگ و هنر";
        } catch (Exception ignored) {}
        return null;
    }

    private String fetchAndExtractPageBreadcrumbCategory(String url) {
        if (url == null || !url.startsWith("http")) return null;
        try {
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(4))
                    .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36")
                    .header("Accept", "text/html,application/xhtml+xml")
                    .GET()
                    .build();

            HttpResponse<String> res = httpClient.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (res.statusCode() != 200 || res.body() == null) return null;

            Document doc = Jsoup.parse(res.body());

            // ۱. بررسی متاتگ رسمی article:section
            Elements metaSections = doc.select("meta[property='article:section'], meta[name='section'], meta[name='category'], [itemprop='articleSection']");
            for (org.jsoup.nodes.Element m : metaSections) {
                String content = m.hasAttr("content") ? m.attr("content") : m.text();
                String mapped = mapPublisherCategory(content);
                if (mapped != null) return mapped;
            }

            // ۲. بررسی نوار مسیر بالای خبر (Breadcrumb: خانه ◀ ورزشی ◀ ورزش جهان)
            Elements breadcrumbs = doc.select(
                    ".breadcrumb a, .breadcrumbs a, nav.breadcrumb a, ol.breadcrumb li, ul.breadcrumb li, " +
                    ".news-path a, .cat-links a, .service-name, .category-name, .post-categories a, " +
                    "a[rel='category tag'], .header-breadcrumb a, .path a"
            );
            for (org.jsoup.nodes.Element b : breadcrumbs) {
                String mapped = mapPublisherCategory(b.text());
                if (mapped != null) return mapped;
            }
        } catch (Exception ignored) {}
        return null;
    }

    public String mapPublisherCategory(String publisherCat) {
        if (publisherCat == null || publisherCat.isBlank()) return null;

        String t = publisherCat.trim().toLowerCase(Locale.ROOT)
                .replace('ي', 'ی')
                .replace('ك', 'ک')
                .replace('\u200C', ' ')
                .replace('-', ' ')
                .replace('_', ' ')
                .replaceAll("\\s+", " ");

        if (t.equals("خانه") || t.equals("صفحه اصلی") || t.equals("اخبار") || t.equals("خبر")
                || t.equals("همه اخبار") || t.equals("فوری") || t.equals("خبر فوری")
                || t.equals("اخبار فوری") || t.equals("برگزیده") || t.equals("ویژه")) {
            return null;
        }

        if (t.contains("رمزارز") || t.contains("ارز دیجیتال") || t.contains("بلاکچین")
                || t.contains("کریپتو") || t.contains("بیت کوین") || t.contains("crypto")) {
            return "رمزارز";
        }
        if (t.contains("خودرو") || t.contains("ماشین") || t.contains("موتورسیکلت") || t.contains("auto")) {
            return "خودرو";
        }
        if (t.contains("آموزش") || t.contains("دانشگاه") || t.contains("مدرسه") || t.contains("مدارس")
                || t.contains("کنکور") || t.contains("فرهنگیان") || t.contains("دانشجو")
                || t.contains("دانش آموز") || t.contains("پژوهش")) {
            return "آموزشی";
        }
        if (t.contains("تکنولوژی") || t.contains("فناوری") || t.contains("دیجیتال")
                || t.contains("آی تی") || t.contains("هوش مصنوعی") || t.contains("موبایل")
                || t.contains("سایبری") || t.contains("رایانه") || t.contains("tech")) {
            return "تکنولوژی";
        }
        if (t.contains("ورزش") || t.contains("فوتبال") || t.contains("توپ و تور")
                || t.contains("المپیک") || t.contains("کشتی و رزمی") || t.contains("sport")) {
            return "ورزشی";
        }
        if (t.contains("اقتصاد") || t.contains("بازار") || t.contains("بورس") || t.contains("بانک")
                || t.contains("صنعت") || t.contains("تجارت") || t.contains("نفت") || t.contains("انرژی")
                || t.contains("مسکن") || t.contains("مالی") || t.contains("کسب و کار") || t.contains("کارگری") || t.contains("تولید")) {
            return "اقتصادی";
        }
        if (t.contains("بین الملل") || t.contains("جهان") || t.contains("خاورمیانه")
                || t.contains("سیاست خارجی") || t.contains("اروپا و آمریکا") || t.contains("world") || t.contains("international")) {
            return "جهانی";
        }
        if (t.contains("سلامت") || t.contains("پزشکی") || t.contains("بهداشت")
                || t.contains("درمان") || t.contains("تغذیه") || t.contains("کلینیک") || t.contains("health")) {
            return "سلامت";
        }
        if (t.contains("سرگرمی") || t.contains("سینما") || t.contains("تلویزیون")
                || t.contains("گیم") || t.contains("بازی") || t.contains("چهره ها")) {
            return "سرگرمی";
        }
        if (t.contains("فرهنگ") || t.contains("هنر") || t.contains("کتاب") || t.contains("موسیقی")
                || t.contains("تئاتر") || t.contains("گردشگری") || t.contains("میراث")
                || t.contains("ادبیات") || t.contains("رسانه")) {
            return "فرهنگ و هنر";
        }
        if (t.contains("عمومی") || t.contains("اجتماع") || t.contains("جامعه")
                || t.contains("حوادث") || t.contains("شهری") || t.contains("محیط زیست")
                || t.contains("خانواده") || t.contains("انتظامی") || t.contains("قضایی")
                || t.contains("حقوقی") || t.contains("استان") || t.contains("گوناگون")
                || t.contains("زندگی") || t.contains("چندرسانه")) {
            return "اجتماعی";
        }
        if (t.contains("سیاس") || t.contains("مجلس") || t.contains("دولت")
                || t.contains("دفاع") || t.contains("امنیت") || t.contains("politics")) {
            return "سیاسی";
        }

        return null;
    }
}
