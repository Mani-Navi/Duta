package com.NewsGrid.V10.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.ZoneOffset;
import java.time.ZonedDateTime;

@Entity
@Table(
        name = "article_reactions",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_user_cluster_reaction", columnNames = {"user_id", "cluster_id"})
        },
        indexes = {
                @Index(name = "idx_reaction_cluster_id", columnList = "cluster_id"),
                @Index(name = "idx_reaction_user_id", columnList = "user_id")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ArticleReaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "cluster_id", nullable = false)
    private Long clusterId;

    // Allowed values: "LIKE" (مفید), "HOT" (مهم), "DOUBT" (تردید)
    @Column(name = "reaction_type", nullable = false, length = 16)
    private String reactionType;

    @Column(name = "created_at")
    private ZonedDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (this.createdAt == null) {
            this.createdAt = ZonedDateTime.now(ZoneOffset.UTC);
        }
    }
}