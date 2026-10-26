package com.NewsGrid.V10.service;

import com.NewsGrid.V10.config.ProxyConfig;
import com.NewsGrid.V10.entity.Article;
import com.NewsGrid.V10.entity.Source;
import com.NewsGrid.V10.entity.SourceType;
import com.NewsGrid.V10.logging.DutaLogger;
import com.NewsGrid.V10.logging.LogEvent;
import com.NewsGrid.V10.repository.ArticleClusterRepository;
import com.NewsGrid.V10.repository.ArticleReactionRepository;
import com.NewsGrid.V10.repository.ArticleRepository;
import com.NewsGrid.V10.repository.SourceRepository;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.rometools.rome.feed.synd.SyndEntry;
import com.rometools.rome.feed.synd.SyndFeed;
import com.rometools.rome.io.SyndFeedInput;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import javax.net.ssl.*;
import java.io.InputStream;
import java.io.StringReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.cert.X509Certificate;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.zip.GZIPInputStream;

@Service
public class RssFetcherService {

    private static final DutaLogger logger = DutaLogger.of(RssFetcherService.class);

    private final SourceRepository sourceRepository;
    private final ArticleRepository articleRepository;
    private final ArticleClusterRepository clusterRepository;
    private final ArticleReactionRepository reactionRepository;
    private final ArticleService articleService;
    private final ClusteringService clusteringService;
    private final SlugService slugService;
    private final CategoryClassifierService categoryClassifier;
    private final LocationClassifierService locationClassifier;
    private final Executor rssTaskExecutor;
    private final ProxyConfig proxyConfig;

    private final Cache<String, Boolean> seenUrlsCache = Caffeine.newBuilder()
            .maximumSize(5000)
            .expireAfterWrite(12, TimeUnit.HOURS)
            .build();

    public RssFetcherService(
            SourceRepository sourceRepository,
            ArticleRepository articleRepository,
            ArticleClusterRepository clusterRepository,
            ArticleReactionRepository reactionRepository,
            ArticleService articleService,
            ClusteringService clusteringService,
            SlugService slugService,
            CategoryClassifierService categoryClassifier,
            LocationClassifierService locationClassifier,
            @Qualifier("rssTaskExecutor") Executor rssTaskExecutor,
            ProxyConfig proxyConfig) {
        this.sourceRepository = sourceRepository;
        this.articleRepository = articleRepository;
        this.clusterRepository = clusterRepository;
        this.reactionRepository = reactionRepository;
        this.articleService = articleService;
        this.clusteringService = clusteringService;
        this.slugService = slugService;
        this.categoryClassifier = categoryClassifier;
        this.locationClassifier = locationClassifier;
        this.rssTaskExecutor = rssTaskExecutor;
        this.proxyConfig = proxyConfig;
    }

    private static final Set<String> BREAKING_KEYWORDS = Set.of(
            "زلزله", "سیل", "آتش‌سوزی", "آتش سوزی", "انفجار", "حمله", "جنگ", "بمب", "موشک",
            "کشته", "شهید", "سقوط", "تصادف", "اورژانس", "بحران", "فوری", "خبر فوری", "ترور"
    );

    private static SSLSocketFactory rssSslSocketFactory;
    private static final HostnameVerifier RSS_HOSTNAME_VERIFIER = (hostname, session) -> true;

    static {
        try {
            TrustManager[] trustAllCerts = new TrustManager[]{
                    new X509TrustManager() {
                        public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
                        public void checkClientTrusted(X509Certificate[] certs, String authType) {}
                        public void checkServerTrusted(X509Certificate[] certs, String authType) {}
                    }
            };
            SSLContext sc = SSLContext.getInstance("TLS");
            sc.init(null, trustAllCerts, new java.security.SecureRandom());
            rssSslSocketFactory = sc.getSocketFactory();
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
            AtomicInteger totalNewArticles = new AtomicInteger(0);

            List<CompletableFuture<Void>> futures = sources.stream()
                    .map(source -> CompletableFuture.runAsync(() -> {
                                int saved = fetchSingleRssSource(source);
                                totalNewArticles.addAndGet(saved);
                                successCount.incrementAndGet();
                            }, rssTaskExecutor)
                            .orTimeout(25, TimeUnit.SECONDS)
                            .exceptionally(ex -> {
                                logger.warn(LogEvent.FETCH_FAILED, "RSS fetch timed out or failed",
                                        "source", source.getName(), "error", ex.getMessage());
                                return null;
                            }))
                    .toList();

            CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();

            if (totalNewArticles.get() > 0) {
                articleService.evictArticlesCache();
                logger.info(LogEvent.CACHE_EVICTED, "Articles cache evicted after new RSS items",
                        "new_articles", totalNewArticles.get());
            }

            logger.info(LogEvent.FETCH_CYCLE_END, "Parallel RSS fetch cycle completed",
                    "duration_ms", cycleTimer.stop(),
                    "successful_sources", successCount.get(),
                    "total_sources", sources.size(),
                    "total_new_articles", totalNewArticles.get());

        } catch (Throwable t) {
            logger.error(LogEvent.FETCH_FAILED, "Global RSS fetch cycle error", t);
        }
    }

