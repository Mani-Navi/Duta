package com.NewsGrid.V10.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.ZoneOffset;
import java.time.ZonedDateTime;

@Entity
@Table(name = "articles", indexes = {
        @Index(name = "idx_article_url", columnList = "url", unique = true),
        @Index(name = "idx_article_published_at", columnList = "publishedAt DESC"),
        @Index(name = "idx_article_slug", columnList = "slug"),
        @Index(name = "idx_article_breaking", columnList = "breaking"),
        @Index(name = "idx_article_category", columnList = "category")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Article {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String title;

    @Column(nullable = false, unique = true, columnDefinition = "TEXT")
    private String url;

    private ZonedDateTime publishedAt;

    @Column(nullable = false)
    private boolean breaking = false;

    @Column(columnDefinition = "TEXT")
    private String slug;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "source_id")
    private Source source;

    @Column(length = 50)
    private String category;

    // BUGFIX: FetchType.EAGER prevents JSON serialization no-session error
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "cluster_id")
    @JsonIgnoreProperties({"articles", "hibernateLazyInitializer"})
    private ArticleCluster cluster;

    @PrePersist
    protected void onCreate() {
        if (this.publishedAt == null) {
            this.publishedAt = ZonedDateTime.now(ZoneOffset.UTC);
        }
    }
}