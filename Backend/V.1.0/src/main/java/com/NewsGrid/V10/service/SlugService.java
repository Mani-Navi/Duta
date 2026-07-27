package com.NewsGrid.V10.service;

import com.NewsGrid.V10.repository.ArticleRepository;
import org.springframework.stereotype.Service;

@Service
public class SlugService {

    public String generateSlug(String title, ArticleRepository articleRepository) {
        if (title == null || title.isBlank()) return "article";

        String slug = title
                .replaceAll("[،؛؟!٪«»()\\[\\]،:.؛،\"'،،]", "")
                .replaceAll("[^\\p{L}\\p{N}\\s-]", "")
                .trim()
                .replaceAll("\\s+", "-")
                .replaceAll("-+", "-");

        // ── باگ برطرف شد: چک کردن طول خود slug به جای title ──
        if (slug.length() > 80) {
            slug = slug.substring(0, 80);
        }

        if (slug.isBlank()) slug = "article";

        String base = slug;
        int counter = 1;
        while (articleRepository.existsBySlug(slug)) {
            slug = base + "-" + counter++;
        }

        return slug;
    }
}