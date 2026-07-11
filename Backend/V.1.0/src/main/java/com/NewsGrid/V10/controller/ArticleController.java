package com.NewsGrid.V10.controller;

import com.NewsGrid.V10.service.RssFetcherService;
import com.NewsGrid.V10.entity.Article;
import com.NewsGrid.V10.entity.Source;
import com.NewsGrid.V10.service.ArticleService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/articles")
@RequiredArgsConstructor
public class ArticleController {

    private final ArticleService articleService;
    private final RssFetcherService rssFetcherService;

    @GetMapping("/fetch-now")
    public String fetchNow() {
        rssFetcherService.fetchAllSources();
        return "done";
    }

    // همه اخبار با pagination
    @GetMapping
    public Page<Article> getAllArticles(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return articleService.getAllArticles(page, size);
    }

    // اخبار یه کتگوری با pagination
    @GetMapping("/category/{categoryId}")
    public Page<Article> getByCategory(
            @PathVariable Long categoryId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return articleService.getArticlesByCategory(categoryId, page, size);
    }

    // جزئیات یه خبر
    @GetMapping("/{id}")
    public Article getArticleById(@PathVariable Long id) {
        return articleService.getArticleById(id);
    }

    // منبع یه خبر
    @GetMapping("/{id}/source")
    public Source getArticleSource(@PathVariable Long id) {
        return articleService.getArticleSource(id);
    }
}