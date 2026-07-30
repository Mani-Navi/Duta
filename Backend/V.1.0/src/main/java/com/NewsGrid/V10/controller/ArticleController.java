package com.NewsGrid.V10.controller;

import com.NewsGrid.V10.entity.Article;
import com.NewsGrid.V10.entity.Source;
import com.NewsGrid.V10.entity.SourceType;
import com.NewsGrid.V10.repository.ArticleRepository;
import com.NewsGrid.V10.service.ArticleService;
import com.NewsGrid.V10.service.RssFetcherService;
import com.NewsGrid.V10.service.TelegramScraperService;
import com.NewsGrid.V10.service.CategoryClassifierService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.*;

import java.util.concurrent.CompletableFuture;

@RestController
@RequestMapping("/api/articles")
@RequiredArgsConstructor
public class ArticleController {

    private final ArticleService articleService;
    private final RssFetcherService rssFetcherService;
    private final TelegramScraperService telegramScraperService;
    private final ArticleRepository articleRepository;
    private final CategoryClassifierService categoryClassifier;

    @GetMapping("/fetch-now")
    public String fetchNow() {
        // اجرای پردازش در پس‌زمینه بدون معطل کردن مرورگر (جلوگیری از تایم‌اوت Railway)
        CompletableFuture.runAsync(() -> {
            try {
                System.out.println("🔄 دستی شروع شد: دریافت RSS...");
                rssFetcherService.fetchAllSources();
            } catch (Exception e) {
                System.err.println("خطا در اجرا RSS: " + e.getMessage());
            }

            try {
                System.out.println("🔄 دستی شروع شد: دریافت تلگرام...");
                telegramScraperService.fetchRecentPosts();
            } catch (Exception e) {
                System.err.println("خطا در اجرا تلگرام: " + e.getMessage());
            }
        });

        return "started";
    }

    @GetMapping
    public Page<Article> getAllArticles(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return articleService.getAllArticles(page, size);
    }

    @GetMapping("/telegram")
    public Page<Article> getTelegramArticles(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return articleRepository.findBySourceSourceTypeOrderByPublishedAtDesc(
                SourceType.TELEGRAM,
                PageRequest.of(page, size)
        );
    }

    // جدید — با نام کتگوری فارسی
    @GetMapping("/category")
    public Page<Article> getByCategory(
            @RequestParam String name,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return articleService.getArticlesByCategory(name, page, size);
    }

    @GetMapping("/breaking")
    public Page<Article> getBreaking(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return articleService.getBreakingArticles(page, size);
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
        return articleService.searchArticles(keyword, page, size);
    }

    @GetMapping("/reclassify")
    public String reclassify() {
        articleRepository.findAll().forEach(article -> {
            article.setCategory(categoryClassifier.classify(article.getTitle()));
            articleRepository.save(article);
        });
        return "done";
    }
}