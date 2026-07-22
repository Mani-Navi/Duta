package com.NewsGrid.V10.controller;

import com.NewsGrid.V10.entity.User;
import com.NewsGrid.V10.repository.UserRepository;
import com.NewsGrid.V10.service.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.ZonedDateTime;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;

    // ثبت‌نام
    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequest req) {
        if (userRepository.existsByEmail(req.email())) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "این ایمیل قبلاً ثبت شده است"));
        }

        User user = new User();
        user.setEmail(req.email());
        user.setPasswordHash(passwordEncoder.encode(req.password()));
        user.setName(req.name());
        user.setCity(req.city());
        user.setCreatedAt(ZonedDateTime.now());
        userRepository.save(user);

        String token = jwtService.generateToken(user.getEmail());
        return ResponseEntity.ok(Map.of(
                "token", token,
                "name", user.getName(),
                "email", user.getEmail()
        ));
    }

    // ورود
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest req) {
        return userRepository.findByEmail(req.email())
                .filter(u -> passwordEncoder.matches(req.password(), u.getPasswordHash()))
                .map(u -> {
                    String token = jwtService.generateToken(u.getEmail());
                    return ResponseEntity.ok(Map.of(
                            "token", token,
                            "name", u.getName(),
                            "email", u.getEmail()
                    ));
                })
                .orElse(ResponseEntity.badRequest()
                        .body(Map.of("error", "ایمیل یا رمز عبور اشتباه است")));
    }

    // اطلاعات کاربر فعلی
    @GetMapping("/me")
    public ResponseEntity<?> me(@org.springframework.security.core.annotation.AuthenticationPrincipal User user) {
        if (user == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(Map.of(
                "id", user.getId(),
                "name", user.getName(),
                "email", user.getEmail(),
                "city", user.getCity() != null ? user.getCity() : ""
        ));
    }

    record RegisterRequest(String email, String password, String name, String city) {}
    record LoginRequest(String email, String password) {}
}