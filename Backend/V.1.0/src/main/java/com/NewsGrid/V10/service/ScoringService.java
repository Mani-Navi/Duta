package com.NewsGrid.V10.service;

import com.NewsGrid.V10.entity.Article;
import com.NewsGrid.V10.entity.ArticleCluster;
import com.NewsGrid.V10.repository.ArticleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ScoringService {

    private final ArticleRepository articleRepository;

    // وزن‌های اصلی الگوریتم بایزین
    private static final double W_SOURCE   = 0.50;
    private static final double W_COVERAGE = 0.35;
    private static final double W_FRESH    = 0.15;

    /**
     * محاسبه هوشمند امتیاز نهایی کلستر اخبار (بین ۰ تا ۱۰۰)
     */
    public int calculateClusterScore(ArticleCluster cluster) {
        List<Article> articles = articleRepository.findByCluster(cluster);
        if (articles.isEmpty()) return 0;

        double sourceQuality = calculateSourceQuality(articles);
        double coverage      = calculateCoverageScore(articles);
        double freshness     = calculateFreshnessScore(cluster.getCreatedAt());

        double total = (sourceQuality * W_SOURCE)
                + (coverage      * W_COVERAGE)
                + (freshness     * W_FRESH);

        return (int) Math.min(100, Math.round(total));
    }

    // ── ۱. Source Quality (وزن ۵۰٪ با فرمول Credibility²) ─────────
    private double calculateSourceQuality(List<Article> articles) {
        double weightedSum = 0;
        double totalWeight = 0;

        for (Article a : articles) {
            if (a.getSource() == null) continue;
            double cred   = a.getSource().getCredibility();
            double weight = cred * cred; // Credibility²
            weightedSum  += cred * weight;
            totalWeight  += weight;
        }

        if (totalWeight == 0) return 0;
        return weightedSum / totalWeight;
    }

    // ── ۲. Coverage Score (وزن ۳۵٪ با ضریب تنوع کتگوری) ───────────
    private double calculateCoverageScore(List<Article> articles) {
        int count = articles.size();

        double rawScore;
        if      (count == 1) rawScore =   0;
        else if (count == 2) rawScore =  40;
        else if (count == 3) rawScore =  65;
        else if (count == 4) rawScore =  82;
        else if (count == 5) rawScore =  92;
        else                 rawScore = 100;

        Set<String> categories = articles.stream()
                .filter(a -> a.getCategory() != null)
                .map(Article::getCategory)
                .collect(Collectors.toSet());

        double diversityMultiplier;
        if      (categories.size() >= 3) diversityMultiplier = 1.00;
        else if (categories.size() == 2) diversityMultiplier = 0.95;
        else                             diversityMultiplier = 0.85;

        return rawScore * diversityMultiplier;
    }

    // ── ۳. Freshness Score (وزن ۱۵٪ با افت زمانی UTC) ─────────────
    private double calculateFreshnessScore(ZonedDateTime createdAt) {
        if (createdAt == null) return 0;
        long hours = Duration.between(createdAt, ZonedDateTime.now(ZoneOffset.UTC)).toHours();

        if      (hours < 1)  return 100;
        else if (hours < 3)  return  80;
        else if (hours < 6)  return  60;
        else if (hours < 12) return  40;
        else if (hours < 24) return  20;
        else                 return   0;
    }
}