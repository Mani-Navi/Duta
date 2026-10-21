package com.NewsGrid.V10.service;

import com.NewsGrid.V10.Dto.SeoArticleDto;
import com.NewsGrid.V10.entity.Article;
import com.NewsGrid.V10.entity.Source;
import com.NewsGrid.V10.repository.ArticleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ArticleService {

    private final ArticleRepository articleRepository;

    @Cacheable(value = "articles", key = "#page + '-' + #size")
    public Page<Article> getAllArticles(int page, int size) {
        return articleRepository.findRepresentativeArticles(PageRequest.of(page, size));
    }

    @Cacheable(value = "articles", key = "'cat-' + #categoryName + '-' + #page + '-' + #size")
    public Page<Article> getArticlesByCategory(String categoryName, int page, int size) {
        return articleRepository.findRepresentativeByCategory(
                categoryName, PageRequest.of(page, size));
    }

    @Cacheable(value = "articles", key = "'breaking-' + #page + '-' + #size")
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
        if (keyword == null || keyword.isBlank()) {
            return Page.empty(PageRequest.of(page, size));
        }

        // FIXED: Normalize Persian chars and escape POSIX regex special characters to prevent SQL regex errors
        String cleanKeyword = keyword.trim()
                .replace('ي', 'ی')
                .replace('ك', 'ک')
                .replaceAll("([\\\\.*+?^${}()|\\[\\]])", "\\\\$1");

        return articleRepository.searchByKeyword(cleanKeyword, PageRequest.of(page, size));
    }

    @CacheEvict(value = "articles", allEntries = true)
    public void evictArticlesCache() {
        // Automatically cleared by Spring
    }

    public SeoArticleDto getSeoDataBySlug(String slug) {
        Article article = articleRepository.findBySlug(slug)
                .orElseThrow(() -> new RuntimeException("خبر یافت نشد"));

        String metaDescription = (article.getDescription() != null && !article.getDescription().isBlank())
                ? article.getDescription()
                : article.getTitle();

        return SeoArticleDto.builder()
                .title(article.getTitle())
                .description(metaDescription)
                .sourceName(article.getSource() != null ? article.getSource().getName() : "Duta")
                .category(article.getCategory())
                .publishedAt(article.getPublishedAt() != null ? article.getPublishedAt().toString() : "")
                .url(article.getUrl())
                .build();
    }
}