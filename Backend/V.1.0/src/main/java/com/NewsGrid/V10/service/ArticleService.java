package com.NewsGrid.V10.service;

import com.NewsGrid.V10.entity.Article;
import com.NewsGrid.V10.entity.Source;
import com.NewsGrid.V10.repository.ArticleRepository;
import com.NewsGrid.V10.repository.CategoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ArticleService {

    private final ArticleRepository articleRepository;
    private final CategoryRepository categoryRepository;

    public Page<Article> getAllArticles(int page, int size) {
        return articleRepository.findRepresentativeArticles(PageRequest.of(page, size));
    }

    public Page<Article> getArticlesByCategory(String categoryName, int page, int size) {
        return articleRepository.findRepresentativeByCategory(
                categoryName, PageRequest.of(page, size));
    }

    public Page<Article> getBreakingArticles(int page, int size) {
        return articleRepository.findRepresentativeBreaking(PageRequest.of(page, size));
    }

    public Article getArticleById(Long id) {
        return articleRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("خبر یافت نشد"));
    }

    public Article getArticleBySlug(String slug) {
        return articleRepository.findBySlug(slug)
                .orElseThrow(() -> new RuntimeException("خبر یافت نشد"));
    }

    public Source getArticleSource(Long articleId) {
        return getArticleById(articleId).getSource();
    }

    public Page<Article> searchArticles(String keyword, int page, int size) {
        return articleRepository.searchByKeyword(keyword, PageRequest.of(page, size));
    }
}