package com.NewsGrid.V10.service;

import com.NewsGrid.V10.entity.Article;
import com.NewsGrid.V10.entity.ArticleCluster;
import com.NewsGrid.V10.repository.ArticleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ScoringService {

    private final ArticleRepository articleRepository;

    /**
     * محاسبه هوشمند امتیاز نهایی کلستر اخبار (بین ۰ تا ۱۰۰)
     * بر پایه میانگین وزنی اعتبار منابع (Credibility²) + پاداش تایید چندمنبعی مستقل
     */
    public int calculateClusterScore(ArticleCluster cluster) {
        List<Article> articles = articleRepository.findByCluster(cluster);
        if (articles.isEmpty()) return 0;

        double baseSourceQuality = calculateSourceQuality(articles);

        // شمارش تعداد منابع خبری یکتا (جلوگیری از شمارش تکراری یک منبع واحد)
        long uniqueSources = articles.stream()
                .filter(a -> a.getSource() != null && a.getSource().getId() != null)
                .map(a -> a.getSource().getId())
                .distinct()
                .count();

        if (uniqueSources <= 1) {
            return (int) Math.min(100, Math.round(baseSourceQuality));
        }

        // پاداش تایید توسط منابع مستقل متعدد (Multi-Source Verification Boost)
        double verificationBoost = calculateVerificationBoost(uniqueSources, articles);
        double finalScore = baseSourceQuality + verificationBoost;

        return (int) Math.min(100, Math.round(finalScore));
    }

    // ── ۱. کیفیت پایه منابع با فرمول وزنی Credibility² ─────────
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

    // ── ۲. پاداش تایید مستقل بر اساس تعداد منابع یکتا ───────────
    private double calculateVerificationBoost(long uniqueSources, List<Article> articles) {
        double rawBoost;
        if      (uniqueSources == 2) rawBoost =  4.0;
        else if (uniqueSources == 3) rawBoost =  8.0;
        else if (uniqueSources == 4) rawBoost = 11.0;
        else                         rawBoost = 14.0;

        // اگر حداقل ۲ منبع مستقل با اعتبار بالای ۷۵ خبر را تایید کرده باشند، ضریب کامل می‌گیرد
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