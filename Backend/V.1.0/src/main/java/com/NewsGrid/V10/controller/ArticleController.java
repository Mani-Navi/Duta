package com.NewsGrid.V10.controller;

import com.NewsGrid.V10.repository.ArticleRepository;
import com.NewsGrid.V10.service.RssFetcherService;
import com.NewsGrid.V10.entity.Article;
import com.NewsGrid.V10.entity.Source;
import com.NewsGrid.V10.service.ArticleService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.*;
import com.NewsGrid.V10.entity.SourceType;
import org.springframework.data.domain.PageRequest;

@RestController
@RequestMapping("/api/articles")
@RequiredArgsConstructor
public class ArticleController {

    private final ArticleService articleService;
    private final RssFetcherService rssFetcherService;
    private final ArticleRepository articleRepository;

    @GetMapping("/fetch-now")
    public String fetchNow() {
        rssFetcherService.fetchAllSources();
        return "done";
    }

    @GetMapping
    public Page<Article> getAllArticles(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return articleService.getAllArticles(page, size);
    }

    @GetMapping("/category/{categoryId}")
    public Page<Article> getByCategory(
            @PathVariable Long categoryId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return articleService.getArticlesByCategory(categoryId, page, size);
    }

    @GetMapping("/breaking")
    public Page<Article> getBreaking(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return articleService.getBreakingArticles(page, size);
    }

    // دریافت خبر با ID
    @GetMapping("/{id}")
    public Article getArticleById(@PathVariable Long id) {
        return articleService.getArticleById(id);
    }

    // دریافت خبر با slug ← برای React Router
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

    // دریافت اخبار اختصاصی تلگرام
    @GetMapping("/telegram")
    public Page<Article> getTelegramArticles(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return articleRepository.findBySourceSourceTypeOrderByPublishedAtDesc(
                SourceType.TELEGRAM,
                PageRequest.of(page, size)
        );
    }
}