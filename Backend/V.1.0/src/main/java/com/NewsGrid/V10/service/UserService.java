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
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserService {

    private static final DutaLogger logger = DutaLogger.of(UserService.class);

    private final UserRepository userRepository;
    private final SourceRepository sourceRepository;
    private final JwtService jwtService;
    private final ObjectMapper objectMapper;

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final int PBKDF2_ITERATIONS = 65536;
    private static final int KEY_LENGTH = 256;

    private static final int MAX_HIDDEN_CLUSTERS_FIFO = 50;
    private static final int MAX_INTEREST_KEYS = 40;

    private static final String GOOGLE_NO_PASS_MARKER = "GOOGLE_OAUTH_NO_PASSWORD";
    private static final Set<String> VALID_GOOGLE_ISSUERS = Set.of(
            "accounts.google.com",
            "https://accounts.google.com"
    );

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    private static final List<String> IRAN_CITIES = List.of(
            "تهران", "شیراز", "اصفهان", "مشهد", "تبریز", "کرج", "اهواز", "رشت",
            "قم", "کرمانشاه", "ارومیه", "یزد", "کرمان", "همدان", "بندرعباس", "ساری", "بوشهر", "زنجان", "قزوین", "اردبیل"
    );

    @Value("${GOOGLE_CLIENT_ID:}")
    private String googleClientId;

    @Transactional
    public Map<String, Object> register(String email, String password, String displayName, String locationCity,
                                        List<String> favoriteCategories, List<String> followedSources) {
        if (email == null || !email.contains("@")) {
            throw new RuntimeException("لطفاً یک آدرس ایمیل معتبر وارد کنید");
        }
        validatePasswordStrength(password);

        String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);
        if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new RuntimeException("این ایمیل قبلاً ثبت شده است");
        }

        User user = new User();
        user.setEmail(normalizedEmail);
        user.setPasswordHash(hashPassword(password));
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

        if (!verifyPassword(password, user.getPasswordHash())) {
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

    /**
     * Verifies Google OAuth2 ID Token (credential) including audience (aud), issuer (iss), and email_verified.
     */
    @Transactional
    public Map<String, Object> loginWithGoogle(String credential) {
        if (credential == null || credential.isBlank()) {
            throw new RuntimeException("توکن گوگل ارسال نشده است");
        }

        try {
            String encodedToken = URLEncoder.encode(credential.trim(), StandardCharsets.UTF_8);
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodedToken))
                    .timeout(Duration.ofSeconds(6))
                    .GET()
                    .build();

            HttpResponse<String> res = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() != 200) {
                throw new RuntimeException("اعتبارسنجی حساب گوگل ناموفق بود");
            }

            Map<String, Object> payload = objectMapper.readValue(res.body(), new TypeReference<Map<String, Object>>() {});

            // SECURITY FIX (BUG-01): Validate Audience (aud), Issuer (iss), and Email Verification
            String aud = payload.get("aud") != null ? String.valueOf(payload.get("aud")).trim() : "";
            String iss = payload.get("iss") != null ? String.valueOf(payload.get("iss")).trim() : "";
            boolean emailVerified = "true".equalsIgnoreCase(String.valueOf(payload.get("email_verified")));

            if (googleClientId != null && !googleClientId.isBlank() && !googleClientId.trim().equals(aud)) {
                logger.warn(LogEvent.AUTH_FAILED, "Rejected Google token with mismatched audience", "aud", aud);
                throw new RuntimeException("توکن گوگل متعلق به این سامانه نیست");
            }

            if (!iss.isEmpty() && !VALID_GOOGLE_ISSUERS.contains(iss)) {
                logger.warn(LogEvent.AUTH_FAILED, "Rejected Google token with invalid issuer", "iss", iss);
                throw new RuntimeException("صادرکننده توکن گوگل معتبر نیست");
            }

            if (!emailVerified) {
                throw new RuntimeException("ایمیل حساب گوگل شما تایید نشده است");
            }

            String email = (String) payload.get("email");
            String name = (String) payload.getOrDefault("name", email != null ? email.split("@")[0] : "کاربر Duta");

            if (email == null || !email.contains("@")) {
                throw new RuntimeException("ایمیل معتبری از حساب گوگل دریافت نشد");
            }

            String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);
            Optional<User> existingOpt = userRepository.findByEmailIgnoreCase(normalizedEmail);
            boolean isNewUser = false;

            User user;
            if (existingOpt.isPresent()) {
                user = existingOpt.get();
            } else {
                isNewUser = true;
                user = new User();
                user.setEmail(normalizedEmail);
                user.setPasswordHash(GOOGLE_NO_PASS_MARKER);
                user.setDisplayName(name);
                user.setFavoriteCategories("[]");
                user.setFollowedSources("[]");
                user.setMutedSources("[]");
                user.setHiddenClusterIds("[]");
                user.setPinnedTickers("[\"usd\",\"gold18\"]");
                user.setInterestScores("{}");
                user = userRepository.save(user);
            }

            String token = jwtService.generateToken(user.getId(), user.getEmail());
            logger.info(LogEvent.AUTH_SUCCESS, "Google OAuth login success", "userId", user.getId(), "isNewUser", isNewUser);

            return Map.of(
                    "token", token,
                    "user", buildProfileMap(user),
                    "isNewUser", isNewUser
            );
        } catch (RuntimeException re) {
            throw re;
        } catch (Exception e) {
            throw new RuntimeException("خطا در ارتباط با سرویس احراز هویت گوگل");
        }
    }

    @CacheEvict(value = "user_profiles", key = "#userId")
    @Transactional
    public Map<String, Object> changePassword(Long userId, String currentPassword, String newPassword) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("کاربر یافت نشد"));

        boolean hasExistingPassword = user.getPasswordHash() != null
                && user.getPasswordHash().contains(":")
                && !GOOGLE_NO_PASS_MARKER.equals(user.getPasswordHash());

        if (hasExistingPassword) {
            if (currentPassword == null || !verifyPassword(currentPassword, user.getPasswordHash())) {
                throw new RuntimeException("رمز عبور فعلی اشتباه است");
            }
        }

        validatePasswordStrength(newPassword);
        user.setPasswordHash(hashPassword(newPassword));
        user = userRepository.save(user);

        return Map.of(
                "status", hasExistingPassword
                        ? "رمز عبور شما با موفقیت تغییر یافت"
                        : "رمز عبور برای حساب شما با موفقیت تعریف شد",
                "user", buildProfileMap(user)
        );
    }

    private void validatePasswordStrength(String password) {
        if (password == null || password.length() < 8) {
            throw new RuntimeException("رمز عبور باید حداقل ۸ کاراکتر باشد");
        }
        boolean hasLetter = password.chars().anyMatch(Character::isLetter);
        boolean hasDigit = password.chars().anyMatch(Character::isDigit);
        if (!hasLetter || !hasDigit) {
            throw new RuntimeException("رمز عبور باید ترکیبی از حروف انگلیسی و اعداد باشد");
        }
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
                    if (hidden.size() > MAX_HIDDEN_CLUSTERS_FIFO) {
                        hidden = hidden.subList(hidden.size() - MAX_HIDDEN_CLUSTERS_FIFO, hidden.size());
                    }
                    user.setHiddenClusterIds(toJson(hidden));
                }
            }
        }

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

    @Cacheable(value = "categories", key = "'discovery_catalog'")
    @Transactional(readOnly = true)
    public Map<String, Object> getDiscoveryCatalog() {
        List<Source> allSources = sourceRepository.findAll().stream()
                .filter(s -> s.getSourceType() == null || s.getSourceType() == com.NewsGrid.V10.entity.SourceType.RSS)
                .sorted(Comparator.comparingInt((Source s) -> s.getCredibility() != null ? s.getCredibility() : 0).reversed())
                .toList();

        Map<String, List<Map<String, Object>>> sourcesByCategory = new LinkedHashMap<>();
        List<String> mainCategories = List.of(
                "اقتصادی", "سیاسی", "تکنولوژی", "آموزشی", "رمزارز", "اجتماعی",
                "خودرو", "ورزشی", "جهانی", "سلامت", "سرگرمی", "فرهنگ و هنر"
        );
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
                "sourcesByCategory", sourcesByCategory,
                "googleClientId", googleClientId != null ? googleClientId : ""
        );
    }

    private String hashPassword(String password) {
        try {
            byte[] salt = new byte[16];
            SECURE_RANDOM.nextBytes(salt);
            PBEKeySpec spec = new PBEKeySpec(password.toCharArray(), salt, PBKDF2_ITERATIONS, KEY_LENGTH);
            SecretKeyFactory skf = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
            byte[] hash = skf.generateSecret(spec).getEncoded();
            return Base64.getEncoder().encodeToString(salt) + ":" + Base64.getEncoder().encodeToString(hash);
        } catch (Exception e) {
            throw new IllegalStateException("Password hashing error", e);
        }
    }

    private boolean verifyPassword(String password, String stored) {
        try {
            if (stored == null || !stored.contains(":")) return false;
            String[] parts = stored.split(":");
            byte[] salt = Base64.getDecoder().decode(parts[0]);
            byte[] expectedHash = Base64.getDecoder().decode(parts[1]);

            PBEKeySpec spec = new PBEKeySpec(password.toCharArray(), salt, PBKDF2_ITERATIONS, KEY_LENGTH);
            SecretKeyFactory skf = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
            byte[] testHash = skf.generateSecret(spec).getEncoded();
            return MessageDigest.isEqual(expectedHash, testHash);
        } catch (Exception e) {
            return false;
        }
    }

    private void adjustScore(Map<String, Integer> scores, String key, int delta) {
        if (key == null || key.endsWith(":null") || key.endsWith(":")) return;
        int current = scores.getOrDefault(key, 0);
        if (current <= -20 && delta > 0) return;
        scores.put(key, Math.min(100, current + delta));
    }

    public Map<String, Object> buildProfileMap(User user) {
        boolean hasPassword = user.getPasswordHash() != null
                && user.getPasswordHash().contains(":")
                && !GOOGLE_NO_PASS_MARKER.equals(user.getPasswordHash());

        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", user.getId());
        map.put("email", user.getEmail());
        map.put("displayName", user.getDisplayName());
        map.put("hasPassword", hasPassword);
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