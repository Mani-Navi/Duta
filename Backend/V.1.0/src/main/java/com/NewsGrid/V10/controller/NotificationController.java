package com.NewsGrid.V10.controller;

import com.NewsGrid.V10.entity.PushSubscription;
import com.NewsGrid.V10.repository.PushSubscriptionRepository;
import com.NewsGrid.V10.service.JwtService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * UCS-012: Web Push Notification subscription management endpoints.
 */
@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final PushSubscriptionRepository subscriptionRepository;
    private final JwtService jwtService;

    @PostMapping("/subscribe")
    @Transactional
    public ResponseEntity<?> subscribe(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody SubscribeRequest req) {

        Long userId = jwtService.extractUserIdFromHeader(authHeader);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "لطفاً ابتدا وارد حساب کاربری خود شوید"));
        }

        if (req.getEndpoint() == null || req.getEndpoint().isBlank()
                || req.getP256dh() == null || req.getAuth() == null) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "اطلاعات اشتراک نوتیفیکیشن ناقص است"));
        }

        PushSubscription sub = subscriptionRepository.findByEndpoint(req.getEndpoint().trim())
                .orElseGet(PushSubscription::new);

        sub.setUserId(userId);
        sub.setEndpoint(req.getEndpoint().trim());
        sub.setP256dh(req.getP256dh().trim());
        sub.setAuth(req.getAuth().trim());
        subscriptionRepository.save(sub);

        return ResponseEntity.ok(Map.of("status", "subscribed"));
    }

    @DeleteMapping("/unsubscribe")
    @Transactional
    public ResponseEntity<?> unsubscribe(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestParam(required = false) String endpoint) {

        Long userId = jwtService.extractUserIdFromHeader(authHeader);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "لطفاً ابتدا وارد حساب کاربری خود شوید"));
        }

        if (endpoint != null && !endpoint.isBlank()) {
            subscriptionRepository.deleteByUserIdAndEndpoint(userId, endpoint.trim());
        } else {
            subscriptionRepository.deleteByUserId(userId);
        }

        return ResponseEntity.ok(Map.of("status", "unsubscribed"));
    }

    @Data
    public static class SubscribeRequest {
        private String endpoint;
        private String p256dh;
        private String auth;
    }
}