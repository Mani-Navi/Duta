package com.NewsGrid.V10.entity;

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

    @ManyToOne
    @JoinColumn(name = "source_id")
    private Source source;
}