    @Scheduled(cron = "0 0 3 * * ?")
    public void cleanupOldArticles() {
        var timer = logger.startTimer();
        try {
            ZonedDateTime cutoff = ZonedDateTime.now(ZoneOffset.UTC).minusDays(30);
            articleRepository.deleteByPublishedAtBefore(cutoff);
            int deletedClusters = clusterRepository.deleteOrphanClusters();
            int deletedReactions = reactionRepository.deleteOrphanReactions();
            seenUrlsCache.invalidateAll();
            articleService.evictArticlesCache();

            logger.info(LogEvent.ARTICLES_CLEANUP, "Old articles, orphan clusters & reactions cleanup completed",
                    "cutoff_date", cutoff,
                    "deleted_orphan_clusters", deletedClusters,
                    "deleted_orphan_reactions", deletedReactions,
                    "duration_ms", timer.stop());
        } catch (Exception e) {
            logger.error(LogEvent.DB_ERROR, "Error during daily article cleanup", e);
        }
    }

    private int fetchSingleRssSource(Source source) {
        var fetchTimer = logger.startTimer();
        int savedCount = 0;
        int duplicateCount = 0;

        try {
            String rawPayload = downloadFeedOrPage(source.getRssUrl());
            if (rawPayload == null || rawPayload.isBlank()) {
                return 0;
            }

            int xmlStart = findXmlRootStart(rawPayload);
            if (xmlStart >= 0) {
                String cleanXml = rawPayload.substring(xmlStart).trim();
                SyndFeed feed = new SyndFeedInput().build(new StringReader(cleanXml));

                for (SyndEntry entry : feed.getEntries()) {
                    try {
                        String link = entry.getLink() != null ? entry.getLink().trim() : null;
                        String title = entry.getTitle() != null ? entry.getTitle().trim() : null;
                        if (link == null || link.isBlank() || title == null || title.isBlank()) continue;

                        if (isDuplicateUrl(link)) {
                            duplicateCount++;
                            continue;
                        }

                        String cleanDesc = extractCleanDescription(entry);
                        ZonedDateTime pubAt = entry.getPublishedDate() != null
                                ? entry.getPublishedDate().toInstant().atZone(ZoneOffset.UTC)
                                : ZonedDateTime.now(ZoneOffset.UTC);

                        saveAndClusterArticle(source, title, cleanDesc, link, pubAt);
                        savedCount++;
                    } catch (Throwable ignored) {}
                }
            } else {
                // پشتیبانی خودکار از صفحات دسته‌بندی HTML (مانند متادرس و سایت‌های بدون XML)
                Document doc = Jsoup.parse(rawPayload, source.getRssUrl());
                Elements links = doc.select("article h2 a, article h3 a, .entry-title a, .post-title a, h2.title a, h3.title a");
                if (links.isEmpty()) {
                    links = doc.select("h2 a[href], h3 a[href]");
                }

                int count = 0;
                for (Element aTag : links) {
                    if (count >= 25) break;
                    try {
                        String link = aTag.absUrl("href").trim();
                        String title = aTag.text().trim();
                        if (link.isBlank() || title.length() < 12) continue;

                        if (isDuplicateUrl(link)) {
                            duplicateCount++;
                            continue;
                        }

                        String summary = null;
                        Element articleParent = aTag.closest("article, .post, .item");
                        if (articleParent != null) {
                            Element p = articleParent.selectFirst("p, .entry-summary, .excerpt");
                            if (p != null && !p.text().isBlank()) {
                                summary = trimSummary(p.text().trim());
                            }
                        }

                        saveAndClusterArticle(source, title, summary, link, ZonedDateTime.now(ZoneOffset.UTC));
                        savedCount++;
                        count++;
                    } catch (Throwable ignored) {}
                }
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

        return savedCount;
    }

    private String downloadFeedOrPage(String urlStr) throws Exception {
        String currentUrl = urlStr;
        for (int redirect = 0; redirect < 4; redirect++) {
            URL feedUrl = new URL(currentUrl);
            HttpURLConnection conn = (HttpURLConnection) feedUrl.openConnection(proxyConfig.getProxy());

            if (conn instanceof HttpsURLConnection httpsConn && rssSslSocketFactory != null) {
                httpsConn.setSSLSocketFactory(rssSslSocketFactory);
                httpsConn.setHostnameVerifier(RSS_HOSTNAME_VERIFIER);
            }

            conn.setInstanceFollowRedirects(true);
            conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
            conn.setRequestProperty("Accept", "application/rss+xml, application/xml, text/xml, text/html, */*");
            conn.setRequestProperty("Accept-Language", "fa-IR,fa;q=0.9,en-US;q=0.8,en;q=0.7");
            conn.setRequestProperty("Accept-Encoding", "gzip, identity");
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(12000);

            int status = conn.getResponseCode();
            if (status == HttpURLConnection.HTTP_MOVED_PERM || status == HttpURLConnection.HTTP_MOVED_TEMP
                    || status == 307 || status == 308) {
                String loc = conn.getHeaderField("Location");
                if (loc != null && !loc.isBlank()) {
                    currentUrl = new URL(feedUrl, loc).toString();
                    continue;
                }
            }

            try (InputStream rawStream = conn.getInputStream();
                 InputStream in = "gzip".equalsIgnoreCase(conn.getContentEncoding())
                         ? new GZIPInputStream(rawStream)
                         : rawStream) {
                return new String(in.readAllBytes(), StandardCharsets.UTF_8);
            }
        }
        return null;
    }

    private int findXmlRootStart(String body) {
        int xmlDecl = body.indexOf("<?xml");
        int rssTag = body.indexOf("<rss");
        int feedTag = body.indexOf("<feed");

        int best = -1;
        for (int idx : new int[]{xmlDecl, rssTag, feedTag}) {
            if (idx >= 0 && (best == -1 || idx < best)) {
                best = idx;
            }
        }
        return (best >= 0 && best < 500) ? best : -1;
    }

    private boolean isDuplicateUrl(String link) {
        if (seenUrlsCache.getIfPresent(link) != null) {
            return true;
        }
        if (articleRepository.existsByUrl(link)) {
            seenUrlsCache.put(link, Boolean.TRUE);
            return true;
        }
        return false;
    }

    private void saveAndClusterArticle(Source source, String title, String cleanDesc, String link, ZonedDateTime pubAt) {
        Article article = new Article();
        article.setTitle(title);
        article.setDescription(cleanDesc);
        article.setUrl(link);
        article.setPublishedAt(pubAt);
        article.setSource(source);
        article.setBreaking(isBreaking(title));
        article.setCategory(categoryClassifier.classify(title, source));
        article.setLocation(locationClassifier.detectLocation(title, cleanDesc));
        article.setSlug(slugService.generateSlug(title, articleRepository));

        articleRepository.save(article);
        seenUrlsCache.put(link, Boolean.TRUE);
        clusteringService.clusterArticle(article);
    }

    private String extractCleanDescription(SyndEntry entry) {
        try {
            if (entry.getDescription() == null || entry.getDescription().getValue() == null) {
                return null;
            }
            String clean = Jsoup.parse(entry.getDescription().getValue()).text().trim();
            return trimSummary(clean);
        } catch (Exception e) {
            return null;
        }
    }

    private String trimSummary(String clean) {
        if (clean == null || clean.isBlank()) return null;
        if (clean.length() > 350) {
            int lastSpace = clean.substring(0, 350).lastIndexOf(' ');
            return (lastSpace > 100) ? clean.substring(0, lastSpace) + "..." : clean.substring(0, 347) + "...";
        }
        return clean;
    }

    private boolean isBreaking(String title) {
        if (title == null) return false;
        String lower = title.toLowerCase().replace('ي', 'ی').replace('ك', 'ک');
        return BREAKING_KEYWORDS.stream().anyMatch(lower::contains);
    }
}