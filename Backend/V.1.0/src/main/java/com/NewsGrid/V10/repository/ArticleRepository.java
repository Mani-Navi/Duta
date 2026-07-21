package com.NewsGrid.V10.repository;

import com.NewsGrid.V10.entity.Article;
import com.NewsGrid.V10.entity.ArticleCluster;
import com.NewsGrid.V10.entity.Category;
import com.NewsGrid.V10.entity.Source;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.ZonedDateTime;
import java.util.List;

@Repository
public interface ArticleRepository extends JpaRepository<Article, Long> {

        boolean existsByUrl(String url);

        @Modifying
        @Transactional
        void deleteByPublishedAtBefore(ZonedDateTime cutoff);

        List<Article> findBySource(Source source);
        List<Article> findByCluster(ArticleCluster cluster);

        Page<Article> findByBreakingTrue(Pageable pageable);

        // فقط یه article به ازای هر cluster (معتبرترین منبع)
        // + articleهایی که اصلاً cluster ندارن
        @Query("""
        SELECT a FROM Article a
        WHERE a.cluster IS NULL
        OR a.id = (
            SELECT a2.id FROM Article a2
            WHERE a2.cluster = a.cluster
            ORDER BY a2.source.credibility DESC, a2.publishedAt DESC
            LIMIT 1
        )
        ORDER BY a.publishedAt DESC
        """)
        Page<Article> findRepresentativeArticles(Pageable pageable);

        // همین ولی با فیلتر کتگوری
        @Query("""
        SELECT a FROM Article a
        WHERE a.source.category = :category
        AND (
            a.cluster IS NULL
            OR a.id = (
                SELECT a2.id FROM Article a2
                WHERE a2.cluster = a.cluster
                AND a2.source.category = :category
                ORDER BY a2.source.credibility DESC, a2.publishedAt DESC
                LIMIT 1
            )
        )
        ORDER BY a.publishedAt DESC
        """)
        Page<Article> findRepresentativeByCategory(@Param("category") com.NewsGrid.V10.entity.Category category, Pageable pageable);

        // breaking با cluster dedup
        @Query("""
        SELECT a FROM Article a
        WHERE a.breaking = true
        AND (
            a.cluster IS NULL
            OR a.id = (
                SELECT a2.id FROM Article a2
                WHERE a2.cluster = a.cluster
                AND a2.breaking = true
                ORDER BY a2.source.credibility DESC, a2.publishedAt DESC
                LIMIT 1
            )
        )
        ORDER BY a.publishedAt DESC
        """)
        Page<Article> findRepresentativeBreaking(Pageable pageable);

        // جستجو با cluster dedup
        @Query("""
        SELECT a FROM Article a
        WHERE (
            LOWER(a.title) LIKE LOWER(CONCAT('%', :keyword, '%'))
            OR LOWER(a.source.name) LIKE LOWER(CONCAT('%', :keyword, '%'))
        )
        AND (
            a.cluster IS NULL
            OR a.id = (
                SELECT a2.id FROM Article a2
                WHERE a2.cluster = a.cluster
                ORDER BY a2.source.credibility DESC, a2.publishedAt DESC
                LIMIT 1
            )
        )
        ORDER BY a.publishedAt DESC
        """)
        Page<Article> searchByKeyword(@Param("keyword") String keyword, Pageable pageable);
}