package com.NewsGrid.V10.service;

import com.NewsGrid.V10.entity.Article;
import com.NewsGrid.V10.entity.ArticleCluster;
import com.NewsGrid.V10.entity.ArticleReaction;
import com.NewsGrid.V10.repository.ArticleClusterRepository;
import com.NewsGrid.V10.repository.ArticleReactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.LongAdder;

/**
 * UCS-008, UCS-009, UCS-011: In-memory personalization engine, Hot News ranker, and cluster reaction manager.
 * Computes user-specific feeds in < 0.5ms from the cached representative article pool with zero DB JOINs.
 */
@Service
@RequiredArgsConstructor
public class PersonalizationService {

    private final ArticleService articleService;
    private final UserService userService;
    private final ArticleClusterRepository clusterRepository;
    private final ArticleReactionRepository reactionRepository;

    private static final int IMPLICIT_INTEREST_THRESHOLD = 15;
    private static final int DISCOVERY_CREDIBILITY_MIN = 82;

    // SCALE-01 FIX: Lock-free in-memory view counter buffer to prevent DB row-lock storms during viral news spikes
    private final ConcurrentHashMap<Long, LongAdder> pendingClusterViews = new ConcurrentHashMap<>();

    /**
     * UCS-008: Returns the top 4 Hot News of the Day (last 24h) ranked by engagement, multi-source coverage, and freshness.
     */
    @Cacheable(value = "hot_articles", key = "'top4'")
    @Transactional(readOnly = true)
    public List<Article> getHotArticlesOfTheDay() {
        List<Article> pool = articleService.getRecentRepresentativePool();
        ZonedDateTime now = ZonedDateTime.now(ZoneOffset.UTC);
        ZonedDateTime cutoff24h = now.minusHours(24);

        return pool.stream()
                .filter(a -> a.getPublishedAt() != null && a.getPublishedAt().isAfter(cutoff24h))
                .sorted((a, b) -> Double.compare(calculateLiveHotScore(b, now), calculateLiveHotScore(a, now)))
                .limit(4)
                .toList();
    }

