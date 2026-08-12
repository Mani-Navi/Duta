package com.NewsGrid.V10.service;

import com.NewsGrid.V10.entity.Article;
import com.NewsGrid.V10.entity.Source;
import com.NewsGrid.V10.repository.ArticleRepository;
import com.NewsGrid.V10.Dto.SeoArticleDto;
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

    // OPTIMIZED: Cache first page of representative articles for 0ms ultra-fast response
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
        return articleRepository.searchByKeyword(keyword, PageRequest.of(page, size));
    }

    // Evict articles cache when new news is scraped
    @CacheEvict(value = "articles", allEntries = true)
    public void evictArticlesCache() {
        // Automatically cleared by Spring
    }

    public SeoArticleDto getSeoDataBySlug(String slug) {
        Article article = articleRepository.findBySlug(slug)
                .orElseThrow(() -> new RuntimeException("خبر یافت نشد"));

        return SeoArticleDto.builder()
                .title(article.getTitle())
                .description(article.getTitle()) // فعلاً چون متن نداریم، تیتر را قرار می‌دهیم
                .sourceName(article.getSource().getName())
                .category(article.getCategory())
                .publishedAt(article.getPublishedAt().toString())
                .url(article.getUrl())
                .build();
    }
}