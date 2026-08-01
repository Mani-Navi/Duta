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
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import javax.net.ssl.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.cert.X509Certificate;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
public class RssFetcherService {

    private final SourceRepository sourceRepository;
    private final ArticleRepository articleRepository;
    private final ClusteringService clusteringService;
    private final SlugService slugService;
    private final CategoryClassifierService categoryClassifier;
    private final Executor rssTaskExecutor;

    public RssFetcherService(
            SourceRepository sourceRepository,
            ArticleRepository articleRepository,
            ClusteringService clusteringService,
            SlugService slugService,
            CategoryClassifierService categoryClassifier,
            @Qualifier("rssTaskExecutor") Executor rssTaskExecutor) {
        this.sourceRepository = sourceRepository;
        this.articleRepository = articleRepository;
        this.clusteringService = clusteringService;
        this.slugService = slugService;
        this.categoryClassifier = categoryClassifier;
        this.rssTaskExecutor = rssTaskExecutor;
    }

    private static final Set<String> BREAKING_KEYWORDS = Set.of(
            "زلزله", "سیل", "آتش‌سوزی", "انفجار", "حمله", "جنگ", "بمب", "موشک",
            "کشته", "شهید", "سقوط", "تصادف", "اورژانس", "بحران", "فوری", "خبر فوری", "ترور"
    );

    static {
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
            List<Source> sources = sourceRepository.findAll().stream()
                    .filter(s -> (s.getSourceType() == null || s.getSourceType() == SourceType.RSS))
                    .filter(s -> s.getRssUrl() != null && !s.getRssUrl().contains("t.me/"))
                    .toList();

            log.info("Starting Parallel RSS fetch cycle for {} sources...", sources.size());

            // OPTIMIZED: Added 20s timeout per future using Spring Executor
            List<CompletableFuture<Void>> futures = sources.stream()
                    .map(source -> CompletableFuture.runAsync(() -> fetchSingleRssSource(source), rssTaskExecutor)
                            .orTimeout(20, TimeUnit.SECONDS)
                            .exceptionally(ex -> {
                                log.warn("RSS fetch timed out or failed for {}: {}", source.getName(), ex.getMessage());
                                return null;
                            }))
                    .toList();

            CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
            log.info("Parallel RSS fetch cycle completed successfully.");

        } catch (Throwable t) {
            log.error("Global RSS fetch cycle error: {}", t.getMessage());
        }
    }

    @Scheduled(cron = "0 0 3 * * ?")
    public void cleanupOldArticles() {
        try {
            ZonedDateTime cutoff = ZonedDateTime.now(ZoneOffset.UTC).minusDays(3);
            articleRepository.deleteByPublishedAtBefore(cutoff);
            log.info("Old articles cleanup (older than 3 days) completed. Cutoff: {}", cutoff);
        } catch (Exception e) {
            log.error("Error during daily article cleanup: {}", e.getMessage());
        }
    }

    private void fetchSingleRssSource(Source source) {
        long startTime = System.currentTimeMillis();
        try {
            URL feedUrl = new URL(source.getRssUrl());
            HttpURLConnection conn = (HttpURLConnection) feedUrl.openConnection();
            conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36");
            conn.setRequestProperty("Accept", "text/xml, application/xml, application/rss+xml, */*");
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(5000);

            SyndFeed feed = new SyndFeedInput().build(new XmlReader(conn));
            int savedCount = 0;

            for (SyndEntry entry : feed.getEntries()) {
                try {
                    if (!articleRepository.existsByUrl(entry.getLink())) {
                        Article article = new Article();
                        article.setTitle(entry.getTitle());
                        article.setUrl(entry.getLink());

                        if (entry.getPublishedDate() != null) {
                            article.setPublishedAt(entry.getPublishedDate().toInstant().atZone(ZoneOffset.UTC));
                        } else {
                            article.setPublishedAt(ZonedDateTime.now(ZoneOffset.UTC));
                        }

                        article.setSource(source);
                        article.setBreaking(isBreaking(entry.getTitle()));
                        article.setCategory(categoryClassifier.classify(entry.getTitle(), source));
                        article.setSlug(slugService.generateSlug(entry.getTitle(), articleRepository));

                        articleRepository.save(article);
                        clusteringService.clusterArticle(article);
                        savedCount++;
                    }
                } catch (Throwable ignored) {}
            }

            source.setLastFetchedAt(ZonedDateTime.now(ZoneOffset.UTC));
            sourceRepository.save(source);

            double elapsedSeconds = (System.currentTimeMillis() - startTime) / 1000.0;
            log.info("RSS {}: {} new articles saved in {}s.", source.getName(), savedCount, String.format("%.1f", elapsedSeconds));

        } catch (Throwable t) {
            log.warn("Failed to fetch RSS for {} - Error: {}", source.getName(), t.getMessage());
        }
    }

    private boolean isBreaking(String title) {
        if (title == null) return false;
        String lower = title.toLowerCase();
        return BREAKING_KEYWORDS.stream().anyMatch(lower::contains);
    }
}