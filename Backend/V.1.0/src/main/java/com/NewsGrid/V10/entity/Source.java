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

    @Column(nullable = false)
    private String rssUrl;

    @Column(nullable = false)
    private Short credibility;

    // رنگ badge منبع — مثل #E11D48
    @Column(length = 7)
    private String color;

    // حروف اختصاری منبع — مثل BBC، IR، IS
    @Column(length = 5)
    private String initials;

    @ManyToOne
    @JoinColumn(name = "category_id")
    private Category category;

    private ZonedDateTime lastFetchedAt;
}