    /**
     * UCS-008 & UCS-011: Generates the 85% Preference + 15% Discovery personalized feed in RAM (< 0.5ms).
     */
    @Transactional(readOnly = true)
    public Page<Map<String, Object>> getPersonalizedFeed(Long userId, int page, int size) {
        Map<String, Object> profile = userService.getCachedUserProfile(userId);
        List<Article> pool = articleService.getRecentRepresentativePool();

        String userCity = (String) profile.get("locationCity");
        Set<String> favCategories = new HashSet<>((List<String>) profile.getOrDefault("favoriteCategories", List.of()));
        Set<String> followedSources = new HashSet<>((List<String>) profile.getOrDefault("followedSources", List.of()));
        Set<String> mutedSources = new HashSet<>((List<String>) profile.getOrDefault("mutedSources", List.of()));
        Set<Long> hiddenClusters = new HashSet<>((List<Long>) profile.getOrDefault("hiddenClusterIds", List.of()));
        Map<String, Integer> interestScores = (Map<String, Integer>) profile.getOrDefault("interestScores", Map.of());

        boolean isColdStart = favCategories.isEmpty() && followedSources.isEmpty() && (userCity == null || userCity.isBlank());

        List<ScoredArticle> matchedPool = new ArrayList<>();
        List<ScoredArticle> discoveryPool = new ArrayList<>();
        ZonedDateTime now = ZonedDateTime.now(ZoneOffset.UTC);

        for (Article a : pool) {
            String srcName = a.getSource() != null ? a.getSource().getName() : "";
            Long clusterId = a.getCluster() != null ? a.getCluster().getId() : null;
            String cat = a.getCategory() != null ? a.getCategory() : "سیاسی";

            if (mutedSources.contains(srcName)) continue;
            if (clusterId != null && hiddenClusters.contains(clusterId)) continue;
            if (interestScores.getOrDefault("cat:" + cat, 0) <= -20) continue;

            int cred = a.getCluster() != null
                    ? a.getCluster().getCredibilityScore()
                    : (a.getSource() != null && a.getSource().getCredibility() != null ? a.getSource().getCredibility() : 50);

            long ageHours = a.getPublishedAt() != null
                    ? Math.max(0, Duration.between(a.getPublishedAt(), now).toHours())
                    : 6;
            double recencyBonus = Math.max(0, 24.0 - ageHours) * 0.8;

            boolean isFollowedSource = followedSources.contains(srcName);
            boolean isFavCategory = favCategories.contains(cat);
            int learnedCatScore = interestScores.getOrDefault("cat:" + cat, 0);
            int learnedSrcScore = interestScores.getOrDefault("src:" + srcName, 0);
            boolean isLearnedInterest = (learnedCatScore >= IMPLICIT_INTEREST_THRESHOLD) || (learnedSrcScore >= IMPLICIT_INTEREST_THRESHOLD);
            boolean isCityMatch = (userCity != null && !userCity.isBlank() && userCity.equals(a.getLocation()));

            double score = (cred * 0.25) + recencyBonus;
            String reasonType = null;
            String reasonLabel = null;

            if (isFollowedSource) {
                score += 55;
                reasonType = "source";
                reasonLabel = "منبع دنبال‌شده · " + srcName;
            }
            if (isFavCategory) {
                score += 32;
                if (reasonLabel == null) {
                    reasonType = "category";
                    reasonLabel = "حوزه انتخابی · " + cat;
                }
            }
            if (isLearnedInterest) {
                score += Math.min(25, (learnedCatScore + learnedSrcScore) * 0.6);
                if (reasonLabel == null) {
                    reasonType = "ai";
                    reasonLabel = "پیشنهاد بر اساس مطالعات شما · " + cat;
                }
            }

            // UCS-011 Rule 1: Contextual City Boost Matrix
            if (isCityMatch) {
                boolean isCivicOrPreferred = isFavCategory || isFollowedSource || isLearnedInterest
                        || a.isBreaking() || "اقتصادی".equals(cat) || "سیاسی".equals(cat);
                if (isCivicOrPreferred) {
                    score += 42;
                    reasonType = "local";
                    reasonLabel = "خبر محلی · " + userCity;
                } else {
                    score += 10;
                }
            }

            if (isColdStart) {
                if (cred >= 75) {
                    matchedPool.add(new ScoredArticle(a, score, "ai", "منتخب معتبر · " + cat));
                }
            } else if (reasonType != null) {
                matchedPool.add(new ScoredArticle(a, score, reasonType, reasonLabel));
            } else if (cred >= DISCOVERY_CREDIBILITY_MIN) {
                discoveryPool.add(new ScoredArticle(a, score, "discovery", "پیشنهاد از سایر حوزه‌ها · " + cat));
            }
        }

        matchedPool.sort((x, y) -> Double.compare(y.score, x.score));
        discoveryPool.sort((x, y) -> Double.compare(y.score, x.score));

        List<ScoredArticle> combined = new ArrayList<>();
        int mIdx = 0, dIdx = 0;
        while (mIdx < matchedPool.size() || dIdx < discoveryPool.size()) {
            for (int i = 0; i < 5 && mIdx < matchedPool.size(); i++) {
                combined.add(matchedPool.get(mIdx++));
            }
            if (dIdx < discoveryPool.size()) {
                combined.add(discoveryPool.get(dIdx++));
            } else if (mIdx < matchedPool.size()) {
                combined.add(matchedPool.get(mIdx++));
            }
        }

        int start = Math.min(page * size, combined.size());
        int end = Math.min(start + size, combined.size());
        List<ScoredArticle> pageSlice = combined.subList(start, end);

        Map<Long, String> userReactionsMap = getUserReactionsForSlice(userId, pageSlice);

        List<Map<String, Object>> content = pageSlice.stream()
                .map(sa -> toEnrichedArticleMap(sa.article, sa.reasonType, sa.reasonLabel, userReactionsMap))
                .toList();

        return new PageImpl<>(content, PageRequest.of(page, size), combined.size());
    }

    /**
     * UCS-008: Newspaper Tab ("روزنامه") — shows general news outside the user's strict filter bubble.
     */
    @Transactional(readOnly = true)
    public Page<Map<String, Object>> getNewspaperFeed(Long userId, String category, int page, int size) {
        Page<Article> rawPage = (category != null && !category.isBlank() && !"all".equalsIgnoreCase(category))
                ? ("breaking".equalsIgnoreCase(category)
                ? articleService.getBreakingArticles(page, size)
                : articleService.getArticlesByCategory(category, page, size))
                : articleService.getAllArticles(page, size);

        Map<Long, String> userReactions = new HashMap<>();
        if (userId != null) {
            List<Long> clusterIds = rawPage.getContent().stream()
                    .map(Article::getCluster)
                    .filter(Objects::nonNull)
                    .map(ArticleCluster::getId)
                    .filter(Objects::nonNull)
                    .toList();
            if (!clusterIds.isEmpty()) {
                reactionRepository.findByUserIdAndClusterIdIn(userId, clusterIds)
                        .forEach(r -> userReactions.put(r.getClusterId(), r.getReactionType()));
            }
        }

        List<Map<String, Object>> enriched = rawPage.getContent().stream()
                .map(a -> toEnrichedArticleMap(a, null, null, userReactions))
                .toList();

        return new PageImpl<>(enriched, rawPage.getPageable(), rawPage.getTotalElements());
    }

