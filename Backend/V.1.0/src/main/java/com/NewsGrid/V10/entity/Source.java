package com.NewsGrid.V10.entity;

import com.NewsGrid.V10.entity.Category;
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

    @ManyToOne
    @JoinColumn(name = "category_id")
    private Category category;

    private ZonedDateTime lastFetchedAt;
}
