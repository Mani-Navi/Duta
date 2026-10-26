package com.NewsGrid.V10.service;

import com.NewsGrid.V10.repository.ArticleRepository;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

@Service
public class SlugService {

    private final Object slugCollisionLock = new Object();

    // SCALE-02 FIX: In-memory LRU slug cache to avoid redundant DB queries and global lock contention
    private final Cache<String, Boolean> recentSlugsCache = Caffeine.newBuilder()
            .maximumSize(5000)
            .expireAfterWrite(24, TimeUnit.HOURS)
            .build();

    public String generateSlug(String title, ArticleRepository articleRepository) {
        if (title == null || title.isBlank()) return "article-" + System.currentTimeMillis();

        String slug = title
                .replace('ي', 'ی')
                .replace('ك', 'ک')
                .replace('\u200C', '-')
                .replaceAll("[،؛؟!٪«»()\\[\\]،:.؛\"'،،]", "")
                .replaceAll("[^\\p{L}\\p{N}\\s-]", "")
                .trim()
                .replaceAll("\\s+", "-")
                .replaceAll("-+", "-")
                .replaceAll("^-|-$", "");

        if (slug.length() > 80) {
            int lastDash = slug.substring(0, 80).lastIndexOf('-');
            slug = (lastDash > 20) ? slug.substring(0, lastDash) : slug.substring(0, 80);
        }

        slug = slug.replaceAll("^-|-$", "");
        if (slug.isBlank()) slug = "article";

        String base = slug;
        synchronized (slugCollisionLock) {
            int counter = 1;
            while (recentSlugsCache.getIfPresent(slug) != null || articleRepository.existsBySlug(slug)) {
                recentSlugsCache.put(slug, Boolean.TRUE);
                slug = base + "-" + counter++;
            }
            recentSlugsCache.put(slug, Boolean.TRUE);
            return slug;
        }
    }
}