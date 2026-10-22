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

import java.util.List;
import java.util.Objects;

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

    public SeoArticleDto getSeoDataBySlug(String slugOrId) {
        Article article;
        if (slugOrId != null && slugOrId.matches("^\\d+$")) {
            article = articleRepository.findById(Long.parseLong(slugOrId))
                    .orElseGet(() -> articleRepository.findBySlug(slugOrId)
                            .orElseThrow(() -> new RuntimeException("خبر یافت نشد")));
        } else {
            article = articleRepository.findBySlug(slugOrId)
                    .orElseThrow(() -> new RuntimeException("خبر یافت نشد"));
        }

        int score = article.getCluster() != null
                ? article.getCluster().getCredibilityScore()
                : (article.getSource() != null && article.getSource().getCredibility() != null
                ? article.getSource().getCredibility() : 50);

        String credibilityLabel = score >= 80 ? "تأیید شده" : (score >= 50 ? "در حال بررسی" : "نامعتبر");

        List<String> coveredSources;
        if (article.getCluster() != null) {
            coveredSources = articleRepository.findByCluster(article.getCluster()).stream()
                    .map(Article::getSource)
                    .filter(Objects::nonNull)
                    .map(Source::getName)
                    .filter(Objects::nonNull)
                    .distinct()
                    .toList();
        } else {
            String singleSource = article.getSource() != null ? article.getSource().getName() : "Duta";
            coveredSources = List.of(singleSource);
        }

        int sourceCount = Math.max(1, coveredSources.size());
        String canonicalSlug = (article.getSlug() != null && !article.getSlug().isBlank())
                ? article.getSlug()
                : String.valueOf(article.getId());

        String richDescription = buildRichSeoDescription(article, score, credibilityLabel, sourceCount, coveredSources);

        return SeoArticleDto.builder()
                .title(article.getTitle())
                .description(richDescription)
                .image("https://duta.ir/duta-logo.svg")
                .sourceName(article.getSource() != null ? article.getSource().getName() : "Duta")
                .category(article.getCategory() != null ? article.getCategory() : "اخبار")
                .publishedAt(article.getPublishedAt() != null ? article.getPublishedAt().toString() : "")
                .url(article.getUrl())
                .slug(canonicalSlug)
                .canonicalUrl("https://duta.ir/article/" + canonicalSlug)
                .credibilityScore(score)
                .credibilityLabel(credibilityLabel)
                .sourceCount(sourceCount)
                .breaking(article.isBreaking())
                .coveredSources(coveredSources)
                .build();
    }

    private String buildRichSeoDescription(Article article, int score, String label, int sourceCount, List<String> sources) {
        String sourcesText = String.join("، ", sources.stream().limit(4).toList());
        String credPrefix = String.format("امتیاز اعتبار: %d٪ (%s | پوشش توسط %d منبع: %s)",
                score, label, sourceCount, sourcesText);

        String baseSummary = (article.getDescription() != null && !article.getDescription().isBlank())
                ? article.getDescription().trim()
                : article.getTitle().trim();

        String combined = credPrefix + " — " + baseSummary;
        return combined.length() > 300 ? combined.substring(0, 297) + "..." : combined;
    }
}