    /**
     * BUG-05 FIX: Enriches a single Article with the logged-in user's active reaction without mutating cached entities.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getEnrichedArticleDetail(Article article, Long userId) {
        Map<Long, String> userReactions = Map.of();
        Long cid = article.getCluster() != null ? article.getCluster().getId() : null;
        if (userId != null && cid != null) {
            Optional<ArticleReaction> reactionOpt = reactionRepository.findByUserIdAndClusterId(userId, cid);
            if (reactionOpt.isPresent()) {
                userReactions = Map.of(cid, reactionOpt.get().getReactionType());
            }
        }
        return toEnrichedArticleMap(article, null, null, userReactions);
    }

    /**
     * UCS-009 & BUG-02 FIX: Updates reaction in DB and patches in-memory cached cluster counters in-place
     * without wiping the global articles/sitemap/seo caches!
     */
    @CacheEvict(value = "hot_articles", allEntries = true)
    @Transactional
    public Map<String, Object> toggleReaction(Long userId, Long clusterId, String reactionType) {
        String normalizedType = reactionType != null ? reactionType.trim().toUpperCase(Locale.ROOT) : "";
        if (!Set.of("LIKE", "HOT", "DOUBT").contains(normalizedType)) {
            throw new RuntimeException("نوع بازخورد نامعتبر است");
        }

        ArticleCluster cluster = clusterRepository.findById(clusterId)
                .orElseThrow(() -> new RuntimeException("کلستر یافت نشد"));

        Optional<ArticleReaction> existingOpt = reactionRepository.findByUserIdAndClusterId(userId, clusterId);
        String activeUserReaction = null;

        if (existingOpt.isPresent()) {
            ArticleReaction existing = existingOpt.get();
            decrementCounter(cluster, existing.getReactionType());

            if (existing.getReactionType().equals(normalizedType)) {
                reactionRepository.delete(existing);
            } else {
                existing.setReactionType(normalizedType);
                reactionRepository.save(existing);
                incrementCounter(cluster, normalizedType);
                activeUserReaction = normalizedType;
            }
        } else {
            ArticleReaction nr = new ArticleReaction();
            nr.setUserId(userId);
            nr.setClusterId(clusterId);
            nr.setReactionType(normalizedType);
            reactionRepository.save(nr);
            incrementCounter(cluster, normalizedType);
            activeUserReaction = normalizedType;

            if ("LIKE".equals(normalizedType) || "HOT".equals(normalizedType)) {
                List<Article> clusterArticles = articleService.getClusterArticles(clusterId);
                if (!clusterArticles.isEmpty()) {
                    Article rep = clusterArticles.get(0);
                    String srcName = rep.getSource() != null ? rep.getSource().getName() : null;
                    userService.recordEngagementOrFeedback(userId, "POSITIVE_REACTION", rep.getCategory(), srcName, clusterId);
                }
            }
        }

        cluster.setHotScore(calculateClusterHotScore(cluster));
        clusterRepository.save(cluster);

        // Patch in-memory cached cluster counters in-place (0ms, zero cache thrashing!)
        syncCachedClusterCountersInPlace(cluster);

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("clusterId", cluster.getId());
        res.put("likeCount", cluster.getLikeCount());
        res.put("hotCount", cluster.getHotCount());
        res.put("doubtCount", cluster.getDoubtCount());
        res.put("userReaction", activeUserReaction);
        return res;
    }

    /**
     * SCALE-01 FIX: Non-blocking O(1) in-memory view counter increment.
     */
    public void incrementClusterView(Long clusterId) {
        if (clusterId == null) return;
        pendingClusterViews.computeIfAbsent(clusterId, k -> new LongAdder()).increment();
    }

    public void incrementClusterViewAsync(Long clusterId) {
        incrementClusterView(clusterId);
    }

    /**
     * SCALE-01 FIX: Flushes accumulated view counts to PostgreSQL in batch every 60 seconds.
     */
    @Scheduled(fixedRate = 60000)
    @Transactional
    public void flushPendingClusterViews() {
        if (pendingClusterViews.isEmpty()) return;

        Map<Long, Long> snapshot = new HashMap<>();
        for (Long clusterId : new ArrayList<>(pendingClusterViews.keySet())) {
            LongAdder adder = pendingClusterViews.remove(clusterId);
            if (adder != null) {
                long delta = adder.sum();
                if (delta > 0) {
                    snapshot.put(clusterId, delta);
                }
            }
        }

        if (snapshot.isEmpty()) return;

        List<ArticleCluster> clusters = clusterRepository.findAllById(snapshot.keySet());
        for (ArticleCluster c : clusters) {
            long delta = snapshot.getOrDefault(c.getId(), 0L);
            if (delta > 0) {
                c.setViewCount((int) Math.min(Integer.MAX_VALUE, c.getViewCount() + delta));
                c.setHotScore(calculateClusterHotScore(c));
            }
        }
        clusterRepository.saveAll(clusters);
    }

