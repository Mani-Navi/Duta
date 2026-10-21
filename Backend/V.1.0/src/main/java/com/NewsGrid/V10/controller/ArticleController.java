package com.NewsGrid.V10.controller;

import com.NewsGrid.V10.Dto.SeoArticleDto;
import com.NewsGrid.V10.entity.Article;
import com.NewsGrid.V10.entity.Source;
import com.NewsGrid.V10.entity.SourceType;
import com.NewsGrid.V10.repository.ArticleRepository;
import com.NewsGrid.V10.service.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicBoolean;

@Slf4j
@RestController
@RequestMapping("/api/articles")
@RequiredArgsConstructor
public class ArticleController {

    private final ArticleService articleService;
    private final RssFetcherService rssFetcherService;
    private final TelegramScraperService telegramScraperService;
    private final ArticleRepository articleRepository;
    private final CategoryClassifierService categoryClassifier;

    @Value("${jwt.secret}")
    private String adminSecret;

    private static final int MAX_PAGE_SIZE = 100;
    private final AtomicBoolean isReclassifying = new AtomicBoolean(false);

    @RequestMapping(value = "/fetch-now", method = {RequestMethod.GET, RequestMethod.POST})
    public ResponseEntity<Map<String, String>> fetchNow(
            @RequestHeader(value = "X-Admin-Key", required = false) String headerKey,
            @RequestParam(value = "key", required = false) String paramKey) {

        if (!isAuthorizedAdmin(headerKey, paramKey)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "دسترسی غیرمجاز"));
        }

        CompletableFuture.runAsync(() -> {
            try {
                log.info("Manual fetch triggered: Fetching RSS sources...");
                rssFetcherService.fetchAllSources();
            } catch (Exception e) {
                log.error("Error during manual RSS fetch: {}", e.getMessage());
            }

            try {
                log.info("Manual fetch triggered: Fetching Telegram channels...");
                telegramScraperService.fetchRecentPosts();
            } catch (Exception e) {
                log.error("Error during manual Telegram fetch: {}", e.getMessage());
            }
        });

        return ResponseEntity.ok(Map.of("status", "started"));
    }

    @GetMapping
    public Page<Article> getAllArticles(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        return articleService.getAllArticles(Math.max(page, 0), safeSize);
    }

    @GetMapping("/telegram")
    public Page<Article> getTelegramArticles(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        return articleRepository.findBySourceSourceTypeOrderByPublishedAtDesc(
                SourceType.TELEGRAM,
                PageRequest.of(Math.max(page, 0), safeSize)
        );
    }

    @GetMapping("/category")
    public Page<Article> getByCategory(
            @RequestParam String name,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        return articleService.getArticlesByCategory(name, Math.max(page, 0), safeSize);
    }

    @GetMapping("/breaking")
    public Page<Article> getBreaking(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        return articleService.getBreakingArticles(Math.max(page, 0), safeSize);
    }

    @GetMapping("/{id}")
    public Article getArticleById(@PathVariable Long id) {
        return articleService.getArticleById(id);
    }

    @GetMapping("/slug/{slug}")
    public Article getArticleBySlug(@PathVariable String slug) {
        return articleService.getArticleBySlug(slug);
    }

    @GetMapping("/{id}/source")
    public Source getArticleSource(@PathVariable Long id) {
        return articleService.getArticleSource(id);
    }

    @GetMapping("/search")
    public Page<Article> search(
            @RequestParam String keyword,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        return articleService.searchArticles(keyword, Math.max(page, 0), safeSize);
    }

    @RequestMapping(value = "/reclassify", method = {RequestMethod.GET, RequestMethod.POST})
    public ResponseEntity<Map<String, String>> reclassify(
            @RequestHeader(value = "X-Admin-Key", required = false) String headerKey,
            @RequestParam(value = "key", required = false) String paramKey) {

        if (!isAuthorizedAdmin(headerKey, paramKey)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "دسترسی غیرمجاز"));
        }

        if (!isReclassifying.compareAndSet(false, true)) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("status", "already_running"));
        }

        CompletableFuture.runAsync(() -> {
            try {
                int page = 0;
                Page<Article> articlePage;

                do {
                    articlePage = articleRepository.findAll(PageRequest.of(page, 100));
                    articlePage.getContent().forEach(article ->
                            article.setCategory(categoryClassifier.classify(article.getTitle(), article.getSource()))
                    );
                    articleRepository.saveAll(articlePage.getContent());
                    page++;
                } while (articlePage.hasNext());

                articleService.evictArticlesCache();
                log.info("Batch reclassification of all articles completed successfully.");
            } finally {
                isReclassifying.set(false);
            }
        });

        return ResponseEntity.ok(Map.of("status", "started"));
    }

    @GetMapping("/seo/{slug}")
    public SeoArticleDto getSeoArticle(@PathVariable String slug) {
        return articleService.getSeoDataBySlug(slug);
    }

    @GetMapping(value = "/sitemap.xml", produces = "application/xml;charset=UTF-8")
    public String getNewsSitemap() {
        List<Article> recentArticles = articleRepository.findTop1000ByOrderByPublishedAtDesc();
        StringBuilder xml = new StringBuilder();
        xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        xml.append("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\" ");
        xml.append("xmlns:news=\"http://www.google.com/schemas/sitemap-news/0.9\">\n");

        for (Article a : recentArticles) {
            String rawSlug = (a.getSlug() != null && !a.getSlug().isBlank())
                    ? a.getSlug()
                    : String.valueOf(a.getId());
            String encodedSlug = URLEncoder.encode(rawSlug, StandardCharsets.UTF_8);
            ZonedDateTime pubDate = a.getPublishedAt() != null ? a.getPublishedAt() : ZonedDateTime.now(ZoneOffset.UTC);

            xml.append("  <url>\n");
            xml.append("    <loc>https://duta.ir/article/").append(escapeXml(encodedSlug)).append("</loc>\n");
            xml.append("    <news:news>\n");
            xml.append("      <news:publication>\n");
            xml.append("        <news:name>Duta</news:name>\n");
            xml.append("        <news:language>fa</news:language>\n");
            xml.append("      </news:publication>\n");
            xml.append("      <news:publication_date>").append(pubDate.toInstant()).append("</news:publication_date>\n");
            xml.append("      <news:title>").append(escapeXml(a.getTitle())).append("</news:title>\n");
            xml.append("    </news:news>\n");
            xml.append("  </url>\n");
        }
        xml.append("</urlset>");
        return xml.toString();
    }

    private boolean isAuthorizedAdmin(String headerKey, String paramKey) {
        if (adminSecret == null || adminSecret.isBlank()) return false;
        return adminSecret.equals(headerKey) || adminSecret.equals(paramKey);
    }

    private String escapeXml(String input) {
        if (input == null) return "";
        return input.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }
}