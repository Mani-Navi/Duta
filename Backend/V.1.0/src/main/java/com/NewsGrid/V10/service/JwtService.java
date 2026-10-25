package com.NewsGrid.V10.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.Map;

/**
 * Pure Java 21 RFC-7519 HMAC-SHA256 JWT implementation (Zero external Maven dependencies).
 */
@Service
@RequiredArgsConstructor
public class JwtService {

    @Value("${jwt.secret:duta_prod_secret_key_2026_secure!}")
    private String rawSecret;

    private final ObjectMapper objectMapper;
    private SecretKeySpec secretKeySpec;

    private static final String HEADER_B64 = Base64.getUrlEncoder().withoutPadding()
            .encodeToString("{\"alg\":\"HS256\",\"typ\":\"JWT\"}".getBytes(StandardCharsets.UTF_8));
    private static final long EXPIRATION_MS = 30L * 24 * 60 * 60 * 1000; // 30 Days

    @PostConstruct
    public void initKey() {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] keyBytes = digest.digest(rawSecret.getBytes(StandardCharsets.UTF_8));
            this.secretKeySpec = new SecretKeySpec(keyBytes, "HmacSHA256");
        } catch (Exception e) {
            throw new IllegalStateException("Failed to initialize JWT signing key", e);
        }
    }

    public String generateToken(Long userId, String email) {
        try {
            long now = System.currentTimeMillis();
            Map<String, Object> payload = Map.of(
                    "sub", String.valueOf(userId),
                    "email", email,
                    "iat", now / 1000,
                    "exp", (now + EXPIRATION_MS) / 1000
            );
            String payloadJson = objectMapper.writeValueAsString(payload);
            String payloadB64 = Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(payloadJson.getBytes(StandardCharsets.UTF_8));

            String signingInput = HEADER_B64 + "." + payloadB64;
            String signatureB64 = signHmacSha256(signingInput);
            return signingInput + "." + signatureB64;
        } catch (Exception e) {
            throw new IllegalStateException("Failed to generate JWT", e);
        }
    }

    public Long extractUserIdFromHeader(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return null;
        }
        return extractUserId(authHeader.substring(7).trim());
    }

    public Long extractUserId(String token) {
        try {
            if (token == null) return null;
            String[] parts = token.split("\\.");
            if (parts.length != 3) return null;

            String signingInput = parts[0] + "." + parts[1];
            String expectedSig = signHmacSha256(signingInput);

            if (!MessageDigest.isEqual(
                    expectedSig.getBytes(StandardCharsets.UTF_8),
                    parts[2].getBytes(StandardCharsets.UTF_8))) {
                return null;
            }

            byte[] payloadBytes = Base64.getUrlDecoder().decode(parts[1]);
            Map<String, Object> claims = objectMapper.readValue(payloadBytes, new TypeReference<Map<String, Object>>() {});

            Number exp = (Number) claims.get("exp");
            if (exp != null && (System.currentTimeMillis() / 1000) > exp.longValue()) {
                return null;
            }

            Object sub = claims.get("sub");
            return sub != null ? Long.parseLong(String.valueOf(sub)) : null;
        } catch (Exception e) {
            return null;
        }
    }

    private String signHmacSha256(String data) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(secretKeySpec);
        byte[] sig = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
        return Base64.getUrlEncoder().withoutPadding().encodeToString(sig);
    }
}