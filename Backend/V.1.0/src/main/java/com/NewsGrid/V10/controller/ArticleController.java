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

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
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
    private final PersonalizationService personalizationService;
    private final JwtService jwtService;
    private final RssFetcherService rssFetcherService;
    private final TelegramScraperService telegramScraperService;
    private final ArticleRepository articleRepository;
    private final CategoryClassifierService categoryClassifier;
    private final LocationClassifierService locationClassifier;

    @Value("${ADMIN_SECRET:}")
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

    @GetMapping("/hot")
    public List<Article> getHotArticles() {
        return personalizationService.getHotArticlesOfTheDay();
    }

    @GetMapping("/personalized")
    public ResponseEntity<?> getPersonalizedFeed(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        Long userId = jwtService.extractUserIdFromHeader(authHeader);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "برای مشاهده فید شخصی وارد شوید"));
        }

        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        return ResponseEntity.ok(personalizationService.getPersonalizedFeed(userId, Math.max(page, 0), safeSize));
    }

    @GetMapping("/newspaper")
    public Page<Map<String, Object>> getNewspaperFeed(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        Long userId = jwtService.extractUserIdFromHeader(authHeader);
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        return personalizationService.getNewspaperFeed(userId, category, Math.max(page, 0), safeSize);
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
    public Map<String, Object> getArticleById(
            @PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        Article article = articleService.getArticleById(id);
        if (article.getCluster() != null) {
            personalizationService.incrementClusterView(article.getCluster().getId());
        }
        Long userId = jwtService.extractUserIdFromHeader(authHeader);
        return personalizationService.getEnrichedArticleDetail(article, userId);
    }

    @GetMapping("/slug/{slug}")
    public Map<String, Object> getArticleBySlug(
            @PathVariable String slug,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        Article article = articleService.getArticleBySlug(slug);
        if (article.getCluster() != null) {
            personalizationService.incrementClusterView(article.getCluster().getId());
        }
        Long userId = jwtService.extractUserIdFromHeader(authHeader);
        return personalizationService.getEnrichedArticleDetail(article, userId);
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
                    articlePage.getContent().forEach(article -> {
                        article.setCategory(categoryClassifier.classify(article.getTitle(), article.getSource()));
                        article.setLocation(locationClassifier.detectLocation(article.getTitle(), article.getDescription()));
                    });
                    articleRepository.saveAll(articlePage.getContent());
                    page++;
                } while (articlePage.hasNext());

                articleService.evictArticlesCache();
                log.info("Batch reclassification & location tagging of all articles completed successfully.");
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
        return articleService.generateNewsSitemapXml();
    }

    private boolean isAuthorizedAdmin(String headerKey, String paramKey) {
        if (adminSecret == null || adminSecret.isBlank()) return false;
        byte[] secretBytes = adminSecret.trim().getBytes(StandardCharsets.UTF_8);

        if (headerKey != null && MessageDigest.isEqual(secretBytes, headerKey.trim().getBytes(StandardCharsets.UTF_8))) {
            return true;
        }
        return paramKey != null && MessageDigest.isEqual(secretBytes, paramKey.trim().getBytes(StandardCharsets.UTF_8));
    }
}