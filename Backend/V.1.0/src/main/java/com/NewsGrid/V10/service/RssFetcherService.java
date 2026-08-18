package com.NewsGrid.V10.service;

import com.NewsGrid.V10.config.ProxyConfig;
import com.NewsGrid.V10.entity.Article;
import com.NewsGrid.V10.entity.Source;
import com.NewsGrid.V10.entity.SourceType;
import com.NewsGrid.V10.logging.DutaLogger; // اضافه شد
import com.NewsGrid.V10.logging.LogEvent;   // اضافه شد
import com.NewsGrid.V10.repository.ArticleRepository;
import com.NewsGrid.V10.repository.SourceRepository;
import com.rometools.rome.feed.synd.SyndEntry;
import com.rometools.rome.feed.synd.SyndFeed;
import com.rometools.rome.io.SyndFeedInput;
import com.rometools.rome.io.XmlReader;
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
import java.util.concurrent.atomic.AtomicInteger;

@Service
public class RssFetcherService {

    // جایگزینی @Slf4j با لاگر اختصاصی Duta
    private static final DutaLogger logger = DutaLogger.of(RssFetcherService.class);

    private final SourceRepository sourceRepository;
    private final ArticleRepository articleRepository;
    private final ClusteringService clusteringService;
    private final SlugService slugService;
    private final CategoryClassifierService categoryClassifier;
    private final Executor rssTaskExecutor;
    private final ProxyConfig proxyConfig;

    public RssFetcherService(
            SourceRepository sourceRepository,
            ArticleRepository articleRepository,
            ClusteringService clusteringService,
            SlugService slugService,
            CategoryClassifierService categoryClassifier,
            @Qualifier("rssTaskExecutor") Executor rssTaskExecutor,
            ProxyConfig proxyConfig) {
        this.sourceRepository = sourceRepository;
        this.articleRepository = articleRepository;
        this.clusteringService = clusteringService;
        this.slugService = slugService;
        this.categoryClassifier = categoryClassifier;
        this.rssTaskExecutor = rssTaskExecutor;
        this.proxyConfig = proxyConfig;
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
        var cycleTimer = logger.startTimer();
        try {
            List<Source> sources = sourceRepository.findAll().stream()
                    .filter(s -> (s.getSourceType() == null || s.getSourceType() == SourceType.RSS))
                    .filter(s -> s.getRssUrl() != null && !s.getRssUrl().contains("t.me/"))
                    .toList();

            logger.info(LogEvent.FETCH_CYCLE_START, "Starting Parallel RSS fetch cycle", "sources_count", sources.size());

            AtomicInteger successCount = new AtomicInteger(0);

            List<CompletableFuture<Void>> futures = sources.stream()
                    .map(source -> CompletableFuture.runAsync(() -> {
                                fetchSingleRssSource(source);
                                successCount.incrementAndGet();
                            }, rssTaskExecutor)
                            .orTimeout(20, TimeUnit.SECONDS)
                            .exceptionally(ex -> {
                                logger.warn(LogEvent.FETCH_FAILED, "RSS fetch timed out or failed",
                                        "source", source.getName(), "error", ex.getMessage());
                                return null;
                            }))
                    .toList();

            CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();

            logger.info(LogEvent.FETCH_CYCLE_END, "Parallel RSS fetch cycle completed",
                    "duration_ms", cycleTimer.stop(),
                    "successful_sources", successCount.get(),
                    "total_sources", sources.size());

        } catch (Throwable t) {
            logger.error(LogEvent.FETCH_FAILED, "Global RSS fetch cycle error", t);
        }
    }

    @Scheduled(cron = "0 0 3 * * ?")
    public void cleanupOldArticles() {
        var timer = logger.startTimer();
        try {
            ZonedDateTime cutoff = ZonedDateTime.now(ZoneOffset.UTC).minusDays(3);
            articleRepository.deleteByPublishedAtBefore(cutoff);
            logger.info(LogEvent.ARTICLES_CLEANUP, "Old articles cleanup completed",
                    "cutoff_date", cutoff, "duration_ms", timer.stop());
        } catch (Exception e) {
            logger.error(LogEvent.DB_ERROR, "Error during daily article cleanup", e);
        }
    }

    private void fetchSingleRssSource(Source source) {
        var fetchTimer = logger.startTimer();
        logger.debug(LogEvent.FETCH_START, "Fetching single RSS source", "source", source.getName());

        try {
            URL feedUrl = new URL(source.getRssUrl());
            HttpURLConnection conn = (HttpURLConnection) feedUrl.openConnection(proxyConfig.getProxy());
            conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36");
            conn.setRequestProperty("Accept", "text/xml, application/xml, application/rss+xml, */*");
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(5000);

            SyndFeed feed = new SyndFeedInput().build(new XmlReader(conn));
            int savedCount = 0;
            int duplicateCount = 0;

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

                        logger.debug(LogEvent.ARTICLE_SAVED, "New article saved", "title", article.getTitle());
                        savedCount++;
                    } else {
                        duplicateCount++;
                    }
                } catch (Throwable ignored) {}
            }

            source.setLastFetchedAt(ZonedDateTime.now(ZoneOffset.UTC));
            sourceRepository.save(source);

            logger.info(LogEvent.FETCH_COMPLETE, "RSS Source processed",
                    "source", source.getName(),
                    "new_articles", savedCount,
                    "duplicates", duplicateCount,
                    "duration_ms", fetchTimer.stop());

        } catch (Throwable t) {
            logger.warn(LogEvent.FETCH_FAILED, "Failed to fetch RSS source",
                    "source", source.getName(), "error", t.getMessage(), "duration_ms", fetchTimer.stop());
        }
    }

    private boolean isBreaking(String title) {
        if (title == null) return false;
        String lower = title.toLowerCase();
        return BREAKING_KEYWORDS.stream().anyMatch(lower::contains);
    }
}