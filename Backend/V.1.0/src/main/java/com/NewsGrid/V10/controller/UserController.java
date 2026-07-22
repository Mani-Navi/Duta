package com.NewsGrid.V10.controller;

import com.NewsGrid.V10.entity.Article;
import com.NewsGrid.V10.entity.Source;
import com.NewsGrid.V10.entity.User;
import com.NewsGrid.V10.repository.ArticleRepository;
import com.NewsGrid.V10.repository.SourceRepository;
import com.NewsGrid.V10.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;
    private final ArticleRepository articleRepository;
    private final SourceRepository sourceRepository;

    // لایک کردن خبر
    @PostMapping("/like/{articleId}")
    public ResponseEntity<?> likeArticle(@PathVariable Long articleId,
                                         @AuthenticationPrincipal User user) {
        Article article = articleRepository.findById(articleId)
                .orElseThrow(() -> new RuntimeException("خبر یافت نشد"));

        if (user.getLikedArticles().contains(article)) {
            user.getLikedArticles().remove(article);
        } else {
            user.getLikedArticles().add(article);
        }
        userRepository.save(user);

        return ResponseEntity.ok(Map.of(
                "liked", user.getLikedArticles().contains(article)
        ));
    }

    // فالو کردن منبع
    @PostMapping("/follow/{sourceId}")
    public ResponseEntity<?> followSource(@PathVariable Long sourceId,
                                          @AuthenticationPrincipal User user) {
        Source source = sourceRepository.findById(sourceId)
                .orElseThrow(() -> new RuntimeException("منبع یافت نشد"));

        if (user.getFollowedSources().contains(source)) {
            user.getFollowedSources().remove(source);
        } else {
            user.getFollowedSources().add(source);
        }
        userRepository.save(user);

        return ResponseEntity.ok(Map.of(
                "followed", user.getFollowedSources().contains(source)
        ));
    }

    // وضعیت لایک‌ها و فالوها
    @GetMapping("/status")
    public ResponseEntity<?> getStatus(@AuthenticationPrincipal User user) {
        Set<Long> likedIds = user.getLikedArticles()
                .stream().map(Article::getId).collect(Collectors.toSet());
        Set<Long> followedIds = user.getFollowedSources()
                .stream().map(Source::getId).collect(Collectors.toSet());

        return ResponseEntity.ok(Map.of(
                "likedArticleIds", likedIds,
                "followedSourceIds", followedIds
        ));
    }
}