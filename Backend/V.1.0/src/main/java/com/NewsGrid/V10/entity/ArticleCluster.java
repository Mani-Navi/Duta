package com.NewsGrid.V10.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "article_clusters")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ArticleCluster {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // تیتر اصلی — از معتبرترین منبع
    @Column(nullable = false, columnDefinition = "TEXT")
    private String representativeTitle;

    // امتیاز اعتبار محاسبه‌شده از همه منابع
    @Column(nullable = false)
    private int credibilityScore;

    // تعداد منابع پوشش‌دهنده
    @Column(nullable = false)
    private int sourceCount = 1;

    private ZonedDateTime createdAt;
    private ZonedDateTime updatedAt;

    // خبرهای این cluster
    @OneToMany(mappedBy = "cluster", fetch = FetchType.LAZY)
    private List<Article> articles = new ArrayList<>();
}