package com.NewsGrid.V10.controller;

import com.NewsGrid.V10.entity.Article;
import com.NewsGrid.V10.entity.Source;
import com.NewsGrid.V10.entity.SourceType;
import com.NewsGrid.V10.repository.ArticleRepository;
import com.NewsGrid.V10.service.ArticleService;
import com.NewsGrid.V10.service.CategoryClassifierService;
import com.NewsGrid.V10.service.RssFetcherService;
import com.NewsGrid.V10.service.TelegramScraperService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.*;

import java.util.concurrent.CompletableFuture;

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

    private static final int MAX_PAGE_SIZE = 100;

    @GetMapping("/fetch-now")
    public String fetchNow() {
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

        return "started";
    }

    @GetMapping
    public Page<Article> getAllArticles(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        int safeSize = Math.min(size, MAX_PAGE_SIZE);
        return articleService.getAllArticles(page, safeSize);
    }

    @GetMapping("/telegram")
    public Page<Article> getTelegramArticles(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        int safeSize = Math.min(size, MAX_PAGE_SIZE);
        return articleRepository.findBySourceSourceTypeOrderByPublishedAtDesc(
                SourceType.TELEGRAM,
                PageRequest.of(page, safeSize)
        );
    }

    @GetMapping("/category")
    public Page<Article> getByCategory(
            @RequestParam String name,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        int safeSize = Math.min(size, MAX_PAGE_SIZE);
        return articleService.getArticlesByCategory(name, page, safeSize);
    }

    @GetMapping("/breaking")
    public Page<Article> getBreaking(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        int safeSize = Math.min(size, MAX_PAGE_SIZE);
        return articleService.getBreakingArticles(page, safeSize);
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
        int safeSize = Math.min(size, MAX_PAGE_SIZE);
        // BUGFIX: Pass page argument correctly (3 arguments expected)
        return articleService.searchArticles(keyword, page, safeSize);
    }

    @GetMapping("/reclassify")
    public String reclassify() {
        CompletableFuture.runAsync(() -> {
            int page = 0;
            Page<Article> articlePage;

            do {
                articlePage = articleRepository.findAll(PageRequest.of(page, 100));
                articlePage.getContent().forEach(article -> {
                    article.setCategory(categoryClassifier.classify(article.getTitle(), article.getSource()));
                });
                articleRepository.saveAll(articlePage.getContent());
                page++;
            } while (articlePage.hasNext());

            log.info("Batch reclassification of all articles completed successfully.");
        });

        return "started";
    }
}