package com.NewsGrid.V10.service;

import com.NewsGrid.V10.entity.Article;
import com.NewsGrid.V10.entity.ArticleCluster;
import com.NewsGrid.V10.repository.ArticleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Bayesian-inspired credibility scoring engine for news clusters.
 */
@Service
@RequiredArgsConstructor
public class ScoringService {

    private final ArticleRepository articleRepository;

    public int calculateClusterScore(ArticleCluster cluster) {
        List<Article> articles = articleRepository.findByCluster(cluster);
        return calculateClusterScore(cluster, articles);
    }

    public int calculateClusterScore(ArticleCluster cluster, List<Article> articles) {
        if (articles == null || articles.isEmpty()) return 0;

        double baseSourceQuality = calculateSourceQuality(articles);

        long uniqueSources = articles.stream()
                .filter(a -> a.getSource() != null && a.getSource().getId() != null)
                .map(a -> a.getSource().getId())
                .distinct()
                .count();

        if (uniqueSources <= 1) {
            return (int) Math.min(100, Math.round(baseSourceQuality));
        }

        double verificationBoost = calculateVerificationBoost(uniqueSources, articles);
        double finalScore = baseSourceQuality + verificationBoost;

        return (int) Math.min(100, Math.round(finalScore));
    }

    private double calculateSourceQuality(List<Article> articles) {
        double weightedSum = 0;
        double totalWeight = 0;

        for (Article a : articles) {
            if (a.getSource() == null || a.getSource().getCredibility() == null) continue;
            double cred   = a.getSource().getCredibility();
            double weight = cred * cred;
            weightedSum  += cred * weight;
            totalWeight  += weight;
        }

        if (totalWeight == 0) return 50;
        return weightedSum / totalWeight;
    }

    private double calculateVerificationBoost(long uniqueSources, List<Article> articles) {
        double rawBoost;
        if      (uniqueSources == 2) rawBoost =  4.0;
        else if (uniqueSources == 3) rawBoost =  8.0;
        else if (uniqueSources == 4) rawBoost = 11.0;
        else                         rawBoost = 14.0;

        long highCredSources = articles.stream()
                .filter(a -> a.getSource() != null && a.getSource().getId() != null)
                .filter(a -> a.getSource().getCredibility() != null && a.getSource().getCredibility() >= 75)
                .map(a -> a.getSource().getId())
                .distinct()
                .count();

        double trustMultiplier = (highCredSources >= 2) ? 1.0 : (highCredSources == 1 ? 0.85 : 0.6);
        return rawBoost * trustMultiplier;
    }
}