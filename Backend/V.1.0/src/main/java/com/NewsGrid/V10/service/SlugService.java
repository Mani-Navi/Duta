package com.NewsGrid.V10.service;

import com.NewsGrid.V10.repository.ArticleRepository;
import org.springframework.stereotype.Service;

@Service
public class SlugService {

    // کاراکترهای فارسی که باید با - جدا بشن
    public String generateSlug(String title, ArticleRepository articleRepository) {
        if (title == null || title.isBlank()) return "article";

        String slug = title
                // حذف نشانه‌های نگارشی فارسی و انگلیسی
                .replaceAll("[،؛؟!٪«»()\\[\\]،:.؛،\"'،،]", "")
                .replaceAll("[^\\p{L}\\p{N}\\s-]", "")
                // فاصله‌ها به -
                .trim()
                .replaceAll("\\s+", "-")
                // چند - پشت هم به یکی
                .replaceAll("-+", "-")
                // حداکثر ۸۰ کاراکتر
                .substring(0, Math.min(80, title.length()));

        // اگه slug تکراری بود، id رو اضافه کن
        String base = slug;
        int counter = 1;
        while (articleRepository.existsBySlug(slug)) {
            slug = base + "-" + counter++;
        }

        return slug;
    }
}