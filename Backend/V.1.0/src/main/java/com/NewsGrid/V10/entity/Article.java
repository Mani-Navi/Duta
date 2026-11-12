package com.NewsGrid.V10.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.Locale;

@Entity
@Table(name = "articles", indexes = {
        @Index(name = "idx_article_url", columnList = "url", unique = true),
        @Index(name = "idx_article_published_at", columnList = "publishedAt DESC"),
        @Index(name = "idx_article_slug", columnList = "slug"),
        @Index(name = "idx_article_breaking", columnList = "breaking"),
        @Index(name = "idx_article_category", columnList = "category"),
        @Index(name = "idx_article_location", columnList = "location"),
        @Index(name = "idx_article_cluster_id", columnList = "cluster_id"),
        @Index(name = "idx_article_source_id", columnList = "source_id")
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

    @Column(columnDefinition = "TEXT")
    private String description;

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

    @Column(length = 50)
    private String location;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "cluster_id")
    @JsonIgnoreProperties({"articles", "hibernateLazyInitializer"})
    private ArticleCluster cluster;

    public void setDescription(String description) {
        this.description = sanitizeDescriptionText(description);
    }

    @PrePersist
    @PreUpdate
    protected void onSaveOrUpdate() {
        ZonedDateTime now = ZonedDateTime.now(ZoneOffset.UTC);
        if (this.publishedAt == null || this.publishedAt.isAfter(now)) {
            this.publishedAt = now;
        }
        this.description = sanitizeDescriptionText(this.description);
    }

    /**
     * دائمی و خودکار برای تمام خبرهای آینده:
     * حذف کامل پسوندهای خودکار وردپرس (The post ... appeared first on ...) قبل از ذخیره در دیتابیس
     */
    public static String sanitizeDescriptionText(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String s = raw.trim();

        String lower = s.toLowerCase(Locale.ROOT);
        int postIdx = lower.indexOf("the post");
        if (postIdx >= 0) {
            s = s.substring(0, postIdx).trim();
        }

        int appIdx = s.toLowerCase(Locale.ROOT).indexOf("appeared first on");
        if (appIdx >= 0) {
            s = s.substring(0, appIdx).trim();
        }

        int faIdx = s.indexOf("اولین بار در");
        if (faIdx >= 0) {
            int nIdx = s.lastIndexOf("نوشته", faIdx);
            s = s.substring(0, nIdx >= 0 ? nIdx : faIdx).trim();
        }

        s = s.replaceAll("\\s*\\[\\s*(…|\\.{2,})\\s*\\]\\s*$", "").trim();
        if (s.length() < 5 || "...".equals(s)) return null;
        return s;
    }
}