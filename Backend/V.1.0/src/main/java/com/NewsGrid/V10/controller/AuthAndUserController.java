package com.NewsGrid.V10.controller;

import com.NewsGrid.V10.service.JwtService;
import com.NewsGrid.V10.service.UserService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class AuthAndUserController {

    private final UserService userService;
    private final JwtService jwtService;

    @PostMapping("/auth/register")
    public Map<String, Object> register(@RequestBody RegisterRequest req) {
        return userService.register(
                req.getEmail(),
                req.getPassword(),
                req.getDisplayName(),
                req.getLocationCity(),
                req.getFavoriteCategories(),
                req.getFollowedSources()
        );
    }

    @PostMapping("/auth/login")
    public Map<String, Object> login(@RequestBody LoginRequest req) {
        return userService.login(req.getEmail(), req.getPassword());
    }

    @PostMapping("/auth/google")
    public Map<String, Object> googleAuth(@RequestBody GoogleAuthRequest req) {
        return userService.loginWithGoogle(req.getCredential());
    }

    @GetMapping("/user/me")
    public ResponseEntity<?> getCurrentUser(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        Long userId = jwtService.extractUserIdFromHeader(authHeader);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "لطفاً وارد حساب کاربری خود شوید"));
        }
        return ResponseEntity.ok(userService.getCachedUserProfile(userId));
    }

    @PutMapping("/user/preferences")
    public ResponseEntity<?> updatePreferences(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody PreferencesRequest req) {

        Long userId = jwtService.extractUserIdFromHeader(authHeader);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "لطفاً وارد حساب کاربری خود شوید"));
        }

        Map<String, Object> updated = userService.updatePreferences(
                userId,
                req.getDisplayName(),
                req.getLocationCity(),
                req.getFavoriteCategories(),
                req.getFollowedSources(),
                req.getMutedSources(),
                req.getPinnedTickers()
        );
        return ResponseEntity.ok(updated);
    }

    @PutMapping("/user/password")
    public ResponseEntity<?> changePassword(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody ChangePasswordRequest req) {

        Long userId = jwtService.extractUserIdFromHeader(authHeader);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "لطفاً وارد حساب کاربری خود شوید"));
        }

        return ResponseEntity.ok(userService.changePassword(
                userId,
                req.getCurrentPassword(),
                req.getNewPassword()
        ));
    }

    @PostMapping("/user/feedback")
    public ResponseEntity<?> recordFeedback(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody FeedbackRequest req) {

        Long userId = jwtService.extractUserIdFromHeader(authHeader);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "لطفاً وارد حساب کاربری خود شوید"));
        }

        Map<String, Object> updated = userService.recordEngagementOrFeedback(
                userId,
                req.getActionType(),
                req.getCategory(),
                req.getSourceName(),
                req.getClusterId()
        );
        return ResponseEntity.ok(updated);
    }

    @GetMapping("/user/discovery-catalog")
    public Map<String, Object> getDiscoveryCatalog() {
        return userService.getDiscoveryCatalog();
    }

    @Data
    public static class RegisterRequest {
        private String email;
        private String password;
        private String displayName;
        private String locationCity;
        private List<String> favoriteCategories;
        private List<String> followedSources;
    }

    @Data
    public static class LoginRequest {
        private String email;
        private String password;
    }

    @Data
    public static class GoogleAuthRequest {
        private String credential;
    }

    @Data
    public static class ChangePasswordRequest {
        private String currentPassword;
        private String newPassword;
    }

    @Data
    public static class PreferencesRequest {
        private String displayName;
        private String locationCity;
        private List<String> favoriteCategories;
        private List<String> followedSources;
        private List<String> mutedSources;
        private List<String> pinnedTickers;
    }

    @Data
    public static class FeedbackRequest {
        private String actionType;
        private String category;
        private String sourceName;
        private Long clusterId;
    }
}