    private void syncCachedClusterCountersInPlace(ArticleCluster updated) {
        try {
            List<Article> pool = articleService.getRecentRepresentativePool();
            for (Article a : pool) {
                if (a.getCluster() != null && Objects.equals(a.getCluster().getId(), updated.getId())) {
                    a.getCluster().setLikeCount(updated.getLikeCount());
                    a.getCluster().setHotCount(updated.getHotCount());
                    a.getCluster().setDoubtCount(updated.getDoubtCount());
                    a.getCluster().setHotScore(updated.getHotScore());
                }
            }
        } catch (Exception ignored) {}
    }

    private void incrementCounter(ArticleCluster c, String type) {
        switch (type) {
            case "LIKE" -> c.setLikeCount(c.getLikeCount() + 1);
            case "HOT" -> c.setHotCount(c.getHotCount() + 1);
            case "DOUBT" -> c.setDoubtCount(c.getDoubtCount() + 1);
        }
    }

    private void decrementCounter(ArticleCluster c, String type) {
        switch (type) {
            case "LIKE" -> c.setLikeCount(Math.max(0, c.getLikeCount() - 1));
            case "HOT" -> c.setHotCount(Math.max(0, c.getHotCount() - 1));
            case "DOUBT" -> c.setDoubtCount(Math.max(0, c.getDoubtCount() - 1));
        }
    }

    public double calculateClusterHotScore(ArticleCluster c) {
        long hours = c.getCreatedAt() != null
                ? Math.max(0, Duration.between(c.getCreatedAt(), ZonedDateTime.now(ZoneOffset.UTC)).toHours())
                : 1;
        int totalReactions = c.getLikeCount() + c.getHotCount() + c.getDoubtCount();
        double raw = (c.getViewCount() * 1.0)
                + (totalReactions * 6.0)
                + (c.getSourceCount() * 10.0)
                + (c.getCredibilityScore() * 0.15);
        return raw / Math.pow(hours + 2.0, 1.4);
    }

    private double calculateLiveHotScore(Article a, ZonedDateTime now) {
        long hours = a.getPublishedAt() != null
                ? Math.max(0, Duration.between(a.getPublishedAt(), now).toHours())
                : 2;
        ArticleCluster c = a.getCluster();
        int views = c != null ? c.getViewCount() : 0;
        int reactions = c != null ? (c.getLikeCount() + c.getHotCount() + c.getDoubtCount()) : 0;
        int sources = c != null ? c.getSourceCount() : 1;
        int cred = c != null ? c.getCredibilityScore() : (a.getSource() != null && a.getSource().getCredibility() != null ? a.getSource().getCredibility() : 50);
        double breakingBoost = a.isBreaking() ? 20.0 : 0.0;

        double raw = (views * 1.0) + (reactions * 6.0) + (sources * 10.0) + breakingBoost + (cred * 0.15);
        return raw / Math.pow(hours + 2.0, 1.4);
    }

    private Map<Long, String> getUserReactionsForSlice(Long userId, List<ScoredArticle> slice) {
        if (userId == null || slice.isEmpty()) return Map.of();
        List<Long> clusterIds = slice.stream()
                .map(sa -> sa.article.getCluster() != null ? sa.article.getCluster().getId() : null)
                .filter(Objects::nonNull)
                .toList();
        if (clusterIds.isEmpty()) return Map.of();

        Map<Long, String> map = new HashMap<>();
        reactionRepository.findByUserIdAndClusterIdIn(userId, clusterIds)
                .forEach(r -> map.put(r.getClusterId(), r.getReactionType()));
        return map;
    }

    private Map<String, Object> toEnrichedArticleMap(Article a, String reasonType, String reasonLabel, Map<Long, String> userReactions) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", a.getId());
        map.put("title", a.getTitle());
        map.put("description", a.getDescription());
        map.put("url", a.getUrl());
        map.put("publishedAt", a.getPublishedAt());
        map.put("breaking", a.isBreaking());
        map.put("slug", a.getSlug());
        map.put("category", a.getCategory());
        map.put("location", a.getLocation());
        map.put("source", a.getSource());
        map.put("cluster", a.getCluster());
        if (reasonType != null) {
            map.put("reasonType", reasonType);
            map.put("reasonLabel", reasonLabel);
        }
        Long cid = a.getCluster() != null ? a.getCluster().getId() : null;
        map.put("userReaction", cid != null ? userReactions.get(cid) : null);
        return map;
    }

    private record ScoredArticle(Article article, double score, String reasonType, String reasonLabel) {}
}