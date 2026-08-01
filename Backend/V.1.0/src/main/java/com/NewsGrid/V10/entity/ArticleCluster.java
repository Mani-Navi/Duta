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
@Table(name = "article_clusters")
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

    private ZonedDateTime createdAt;
    private ZonedDateTime updatedAt;

    // OPTIMIZED: Prevent JSON Circular Dependency and N+1 SELECT issue during serialization
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