package com.NewsGrid.V10.service;

import com.NewsGrid.V10.Dto.SeoArticleDto;
import com.NewsGrid.V10.entity.Article;
import com.NewsGrid.V10.entity.Source;
import com.NewsGrid.V10.repository.ArticleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Objects;

/**
 * Core domain service for querying articles, clusters, SEO metadata, and XML sitemaps.
 * Utilizes multi-region Caffeine caching to serve viral traffic with zero database bottlenecks.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ArticleService {

    private final ArticleRepository articleRepository;

    @Cacheable(value = "articles", key = "'all-' + #page + '-' + #size")
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

    @Cacheable(value = "article_detail", key = "'id-' + #id")
    public Article getArticleById(Long id) {
        return articleRepository.findByIdWithDetails(id)
                .orElseThrow(() -> new RuntimeException("خبر یافت نشد"));
    }

    @Cacheable(value = "article_detail", key = "'slug-' + #slug")
    public Article getArticleBySlug(String slug) {
        return articleRepository.findBySlug(slug)
                .orElseThrow(() -> new RuntimeException("خبر یافت نشد"));
    }

    @Cacheable(value = "clusters", key = "#clusterId")
    public List<Article> getClusterArticles(Long clusterId) {
        List<Article> articles = articleRepository.findByClusterIdWithSources(clusterId);
        if (articles.isEmpty()) {
            throw new RuntimeException("کلستر یافت نشد");
        }
        return articles;
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

    /**
     * Evicts all article-related caches when new RSS items are ingested or reclassified.
     */
    @Caching(evict = {
            @CacheEvict(value = "articles", allEntries = true),
            @CacheEvict(value = "article_detail", allEntries = true),
            @CacheEvict(value = "clusters", allEntries = true),
            @CacheEvict(value = "seo", allEntries = true),
            @CacheEvict(value = "sitemap", allEntries = true)
    })
    public void evictArticlesCache() {
        // Automatically cleared by Spring Cache abstraction
    }

    @Cacheable(value = "seo", key = "#slugOrId")
    public SeoArticleDto getSeoDataBySlug(String slugOrId) {
        Article article;
        if (slugOrId != null && slugOrId.matches("^\\d+$")) {
            article = articleRepository.findByIdWithDetails(Long.parseLong(slugOrId))
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
        if (article.getCluster() != null && article.getCluster().getId() != null) {
            coveredSources = articleRepository.findByClusterIdWithSources(article.getCluster().getId()).stream()
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

    /**
     * Generates and caches the hybrid Google News (48h) + Web Sitemap XML.
     * Prevents repeated 1,000-row DB queries and 785KB string allocations on concurrent bot crawls.
     */
    @Cacheable(value = "sitemap", key = "'xml'")
    public String generateNewsSitemapXml() {
        List<Article> recentArticles = articleRepository.findTop1000ByOrderByPublishedAtDesc();
        ZonedDateTime now = ZonedDateTime.now(ZoneOffset.UTC);
        ZonedDateTime googleNewsCutoff = now.minusHours(48);

        StringBuilder xml = new StringBuilder(262_144); // Pre-sized buffer (256KB) to avoid array resizing
        xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        xml.append("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\" ");
        xml.append("xmlns:news=\"http://www.google.com/schemas/sitemap-news/0.9\">\n");

        appendStaticUrl(xml, "https://duta.ir/", "always", "1.0");
        appendStaticUrl(xml, "https://duta.ir/features", "monthly", "0.8");
        appendStaticUrl(xml, "https://duta.ir/credibility", "monthly", "0.8");
        appendStaticUrl(xml, "https://duta.ir/about", "monthly", "0.7");
        appendStaticUrl(xml, "https://duta.ir/privacy", "yearly", "0.5");
        appendStaticUrl(xml, "https://duta.ir/terms", "yearly", "0.5");

        for (Article a : recentArticles) {
            String rawSlug = (a.getSlug() != null && !a.getSlug().isBlank())
                    ? a.getSlug()
                    : String.valueOf(a.getId());
            String encodedSlug = URLEncoder.encode(rawSlug, StandardCharsets.UTF_8);
            ZonedDateTime pubDate = a.getPublishedAt() != null ? a.getPublishedAt() : now;

            xml.append("  <url>\n");
            xml.append("    <loc>https://duta.ir/article/").append(escapeXml(encodedSlug)).append("</loc>\n");
            xml.append("    <lastmod>").append(pubDate.toInstant()).append("</lastmod>\n");

            if (pubDate.isAfter(googleNewsCutoff)) {
                xml.append("    <news:news>\n");
                xml.append("      <news:publication>\n");
                xml.append("        <news:name>Duta</news:name>\n");
                xml.append("        <news:language>fa</news:language>\n");
                xml.append("      </news:publication>\n");
                xml.append("      <news:publication_date>").append(pubDate.toInstant()).append("</news:publication_date>\n");
                xml.append("      <news:title>").append(escapeXml(a.getTitle())).append("</news:title>\n");
                xml.append("    </news:news>\n");
            } else {
                xml.append("    <changefreq>weekly</changefreq>\n");
                xml.append("    <priority>0.7</priority>\n");
            }

            xml.append("  </url>\n");
        }
        xml.append("</urlset>");
        return xml.toString();
    }

    private void appendStaticUrl(StringBuilder xml, String loc, String changefreq, String priority) {
        xml.append("  <url>\n");
        xml.append("    <loc>").append(loc).append("</loc>\n");
        xml.append("    <changefreq>").append(changefreq).append("</changefreq>\n");
        xml.append("    <priority>").append(priority).append("</priority>\n");
        xml.append("  </url>\n");
    }

    private String escapeXml(String input) {
        if (input == null) return "";
        return input.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
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