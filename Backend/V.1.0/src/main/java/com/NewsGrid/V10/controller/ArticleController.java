package com.NewsGrid.V10.controller;

import com.NewsGrid.V10.entity.Article;
import com.NewsGrid.V10.entity.Source;
import com.NewsGrid.V10.entity.SourceType;
import com.NewsGrid.V10.repository.ArticleRepository;
import com.NewsGrid.V10.service.*;
import com.NewsGrid.V10.Dto.SeoArticleDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.concurrent.CompletableFuture;

@Slf4j
@RestController
@RequestMapping("/api/articles")
@RequiredArgsConstructor
public class ArticleController {

    private final ArticleService articleService;
    private final RssFetcherService rssFetcherService;
    private final TelegramScraperService telegramScraperService;
    private final ArticleRepository articleRepository;
    private final CategoryClassifierService categoryClassifier;

    private static final int MAX_PAGE_SIZE = 100;

    @GetMapping("/fetch-now")
    public String fetchNow() {
        CompletableFuture.runAsync(() -> {
            try {
                log.info("Manual fetch triggered: Fetching RSS sources...");
                rssFetcherService.fetchAllSources();
            } catch (Exception e) {
                log.error("Error during manual RSS fetch: {}", e.getMessage());
            }

            try {
                log.info("Manual fetch triggered: Fetching Telegram channels...");
                telegramScraperService.fetchRecentPosts();
            } catch (Exception e) {
                log.error("Error during manual Telegram fetch: {}", e.getMessage());
            }
        });

        return "started";
    }

    @GetMapping
    public Page<Article> getAllArticles(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        int safeSize = Math.min(size, MAX_PAGE_SIZE);
        return articleService.getAllArticles(page, safeSize);
    }

    @GetMapping("/telegram")
    public Page<Article> getTelegramArticles(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        int safeSize = Math.min(size, MAX_PAGE_SIZE);
        return articleRepository.findBySourceSourceTypeOrderByPublishedAtDesc(
                SourceType.TELEGRAM,
                PageRequest.of(page, safeSize)
        );
    }

    @GetMapping("/category")
    public Page<Article> getByCategory(
            @RequestParam String name,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        int safeSize = Math.min(size, MAX_PAGE_SIZE);
        return articleService.getArticlesByCategory(name, page, safeSize);
    }

    @GetMapping("/breaking")
    public Page<Article> getBreaking(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        int safeSize = Math.min(size, MAX_PAGE_SIZE);
        return articleService.getBreakingArticles(page, safeSize);
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
        int safeSize = Math.min(size, MAX_PAGE_SIZE);
        // BUGFIX: Pass page argument correctly (3 arguments expected)
        return articleService.searchArticles(keyword, page, safeSize);
    }

    @GetMapping("/reclassify")
    public String reclassify() {
        CompletableFuture.runAsync(() -> {
            int page = 0;
            Page<Article> articlePage;

            do {
                articlePage = articleRepository.findAll(PageRequest.of(page, 100));
                articlePage.getContent().forEach(article -> {
                    article.setCategory(categoryClassifier.classify(article.getTitle(), article.getSource()));
                });
                articleRepository.saveAll(articlePage.getContent());
                page++;
            } while (articlePage.hasNext());

            log.info("Batch reclassification of all articles completed successfully.");
        });

        return "started";
    }

    // ۱. اندپوینت مخصوص سرویس Prerender
    @GetMapping("/seo/{slug}")
    public SeoArticleDto getSeoArticle(@PathVariable String slug) {
        return articleService.getSeoDataBySlug(slug);
    }

    // ۲. اندپوینت تولید سایت‌مپ خبر (Google News Sitemap)
    @GetMapping(value = "/sitemap.xml", produces = "application/xml")
    public String getNewsSitemap() {
        List<Article> recentArticles = articleRepository.findTop1000ByOrderByPublishedAtDesc();
        StringBuilder xml = new StringBuilder();
        xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        xml.append("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\" ");
        xml.append("xmlns:news=\"http://www.google.com/schemas/sitemap-news/0.9\">\n");

        for (Article a : recentArticles) {
            xml.append("  <url>\n");
            xml.append("    <loc>http://109.122.250.5/article/").append(a.getSlug()).append("</loc>\n");
            xml.append("    <news:news>\n");
            xml.append("      <news:publication>\n");
            xml.append("        <news:name>Duta News</news:name>\n");
            xml.append("        <news:language>fa</news:language>\n");
            xml.append("      </news:publication>\n");
            xml.append("      <news:publication_date>").append(a.getPublishedAt().toInstant()).append("</news:publication_date>\n");
            xml.append("      <news:title>").append(a.getTitle().replace("&", "&amp;")).append("</news:title>\n");
            xml.append("    </news:news>\n");
            xml.append("  </url>\n");
        }
        xml.append("</urlset>");
        return xml.toString();
    }
}