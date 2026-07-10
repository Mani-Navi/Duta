package com.NewsGrid.V10.service;

import com.NewsGrid.V10.entity.Article;
import com.NewsGrid.V10.entity.Category;
import com.NewsGrid.V10.entity.Source;
import com.NewsGrid.V10.repository.ArticleRepository;
import com.NewsGrid.V10.repository.CategoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ArticleService {

    private final ArticleRepository articleRepository;
    private final CategoryRepository categoryRepository;

    // راهکار ۳ — Pagination
    public Page<Article> getAllArticles(int page, int size) {
        return articleRepository.findAll(
                PageRequest.of(page, size,
                        Sort.by(Sort.Direction.DESC, "publishedAt"))
        );
    }

    public Page<Article> getArticlesByCategory(Long categoryId, int page, int size) {
        Category category = categoryRepository
                .findById(categoryId)
                .orElseThrow(() ->
                        new RuntimeException("کتگوری یافت نشد"));
        return articleRepository.findBySource_Category(
                category,
                PageRequest.of(page, size,
                        Sort.by(Sort.Direction.DESC, "publishedAt"))
        );
    }

    public Article getArticleById(Long id) {
        return articleRepository
                .findById(id)
                .orElseThrow(() ->
                        new RuntimeException("خبر یافت نشد"));
    }

    public Source getArticleSource(Long articleId) {
        Article article = getArticleById(articleId);
        return article.getSource();
    }
}