package com.NewsGrid.V10.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "article_clusters", indexes = {
        @Index(name = "idx_cluster_created_at", columnList = "createdAt DESC"),
        @Index(name = "idx_cluster_hot_score", columnList = "hotScore DESC")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ArticleCluster {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String representativeTitle;

    @Column(nullable = false)
    private int credibilityScore;

    @Column(nullable = false)
    private int sourceCount = 1;

    // Phase 2 Denormalized Engagement Counters (Zero COUNT(*) query overhead)
    @Column(nullable = false, columnDefinition = "INT DEFAULT 0")
    private int viewCount = 0;

    @Column(nullable = false, columnDefinition = "INT DEFAULT 0")
    private int likeCount = 0; // مفید

    @Column(nullable = false, columnDefinition = "INT DEFAULT 0")
    private int hotCount = 0;  // مهم

    @Column(nullable = false, columnDefinition = "INT DEFAULT 0")
    private int doubtCount = 0; // تردید

    @Column(nullable = false, columnDefinition = "DOUBLE PRECISION DEFAULT 0.0")
    private double hotScore = 0.0;

    private ZonedDateTime createdAt;
    private ZonedDateTime updatedAt;

    @OneToMany(mappedBy = "cluster", fetch = FetchType.LAZY)
    @JsonIgnoreProperties({"cluster"})
    private List<Article> articles = new ArrayList<>();

    @PrePersist
    protected void onCreate() {
        this.createdAt = ZonedDateTime.now(ZoneOffset.UTC);
        this.updatedAt = ZonedDateTime.now(ZoneOffset.UTC);
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = ZonedDateTime.now(ZoneOffset.UTC);
    }
}