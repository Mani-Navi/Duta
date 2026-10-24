package com.NewsGrid.V10.controller;

import com.NewsGrid.V10.entity.Article;
import com.NewsGrid.V10.service.ArticleService;
import com.NewsGrid.V10.service.JwtService;
import com.NewsGrid.V10.service.PersonalizationService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/clusters")
@RequiredArgsConstructor
public class ClusterController {

    private final ArticleService articleService;
    private final PersonalizationService personalizationService;
    private final JwtService jwtService;

    @GetMapping("/{id}/articles")
    public List<Article> getClusterArticles(@PathVariable Long id) {
        return articleService.getClusterArticles(id);
    }

    @PostMapping("/{id}/reactions")
    public ResponseEntity<?> reactToCluster(
            @PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody ReactionRequest req) {

        Long userId = jwtService.extractUserIdFromHeader(authHeader);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "برای ثبت بازخورد ابتدا وارد حساب خود شوید"));
        }

        return ResponseEntity.ok(personalizationService.toggleReaction(userId, id, req.getType()));
    }

    @Data
    public static class ReactionRequest {
        private String type; // LIKE, HOT, DOUBT
    }
}