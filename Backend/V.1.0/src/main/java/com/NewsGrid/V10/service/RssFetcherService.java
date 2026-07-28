package com.NewsGrid.V10.service;

import com.NewsGrid.V10.entity.Article;
import com.NewsGrid.V10.entity.Source;
import com.NewsGrid.V10.entity.SourceType;
import com.NewsGrid.V10.repository.ArticleRepository;
import com.NewsGrid.V10.repository.SourceRepository;
import com.rometools.rome.feed.synd.SyndEntry;
import com.rometools.rome.feed.synd.SyndFeed;
import com.rometools.rome.io.SyndFeedInput;
import com.rometools.rome.io.XmlReader;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import javax.net.ssl.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.cert.X509Certificate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class RssFetcherService {

    private final SourceRepository sourceRepository;
    private final ArticleRepository articleRepository;
    private final ClusteringService clusteringService;
    private final SlugService slugService;

    private static final Set<String> BREAKING_KEYWORDS = Set.of(
            "زلزله", "سیل", "آتش‌سوزی", "انفجار", "حمله", "جنگ", "بمب", "موشک",
            "کشته", "شهید", "سقوط", "تصادف", "اورژانس", "بحران", "فوری", "خبر فوری", "ترور"
    );

    static {
        // نادیده گرفتن خطاهای SSL برای تمام سایت‌های ایرانی
        try {
            TrustManager[] trustAllCerts = new TrustManager[]{
                    new X509TrustManager() {
                        public X509Certificate[] getAcceptedIssuers() { return null; }
                        public void checkClientTrusted(X509Certificate[] certs, String authType) {}
                        public void checkServerTrusted(X509Certificate[] certs, String authType) {}
                    }
            };
            SSLContext sc = SSLContext.getInstance("SSL");
            sc.init(null, trustAllCerts, new java.security.SecureRandom());
            HttpsURLConnection.setDefaultSSLSocketFactory(sc.getSocketFactory());
            HttpsURLConnection.setDefaultHostnameVerifier((hostname, session) -> true);
        } catch (Exception ignored) {}
    }

    @Scheduled(fixedRate = 300000)
    public void fetchAllSources() {
        try {
            ZonedDateTime cutoff = ZonedDateTime.now().minusDays(30);
            articleRepository.deleteByPublishedAtBefore(cutoff);

            List<Source> sources = sourceRepository.findAll().stream()
                    .filter(s -> (s.getSourceType() == null || s.getSourceType() == SourceType.RSS))
                    .filter(s -> s.getRssUrl() != null && !s.getRssUrl().contains("t.me/"))
                    .toList();

            System.out.println("🚀 شروع دریافت اخبار RSS برای " + sources.size() + " منبع...");

            for (Source source : sources) {
                fetchSingleRssSource(source);
            }
        } catch (Throwable t) {
            System.err.println("⚠️ خطای عمومی در چرخه RSS: " + t.getMessage());
        }
    }

    private void fetchSingleRssSource(Source source) {
        try {
            URL feedUrl = new URL(source.getRssUrl());
            HttpURLConnection conn = (HttpURLConnection) feedUrl.openConnection();
            conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36");
            conn.setRequestProperty("Accept", "text/xml, application/xml, application/rss+xml, */*");
            conn.setConnectTimeout(5000); // ۵ ثانیه تایم‌اوت اتصال
            conn.setReadTimeout(5000);    // ۵ ثانیه تایم‌اout خواندن

            SyndFeed feed = new SyndFeedInput().build(new XmlReader(conn));
            int savedCount = 0;

            for (SyndEntry entry : feed.getEntries()) {
                try {
                    if (!articleRepository.existsByUrl(entry.getLink())) {
                        Article article = new Article();
                        article.setTitle(entry.getTitle());
                        article.setUrl(entry.getLink());

                        if (entry.getPublishedDate() != null) {
                            article.setPublishedAt(
                                    entry.getPublishedDate()
                                            .toInstant()
                                            .atZone(ZoneId.systemDefault())
                            );
                        } else {
                            article.setPublishedAt(ZonedDateTime.now());
                        }

                        article.setSource(source);
                        article.setBreaking(isBreaking(entry.getTitle()));
                        article.setSlug(slugService.generateSlug(entry.getTitle(), articleRepository));

                        articleRepository.save(article);
                        clusteringService.clusterArticle(article);
                        savedCount++;
                    }
                } catch (Throwable ignored) {}
            }

            source.setLastFetchedAt(ZonedDateTime.now());
            sourceRepository.save(source);
            System.out.println("✅ RSS " + source.getName() + ": " + savedCount + " خبر جدید.");

        } catch (Throwable t) {
            System.err.println("⚠️ عدم دریافت RSS برای " + source.getName());
        }
    }

    private boolean isBreaking(String title) {
        if (title == null) return false;
        String lower = title.toLowerCase();
        return BREAKING_KEYWORDS.stream().anyMatch(lower::contains);
    }
}