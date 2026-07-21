package com.NewsGrid.V10.service;

import com.NewsGrid.V10.entity.Article;
import com.NewsGrid.V10.entity.ArticleCluster;
import com.NewsGrid.V10.repository.ArticleClusterRepository;
import com.NewsGrid.V10.repository.ArticleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.ZonedDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ClusteringService {

    private final ArticleClusterRepository clusterRepository;
    private final ArticleRepository articleRepository;

    // آستانه similarity برای تشخیص خبر مشابه
    private static final double SIMILARITY_THRESHOLD = 0.25;

    // بازه زمانی مقایسه — ۶ ساعت
    private static final int CLUSTER_WINDOW_HOURS = 6;

    // stop words فارسی
    private static final Set<String> STOP_WORDS = Set.of(
            "و", "در", "به", "از", "که", "این", "را", "با", "است", "آن",
            "یک", "های", "برای", "یا", "اما", "تا", "هم", "می",
            "شد", "شده", "کرد", "کرده", "خود", "ها", "هر", "بر", "نیز",
            "پس", "اگر", "بود", "بودن", "شدن", "کردن", "داشت", "داشتن",
            "the", "a", "an", "in", "of", "to", "and", "is", "was"
    );

    @Transactional
    public void clusterArticle(Article article) {
        // cluster های ۶ ساعت اخیر رو بگیر
        ZonedDateTime since = ZonedDateTime.now().minusHours(CLUSTER_WINDOW_HOURS);
        List<ArticleCluster> recentClusters = clusterRepository.findByCreatedAtAfter(since);

        // توکن‌های عنوان خبر جدید
        Set<String> newTokens = tokenize(article.getTitle());

        // بهترین cluster رو پیدا کن
        ArticleCluster bestCluster = null;
        double bestSimilarity = 0;

        for (ArticleCluster cluster : recentClusters) {
            Set<String> clusterTokens = tokenize(cluster.getRepresentativeTitle());
            double similarity = jaccardSimilarity(newTokens, clusterTokens);

            if (similarity > bestSimilarity && similarity >= SIMILARITY_THRESHOLD) {
                bestSimilarity = similarity;
                bestCluster = cluster;
            }
        }

        if (bestCluster != null) {
            // به cluster موجود اضافه کن
            addToCluster(article, bestCluster);
        } else {
            // cluster جدید بساز
            createNewCluster(article);
        }
    }

    private void addToCluster(Article article, ArticleCluster cluster) {
        article.setCluster(cluster);
        articleRepository.save(article);

        // تعداد منابع رو بروز کن
        cluster.setSourceCount(cluster.getSourceCount() + 1);
        cluster.setUpdatedAt(ZonedDateTime.now());

        // اگه منبع این خبر معتبرتره، تیتر رو عوض کن
        int newCredibility = article.getSource().getCredibility();
        if (newCredibility > cluster.getCredibilityScore()) {
            cluster.setRepresentativeTitle(article.getTitle());
        }

        // امتیاز رو بروز کن
        cluster.setCredibilityScore(calculateScore(cluster));
        clusterRepository.save(cluster);
    }

    private void createNewCluster(Article article) {
        ArticleCluster cluster = new ArticleCluster();
        cluster.setRepresentativeTitle(article.getTitle());
        cluster.setCredibilityScore(article.getSource().getCredibility());
        cluster.setSourceCount(1);
        cluster.setCreatedAt(ZonedDateTime.now());
        cluster.setUpdatedAt(ZonedDateTime.now());

        cluster = clusterRepository.save(cluster);

        article.setCluster(cluster);
        articleRepository.save(article);
    }

    private int calculateScore(ArticleCluster cluster) {
        List<Article> articles = articleRepository.findByCluster(cluster);

        if (articles.isEmpty()) return 0;

        // میانگین وزنی:
        // ۶۰% — بالاترین credibility منبع
        // ۳۰% — امتیاز تعداد منابع (هر منبع اضافه +۱۰، max 30)
        // ۱۰% — تازگی خبر

        int maxCredibility = articles.stream()
                .mapToInt(a -> a.getSource().getCredibility())
                .max()
                .orElse(0);

        int sourceBonus = Math.min(30, (cluster.getSourceCount() - 1) * 10);

        // تازگی — اگه زیر ۲ ساعت باشه ۱۰ امتیاز، وگرنه ۰
        long hoursOld = java.time.Duration.between(
                cluster.getCreatedAt(), ZonedDateTime.now()
        ).toHours();
        int freshnessScore = hoursOld < 2 ? 10 : 0;

        int total = (int)(maxCredibility * 0.6) + sourceBonus + freshnessScore;
        return Math.min(100, total);
    }

    // ── Jaccard Similarity ──────────────────────────────
    private double jaccardSimilarity(Set<String> a, Set<String> b) {
        if (a.isEmpty() || b.isEmpty()) return 0;

        Set<String> intersection = new HashSet<>(a);
        intersection.retainAll(b);

        Set<String> union = new HashSet<>(a);
        union.addAll(b);

        return (double) intersection.size() / union.size();
    }

    private Set<String> tokenize(String text) {
        if (text == null) return Collections.emptySet();
        return Arrays.stream(text
                        .replaceAll("[،.؟!٪«»()\\[\\]،:؛]", " ")
                        .split("\\s+"))
                .map(String::trim)
                .filter(w -> w.length() > 1)
                .filter(w -> !STOP_WORDS.contains(w))
                .collect(Collectors.toSet());
    }
}