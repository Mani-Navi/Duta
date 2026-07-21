package com.NewsGrid.V10.controller;

import com.NewsGrid.V10.entity.Article;
import com.NewsGrid.V10.entity.ArticleCluster;
import com.NewsGrid.V10.repository.ArticleClusterRepository;
import com.NewsGrid.V10.repository.ArticleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/clusters")
@RequiredArgsConstructor
public class ClusterController {

    private final ArticleClusterRepository clusterRepository;
    private final ArticleRepository articleRepository;

    // همه مقالات یه cluster
    @GetMapping("/{id}/articles")
    public List<Article> getClusterArticles(@PathVariable Long id) {
        ArticleCluster cluster = clusterRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("cluster یافت نشد"));
        return articleRepository.findByCluster(cluster);
    }
}