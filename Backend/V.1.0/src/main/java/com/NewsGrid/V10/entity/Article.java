package com.NewsGrid.V10.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.ZonedDateTime;

@Entity
@Table(name = "articles")
@Data
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

    // slug برای URL — مثل: انتقاد-شدید-وزیر-جنگ
    @Column(columnDefinition = "TEXT")
    private String slug;

    @ManyToOne
    @JoinColumn(name = "source_id")
    private Source source;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cluster_id")
    @JsonIgnoreProperties({"articles", "hibernateLazyInitializer"})
    private ArticleCluster cluster;
}