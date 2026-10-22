package com.NewsGrid.V10.controller;

import com.NewsGrid.V10.entity.Article;
import com.NewsGrid.V10.service.ArticleService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/clusters")
@RequiredArgsConstructor
public class ClusterController {

    private final ArticleService articleService;

    @GetMapping("/{id}/articles")
    public List<Article> getClusterArticles(@PathVariable Long id) {
        return articleService.getClusterArticles(id);
    }
}