package com.NewsGrid.V10.service;

import com.NewsGrid.V10.entity.Source;
import com.NewsGrid.V10.entity.User;
import com.NewsGrid.V10.logging.DutaLogger;
import com.NewsGrid.V10.logging.LogEvent;
import com.NewsGrid.V10.repository.SourceRepository;
import com.NewsGrid.V10.repository.UserRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Manages user authentication, cached personalization profiles, cascading onboarding catalog,
 * and in-place behavioral interest aggregation (~200B per user with zero row growth).
 */
@Service
@RequiredArgsConstructor
public class UserService {

    private static final DutaLogger logger = DutaLogger.of(UserService.class);

    private final UserRepository userRepository;
    private final SourceRepository sourceRepository;
    private final JwtService jwtService;
    private final ObjectMapper objectMapper;

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder(10);

    private static final int MAX_HIDDEN_CLUSTERS_FIFO = 50;
    private static final int MAX_INTEREST_KEYS = 40;

    private static final List<String> IRAN_CITIES = List.of(
            "تهران", "شیراز", "اصفهان", "مشهد", "تبریز", "کرج", "اهواز", "رشت",
            "قم", "کرمانشاه", "ارومیه", "یزد", "کرمان", "همدان", "بندرعباس", "ساری", "بوشهر", "زنجان", "قزوین", "اردبیل"
    );

