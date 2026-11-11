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
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ArticleService {

    private final ArticleRepository articleRepository;

    @Cacheable(value = "articles", key = "'all-' + #page + '-' + #size")
    public Page<Article> getAllArticles(int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<Long> idPage = articleRepository.findRepresentativeArticleIds(pageable);
        return hydrateArticlePage(idPage, pageable);
    }

    /**
     * SCALE-04 & BUG-03 FIX: 500-article in-memory pool hydrated with zero N+1 queries.
     */
    @Cacheable(value = "articles", key = "'pool-recent-500'")
    public List<Article> getRecentRepresentativePool() {
        Page<Long> idPage = articleRepository.findRepresentativeArticleIds(PageRequest.of(0, 500));
        if (idPage.isEmpty()) return List.of();
        return articleRepository.findByIdInWithDetails(idPage.getContent());
    }

    @Cacheable(value = "articles", key = "'cat-' + #categoryName + '-' + #page + '-' + #size")
    public Page<Article> getArticlesByCategory(String categoryName, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<Long> idPage = articleRepository.findRepresentativeIdsByCategory(categoryName, pageable);
        return hydrateArticlePage(idPage, pageable);
    }

    @Cacheable(value = "articles", key = "'breaking-' + #page + '-' + #size")
    public Page<Article> getBreakingArticles(int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<Long> idPage = articleRepository.findRepresentativeIdsBreaking(pageable);
        return hydrateArticlePage(idPage, pageable);
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
        Pageable pageable = PageRequest.of(page, size);
        if (keyword == null || keyword.isBlank()) {
            return Page.empty(pageable);
        }

        String cleanKeyword = keyword.trim()
                .replace('ي', 'ی')
                .replace('ك', 'ک')
                .replaceAll("([\\\\.*+?^${}()|\\[\\]])", "\\\\$1");

        Page<Long> idPage = articleRepository.searchRepresentativeIdsByKeyword(cleanKeyword, pageable);
        return hydrateArticlePage(idPage, pageable);
    }

    private Page<Article> hydrateArticlePage(Page<Long> idPage, Pageable pageable) {
        if (idPage.isEmpty()) {
            return Page.empty(pageable);
        }
        List<Article> hydrated = articleRepository.findByIdInWithDetails(idPage.getContent());
        return new PageImpl<>(hydrated, pageable, idPage.getTotalElements());
    }

    @Caching(evict = {
            @CacheEvict(value = "articles", allEntries = true),
            @CacheEvict(value = "article_detail", allEntries = true),
            @CacheEvict(value = "clusters", allEntries = true),
            @CacheEvict(value = "seo", allEntries = true),
            @CacheEvict(value = "sitemap", allEntries = true),
            @CacheEvict(value = "hot_articles", allEntries = true)
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
     * UCS-014: Official Duta RSS 2.0 Feed enriched with <duta:*> credibility & cluster metadata for @Duta_News Bot.
     */
    @Cacheable(value = "sitemap", key = "'rss-xml'")
    public String generateRssFeedXml() {
        List<Article> pool = getRecentRepresentativePool();
        List<Article> latest = pool.stream().limit(60).toList();
        ZonedDateTime now = ZonedDateTime.now(ZoneOffset.UTC);

        StringBuilder rss = new StringBuilder(131_072);
        rss.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        rss.append("<rss version=\"2.0\" xmlns:duta=\"https://duta.ir/ns\" xmlns:atom=\"http://www.w3.org/2005/Atom\">\n");
        rss.append("  <channel>\n");
        rss.append("    <title>Duta — دو نگاه، یک حقیقت</title>\n");
        rss.append("    <link>https://duta.ir</link>\n");
        rss.append("    <description>پلتفرم هوشمند تجمیع، خوشه‌بندی و سنجش اعتبار اخبار فارسی</description>\n");
        rss.append("    <language>fa-IR</language>\n");
        rss.append("    <atom:link href=\"https://duta.ir/api/articles/rss.xml\" rel=\"self\" type=\"application/rss+xml\"/>\n");
        rss.append("    <lastBuildDate>").append(DateTimeFormatter.RFC_1123_DATE_TIME.format(now)).append("</lastBuildDate>\n");

        for (Article a : latest) {
            int score = a.getCluster() != null
                    ? a.getCluster().getCredibilityScore()
                    : (a.getSource() != null && a.getSource().getCredibility() != null ? a.getSource().getCredibility() : 50);
            int sourceCount = a.getCluster() != null ? Math.max(1, a.getCluster().getSourceCount()) : 1;
            Long clusterId = a.getCluster() != null ? a.getCluster().getId() : a.getId();
            String srcName = a.getSource() != null && a.getSource().getName() != null ? a.getSource().getName() : "Duta";
            String srcColor = a.getSource() != null && a.getSource().getColor() != null ? a.getSource().getColor() : "#007AFF";
            String srcInitials = a.getSource() != null && a.getSource().getInitials() != null
                    ? a.getSource().getInitials()
                    : srcName.substring(0, Math.min(2, srcName.length()));
            String category = a.getCategory() != null ? a.getCategory() : "سیاسی";
            String shortUrl = "https://duta.ir/c/" + a.getId();
            String rawSlug = (a.getSlug() != null && !a.getSlug().isBlank()) ? a.getSlug() : String.valueOf(a.getId());
            String canonicalUrl = "https://duta.ir/article/" + URLEncoder.encode(rawSlug, StandardCharsets.UTF_8);
            ZonedDateTime pubDate = a.getPublishedAt() != null ? a.getPublishedAt() : now;
            String summary = (a.getDescription() != null && !a.getDescription().isBlank())
                    ? a.getDescription()
                    : a.getTitle();

            rss.append("    <item>\n");
            rss.append("      <title>").append(escapeXml(a.getTitle())).append("</title>\n");
            rss.append("      <link>").append(shortUrl).append("</link>\n");
            rss.append("      <guid isPermaLink=\"true\">").append(escapeXml(canonicalUrl)).append("</guid>\n");
            rss.append("      <pubDate>").append(DateTimeFormatter.RFC_1123_DATE_TIME.format(pubDate)).append("</pubDate>\n");
            rss.append("      <category>").append(escapeXml(category)).append("</category>\n");
            rss.append("      <description>").append(escapeXml(summary)).append("</description>\n");
            rss.append("      <duta:articleId>").append(a.getId()).append("</duta:articleId>\n");
            rss.append("      <duta:clusterId>").append(clusterId).append("</duta:clusterId>\n");
            rss.append("      <duta:slug>").append(escapeXml(rawSlug)).append("</duta:slug>\n");
            rss.append("      <duta:shortUrl>").append(shortUrl).append("</duta:shortUrl>\n");
            rss.append("      <duta:credibilityScore>").append(score).append("</duta:credibilityScore>\n");
            rss.append("      <duta:sourceCount>").append(sourceCount).append("</duta:sourceCount>\n");
            rss.append("      <duta:breaking>").append(a.isBreaking()).append("</duta:breaking>\n");
            rss.append("      <duta:sourceName>").append(escapeXml(srcName)).append("</duta:sourceName>\n");
            rss.append("      <duta:sourceColor>").append(escapeXml(srcColor)).append("</duta:sourceColor>\n");
            rss.append("      <duta:sourceInitials>").append(escapeXml(srcInitials)).append("</duta:sourceInitials>\n");
            if (a.getLocation() != null && !a.getLocation().isBlank()) {
                rss.append("      <duta:location>").append(escapeXml(a.getLocation())).append("</duta:location>\n");
            }
            rss.append("    </item>\n");
        }

        rss.append("  </channel>\n");
        rss.append("</rss>");
        return rss.toString();
    }

    @Cacheable(value = "sitemap", key = "'xml'")
    public String generateNewsSitemapXml() {
        List<Article> recentArticles = articleRepository.findRecentForSitemap(PageRequest.of(0, 1000));
        ZonedDateTime now = ZonedDateTime.now(ZoneOffset.UTC);
        ZonedDateTime googleNewsCutoff = now.minusHours(48);

        StringBuilder xml = new StringBuilder(262_144);
        xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        xml.append("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\" ");
        xml.append("xmlns:news=\"http://www.google.com/schemas/sitemap-news/0.9\">\n");

        appendStaticUrl(xml, "https://duta.ir/", "always", "1.0");
        appendStaticUrl(xml, "https://duta.ir/tablo", "always", "0.9");
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