package com.NewsGrid.V10.service;

import com.NewsGrid.V10.repository.ArticleRepository;
import org.springframework.stereotype.Service;

@Service
public class SlugService {

    public synchronized String generateSlug(String title, ArticleRepository articleRepository) {
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
        int counter = 1;
        while (articleRepository.existsBySlug(slug)) {
            slug = base + "-" + counter++;
        }

        return slug;
    }
}