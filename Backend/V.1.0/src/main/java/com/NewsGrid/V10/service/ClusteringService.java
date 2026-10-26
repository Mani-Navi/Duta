package com.NewsGrid.V10.service;

import com.NewsGrid.V10.entity.Article;
import com.NewsGrid.V10.entity.ArticleCluster;
import com.NewsGrid.V10.repository.ArticleClusterRepository;
import com.NewsGrid.V10.repository.ArticleRepository;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Groups related news articles into clusters using Jaccard Similarity (>= 25% overlap)
 * within a 6-hour sliding window.
 * SCALE-02 FIX: Acquires lock outside TransactionTemplate so DB commits complete BEFORE releasing lock to next thread.
 */
@Service
@RequiredArgsConstructor
public class ClusteringService {

    private final ArticleClusterRepository clusterRepository;
    private final ArticleRepository articleRepository;
    private final ScoringService scoringService;
    private final TransactionTemplate transactionTemplate;

    private final Object clusterLock = new Object();

    private static final double SIMILARITY_THRESHOLD = 0.25;
    private static final int CLUSTER_WINDOW_HOURS = 6;

    private static final Pattern CLEAN_PATTERN = Pattern.compile("[،.؟!٪«»()\\[\\]،:؛\"'\\-_/+]");

    private static final Set<String> STOP_WORDS = Set.of(
            "و", "در", "به", "از", "که", "این", "را", "با", "است", "آن",
            "یک", "های", "برای", "یا", "اما", "تا", "هم", "می",
            "شد", "شده", "کرد", "کرده", "خود", "ها", "هر", "بر", "نیز",
            "پس", "اگر", "بود", "بودن", "شدن", "کردن", "داشت", "داشتن",
            "روی", "زیر", "بین", "چند", "دارد", "شود", "کند", "گفت",
            "the", "a", "an", "in", "of", "to", "and", "is", "was"
    );

    private final Cache<String, Set<String>> tokenCache = Caffeine.newBuilder()
            .maximumSize(2000)
            .expireAfterWrite(6, TimeUnit.HOURS)
            .build();

    public void clusterArticle(Article article) {
        Set<String> newTokens = tokenize(article.getTitle());

        synchronized (clusterLock) {
            transactionTemplate.executeWithoutResult(status -> {
                ZonedDateTime since = ZonedDateTime.now(ZoneOffset.UTC).minusHours(CLUSTER_WINDOW_HOURS);
                List<ArticleCluster> recentClusters = clusterRepository.findByCreatedAtAfter(since);

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
                    addToCluster(article, bestCluster);
                } else {
                    createNewCluster(article);
                }
            });
        }
    }

    private void addToCluster(Article article, ArticleCluster cluster) {
        article.setCluster(cluster);
        articleRepository.save(article);

        List<Article> clusterArticles = articleRepository.findByCluster(cluster);
        long uniqueSourceCount = clusterArticles.stream()
                .filter(a -> a.getSource() != null && a.getSource().getId() != null)
                .map(a -> a.getSource().getId())
                .distinct()
                .count();

        cluster.setSourceCount((int) Math.max(1, uniqueSourceCount));
        cluster.setUpdatedAt(ZonedDateTime.now(ZoneOffset.UTC));

        clusterArticles.stream()
                .filter(a -> a.getSource() != null && a.getSource().getCredibility() != null)
                .max(Comparator.comparingInt(a -> a.getSource().getCredibility()))
                .ifPresent(bestArticle -> cluster.setRepresentativeTitle(bestArticle.getTitle()));

        cluster.setCredibilityScore(scoringService.calculateClusterScore(cluster, clusterArticles));
        clusterRepository.save(cluster);
    }

    private void createNewCluster(Article article) {
        ArticleCluster cluster = new ArticleCluster();
        cluster.setRepresentativeTitle(article.getTitle());
        cluster.setCredibilityScore(
                article.getSource() != null && article.getSource().getCredibility() != null
                        ? article.getSource().getCredibility()
                        : 50
        );
        cluster.setSourceCount(1);
        cluster.setCreatedAt(ZonedDateTime.now(ZoneOffset.UTC));
        cluster.setUpdatedAt(ZonedDateTime.now(ZoneOffset.UTC));

        cluster = clusterRepository.save(cluster);

        article.setCluster(cluster);
        articleRepository.save(article);
    }

    private double jaccardSimilarity(Set<String> a, Set<String> b) {
        if (a.isEmpty() || b.isEmpty()) return 0;

        int intersectionSize = 0;
        for (String token : a) {
            if (b.contains(token)) {
                intersectionSize++;
            }
        }
        if (intersectionSize == 0) return 0;

        int unionSize = a.size() + b.size() - intersectionSize;
        return (double) intersectionSize / unionSize;
    }

    private Set<String> tokenize(String text) {
        if (text == null || text.isBlank()) return Collections.emptySet();
        return tokenCache.get(text, this::computeTokens);
    }

    private Set<String> computeTokens(String text) {
        String normalized = text.toLowerCase(Locale.ROOT)
                .replace('ي', 'ی')
                .replace('ك', 'ک')
                .replace('\u200C', ' ');

        return Collections.unmodifiableSet(
                Arrays.stream(CLEAN_PATTERN.matcher(normalized).replaceAll(" ").split("\\s+"))
                        .map(String::trim)
                        .filter(w -> w.length() > 1)
                        .filter(w -> !STOP_WORDS.contains(w))
                        .collect(Collectors.toSet())
        );
    }
}