package com.NewsGrid.V10.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.ZonedDateTime;

@Entity
@Table(name = "sources", indexes = {
        @Index(name = "idx_source_type", columnList = "source_type"),
        @Index(name = "idx_source_credibility", columnList = "credibility DESC")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Source {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    private String rssUrl;

    @Column(name = "telegram_username")
    private String telegramUsername;

    @Column(nullable = false)
    private Short credibility;

    @Column(length = 7)
    private String color;

    @Column(length = 5)
    private String initials;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", nullable = false)
    private SourceType sourceType = SourceType.RSS;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "category_id")
    private Category category;

    private ZonedDateTime lastFetchedAt;
}