    @Transactional
    public Map<String, Object> register(String email, String password, String displayName, String locationCity,
                                        List<String> favoriteCategories, List<String> followedSources) {
        if (email == null || !email.contains("@") || password == null || password.length() < 6) {
            throw new RuntimeException("ایمیل معتبر و رمز عبور حداقل ۶ کاراکتری الزامی است");
        }

        String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);
        if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new RuntimeException("این ایمیل قبلاً ثبت شده است");
        }

        User user = new User();
        user.setEmail(normalizedEmail);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setDisplayName(displayName != null && !displayName.isBlank()
                ? displayName.trim()
                : normalizedEmail.split("@")[0]);
        user.setLocationCity(locationCity != null && !locationCity.isBlank() ? locationCity.trim() : null);
        user.setFavoriteCategories(toJson(favoriteCategories != null ? favoriteCategories : List.of()));
        user.setFollowedSources(toJson(followedSources != null ? followedSources : List.of()));
        user.setMutedSources("[]");
        user.setHiddenClusterIds("[]");
        user.setPinnedTickers("[\"usd\",\"gold18\"]");
        user.setInterestScores("{}");

        user = userRepository.save(user);
        String token = jwtService.generateToken(user.getId(), user.getEmail());

        logger.info(LogEvent.AUTH_SUCCESS, "New user registered", "userId", user.getId(), "email", user.getEmail());

        return Map.of(
                "token", token,
                "user", buildProfileMap(user)
        );
    }

    @Transactional(readOnly = true)
    public Map<String, Object> login(String email, String password) {
        if (email == null || password == null) {
            throw new RuntimeException("ایمیل و رمز عبور الزامی است");
        }

        User user = userRepository.findByEmailIgnoreCase(email.trim().toLowerCase(Locale.ROOT))
                .orElseThrow(() -> new RuntimeException("ایمیل یا رمز عبور اشتباه است"));

        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            logger.warn(LogEvent.AUTH_FAILED, "Invalid password attempt", "email", email);
            throw new RuntimeException("ایمیل یا رمز عبور اشتباه است");
        }

        String token = jwtService.generateToken(user.getId(), user.getEmail());
        logger.info(LogEvent.AUTH_SUCCESS, "User logged in", "userId", user.getId());

        return Map.of(
                "token", token,
                "user", buildProfileMap(user)
        );
    }

    @Cacheable(value = "user_profiles", key = "#userId")
    @Transactional(readOnly = true)
    public Map<String, Object> getCachedUserProfile(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("کاربر یافت نشد"));
        return buildProfileMap(user);
    }

    @CacheEvict(value = "user_profiles", key = "#userId")
    @Transactional
    public Map<String, Object> updatePreferences(Long userId,
                                                 String displayName,
                                                 String locationCity,
                                                 List<String> favoriteCategories,
                                                 List<String> followedSources,
                                                 List<String> mutedSources,
                                                 List<String> pinnedTickers) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("کاربر یافت نشد"));

        if (displayName != null && !displayName.isBlank()) {
            user.setDisplayName(displayName.trim());
        }
        if (locationCity != null) {
            user.setLocationCity(locationCity.isBlank() ? null : locationCity.trim());
        }
        if (favoriteCategories != null) {
            user.setFavoriteCategories(toJson(favoriteCategories));
        }
        if (followedSources != null) {
            user.setFollowedSources(toJson(followedSources));
        }
        if (mutedSources != null) {
            user.setMutedSources(toJson(mutedSources));
        }
        if (pinnedTickers != null && !pinnedTickers.isEmpty()) {
            user.setPinnedTickers(toJson(pinnedTickers));
        }

        user = userRepository.save(user);
        return buildProfileMap(user);
    }

    /**
     * UCS-009: Records positive meaningful engagement (+1 dwell, +3 source click/reaction, +4 share)
     * or negative feedback (-25 topic block, source mute, or cluster hide) IN-PLACE without adding DB rows.
     */
    @CacheEvict(value = "user_profiles", key = "#userId")
    @Transactional
    public Map<String, Object> recordEngagementOrFeedback(Long userId,
                                                          String actionType,
                                                          String category,
                                                          String sourceName,
                                                          Long clusterId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("کاربر یافت نشد"));

        Map<String, Integer> scores = new LinkedHashMap<>(parseScoreMap(user.getInterestScores()));

        switch (actionType != null ? actionType.toUpperCase(Locale.ROOT) : "") {
            case "SOURCE_CLICK", "POSITIVE_REACTION" -> {
                adjustScore(scores, "cat:" + category, 3);
                adjustScore(scores, "src:" + sourceName, 3);
            }
            case "SHARE" -> {
                adjustScore(scores, "cat:" + category, 4);
                adjustScore(scores, "src:" + sourceName, 4);
            }
            case "QUALIFIED_READ" -> {
                adjustScore(scores, "cat:" + category, 1);
                adjustScore(scores, "src:" + sourceName, 1);
            }
            case "DISLIKE_TOPIC" -> {
                if (category != null && !category.isBlank()) {
                    scores.put("cat:" + category, -25);
                    List<String> favCats = new ArrayList<>(parseStringList(user.getFavoriteCategories()));
                    favCats.remove(category);
                    user.setFavoriteCategories(toJson(favCats));
                }
            }
            case "MUTE_SOURCE" -> {
                if (sourceName != null && !sourceName.isBlank()) {
                    List<String> muted = new ArrayList<>(parseStringList(user.getMutedSources()));
                    if (!muted.contains(sourceName)) muted.add(sourceName);
                    user.setMutedSources(toJson(muted));

                    List<String> followed = new ArrayList<>(parseStringList(user.getFollowedSources()));
                    followed.remove(sourceName);
                    user.setFollowedSources(toJson(followed));
                }
            }
            case "UNMUTE_SOURCE" -> {
                if (sourceName != null && !sourceName.isBlank()) {
                    List<String> muted = new ArrayList<>(parseStringList(user.getMutedSources()));
                    muted.remove(sourceName);
                    user.setMutedSources(toJson(muted));
                }
            }
            case "HIDE_CLUSTER" -> {
                if (clusterId != null) {
                    List<Long> hidden = new ArrayList<>(parseLongList(user.getHiddenClusterIds()));
                    hidden.remove(clusterId);
                    hidden.add(clusterId);
                    // FIFO Bound: keep only last 50 hidden cluster IDs
                    if (hidden.size() > MAX_HIDDEN_CLUSTERS_FIFO) {
                        hidden = hidden.subList(hidden.size() - MAX_HIDDEN_CLUSTERS_FIFO, hidden.size());
                    }
                    user.setHiddenClusterIds(toJson(hidden));
                }
            }
        }

        // Bound interestScores map to top 40 entries so JSON stays ~200 bytes forever
        if (scores.size() > MAX_INTEREST_KEYS) {
            scores = scores.entrySet().stream()
                    .sorted((a, b) -> Integer.compare(Math.abs(b.getValue()), Math.abs(a.getValue())))
                    .limit(MAX_INTEREST_KEYS)
                    .collect(Collectors.toMap(
                            Map.Entry::getKey,
                            Map.Entry::getValue,
                            (a, b) -> a,
                            LinkedHashMap::new
                    ));
        }

        user.setInterestScores(toJson(scores));
        user = userRepository.save(user);
        return buildProfileMap(user);
    }

    /**
     * UCS-007: Builds the 3-layer cascading onboarding catalog (Categories -> Specialized Sources -> Similar Sources)
     * directly from the active sources table sorted by credibility.
     */
    @Cacheable(value = "categories", key = "'discovery_catalog'")
    @Transactional(readOnly = true)
    public Map<String, Object> getDiscoveryCatalog() {
        List<Source> allSources = sourceRepository.findAll().stream()
                .sorted(Comparator.comparingInt((Source s) -> s.getCredibility() != null ? s.getCredibility() : 0).reversed())
                .toList();

        Map<String, List<Map<String, Object>>> sourcesByCategory = new LinkedHashMap<>();
        List<String> mainCategories = List.of("اقتصادی", "تکنولوژی", "سیاسی", "ورزشی", "جهانی", "سرگرمی");
        mainCategories.forEach(c -> sourcesByCategory.put(c, new ArrayList<>()));

        for (Source s : allSources) {
            String catName = (s.getCategory() != null && s.getCategory().getNameFa() != null)
                    ? s.getCategory().getNameFa()
                    : "سیاسی";
            sourcesByCategory.computeIfAbsent(catName, k -> new ArrayList<>()).add(Map.of(
                    "id", s.getId(),
                    "name", s.getName(),
                    "credibility", s.getCredibility() != null ? s.getCredibility() : 75,
                    "initials", s.getInitials() != null ? s.getInitials() : s.getName().substring(0, Math.min(2, s.getName().length())),
                    "color", s.getColor() != null ? s.getColor() : "#007AFF",
                    "category", catName
            ));
        }

        return Map.of(
                "cities", IRAN_CITIES,
                "categories", mainCategories,
                "sourcesByCategory", sourcesByCategory
        );
    }

    private void adjustScore(Map<String, Integer> scores, String key, int delta) {
        if (key == null || key.endsWith(":null") || key.endsWith(":")) return;
        int current = scores.getOrDefault(key, 0);
        // If user previously explicitly blocked a topic (-25), don't auto-boost it from accidental reads
        if (current <= -20 && delta > 0) return;
        scores.put(key, Math.min(100, current + delta));
    }

    public Map<String, Object> buildProfileMap(User user) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", user.getId());
        map.put("email", user.getEmail());
        map.put("displayName", user.getDisplayName());
        map.put("locationCity", user.getLocationCity());
        map.put("favoriteCategories", parseStringList(user.getFavoriteCategories()));
        map.put("followedSources", parseStringList(user.getFollowedSources()));
        map.put("mutedSources", parseStringList(user.getMutedSources()));
        map.put("hiddenClusterIds", parseLongList(user.getHiddenClusterIds()));
        map.put("pinnedTickers", parseStringList(user.getPinnedTickers()));
        map.put("interestScores", parseScoreMap(user.getInterestScores()));
        return map;
    }

    public List<String> parseStringList(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    public List<Long> parseLongList(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return objectMapper.readValue(json, new TypeReference<List<Long>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    public Map<String, Integer> parseScoreMap(String json) {
        if (json == null || json.isBlank()) return Map.of();
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, Integer>>() {});
        } catch (Exception e) {
            return Map.of();
        }
    }

    private String toJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            return "[]";
        }
    }
}