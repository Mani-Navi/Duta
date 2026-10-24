package com.NewsGrid.V10.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.ZoneOffset;
import java.time.ZonedDateTime;

@Entity
@Table(name = "users", indexes = {
        @Index(name = "idx_user_email", columnList = "email", unique = true)
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 255)
    private String email;

    @JsonIgnore
    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Column(name = "display_name", length = 100)
    private String displayName;

    @Column(name = "location_city", length = 50)
    private String locationCity;

    // JSON array of selected categories e.g. ["اقتصادی","تکنولوژی"]
    @Column(name = "favorite_categories", columnDefinition = "TEXT")
    private String favoriteCategories = "[]";

    // JSON array of followed source names or IDs e.g. ["دنیای اقتصاد","زومیت"]
    @Column(name = "followed_sources", columnDefinition = "TEXT")
    private String followedSources = "[]";

    // JSON array of explicitly muted sources via (...) menu
    @Column(name = "muted_sources", columnDefinition = "TEXT")
    private String mutedSources = "[]";

    // Bounded FIFO JSON array (max 50) of hidden cluster IDs
    @Column(name = "hidden_cluster_ids", columnDefinition = "TEXT")
    private String hiddenClusterIds = "[]";

    // JSON array of pinned market asset IDs in header e.g. ["usd","gold18","btc"]
    @Column(name = "pinned_tickers", columnDefinition = "TEXT")
    private String pinnedTickers = "[\"usd\",\"gold18\"]";

    // Permanent ~200B JSON map of learned behavioral weights e.g. {"cat:اقتصادی":18,"src:زومیت":9}
    @Column(name = "interest_scores", columnDefinition = "TEXT")
    private String interestScores = "{}";

    @Column(name = "created_at")
    private ZonedDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (this.createdAt == null) {
            this.createdAt = ZonedDateTime.now(ZoneOffset.UTC);
        }
    }
}