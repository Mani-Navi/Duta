package com.NewsGrid.V10.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.ZonedDateTime;

@Entity
@Table(name = "sources")
@Data
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
    private String telegramUsername; // مثلا: km_ap

    @Column(nullable = false)
    private Short credibility;

    @Column(length = 7)
    private String color;

    @Column(length = 5)
    private String initials;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", nullable = false)
    private SourceType sourceType = SourceType.RSS;

    @ManyToOne
    @JoinColumn(name = "category_id")
    private Category category;

    private ZonedDateTime lastFetchedAt;
}