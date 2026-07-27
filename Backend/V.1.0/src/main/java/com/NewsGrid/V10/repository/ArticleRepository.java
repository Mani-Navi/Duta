package com.NewsGrid.V10.repository;

import com.NewsGrid.V10.entity.Article;
import com.NewsGrid.V10.entity.ArticleCluster;
import com.NewsGrid.V10.entity.Source;
import com.NewsGrid.V10.entity.SourceType;
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
import java.util.Optional;

@Repository
public interface ArticleRepository extends JpaRepository<Article, Long> {

        boolean existsByUrl(String url);
        boolean existsBySlug(String slug);

        Optional<Article> findBySlug(String slug);

        @Modifying
        @Transactional
        void deleteByPublishedAtBefore(ZonedDateTime cutoff);

        List<Article> findBySource(Source source);
        List<Article> findByCluster(ArticleCluster cluster);
        Page<Article> findByBreakingTrue(Pageable pageable);

        @Query(value = """
        SELECT a.* FROM articles a
        LEFT JOIN sources s ON a.source_id = s.id
        WHERE a.cluster_id IS NULL
        OR a.id = (
            SELECT a2.id FROM articles a2
            LEFT JOIN sources s2 ON a2.source_id = s2.id
            WHERE a2.cluster_id = a.cluster_id
            ORDER BY s2.credibility DESC, a2.published_at DESC
            LIMIT 1
        )
        ORDER BY a.published_at DESC
        """,
                countQuery = """
        SELECT COUNT(*) FROM (
            SELECT DISTINCT COALESCE(a.cluster_id, a.id)
            FROM articles a
        ) t
        """,
                nativeQuery = true)
        Page<Article> findRepresentativeArticles(Pageable pageable);

        @Query(value = """
        SELECT a.* FROM articles a
        LEFT JOIN sources s ON a.source_id = s.id
        LEFT JOIN categories c ON s.category_id = c.id
        WHERE c.id = :categoryId
        AND (
            a.cluster_id IS NULL
            OR a.id = (
                SELECT a2.id FROM articles a2
                LEFT JOIN sources s2 ON a2.source_id = s2.id
                WHERE a2.cluster_id = a.cluster_id
                ORDER BY s2.credibility DESC, a2.published_at DESC
                LIMIT 1
            )
        )
        ORDER BY a.published_at DESC
        """,
                countQuery = """
        SELECT COUNT(*) FROM (
            SELECT DISTINCT COALESCE(a.cluster_id, a.id)
            FROM articles a
            LEFT JOIN sources s ON a.source_id = s.id
            LEFT JOIN categories c ON s.category_id = c.id
            WHERE c.id = :categoryId
        ) t
        """,
                nativeQuery = true)
        Page<Article> findRepresentativeByCategory(@Param("categoryId") Long categoryId, Pageable pageable);

        @Query(value = """
        SELECT a.* FROM articles a
        LEFT JOIN sources s ON a.source_id = s.id
        WHERE a.breaking = true
        AND (
            a.cluster_id IS NULL
            OR a.id = (
                SELECT a2.id FROM articles a2
                LEFT JOIN sources s2 ON a2.source_id = s2.id
                WHERE a2.cluster_id = a.cluster_id
                ORDER BY s2.credibility DESC, a2.published_at DESC
                LIMIT 1
            )
        )
        ORDER BY a.published_at DESC
        """,
                countQuery = """
        SELECT COUNT(*) FROM (
            SELECT DISTINCT COALESCE(a.cluster_id, a.id)
            FROM articles a WHERE a.breaking = true
        ) t
        """,
                nativeQuery = true)
        Page<Article> findRepresentativeBreaking(Pageable pageable);

        @Query(value = """
        SELECT a.* FROM articles a
        LEFT JOIN sources s ON a.source_id = s.id
        WHERE (
            LOWER(a.title) LIKE LOWER(CONCAT('%', :keyword, '%'))
            OR LOWER(s.name) LIKE LOWER(CONCAT('%', :keyword, '%'))
        )
        AND (
            a.cluster_id IS NULL
            OR a.id = (
                SELECT a2.id FROM articles a2
                LEFT JOIN sources s2 ON a2.source_id = s2.id
                WHERE a2.cluster_id = a.cluster_id
                ORDER BY s2.credibility DESC, a2.published_at DESC
                LIMIT 1
            )
        )
        ORDER BY a.published_at DESC
        """,
                countQuery = """
        SELECT COUNT(*) FROM (
            SELECT DISTINCT COALESCE(a.cluster_id, a.id)
            FROM articles a
            LEFT JOIN sources s ON a.source_id = s.id
            WHERE LOWER(a.title) LIKE LOWER(CONCAT('%', :keyword, '%'))
            OR LOWER(s.name) LIKE LOWER(CONCAT('%', :keyword, '%'))
        ) t
        """,
                nativeQuery = true)
        Page<Article> searchByKeyword(@Param("keyword") String keyword, Pageable pageable);

        // به متدهای قبلی ArticleRepository اضافه کنید:
        Page<Article> findBySourceSourceTypeOrderByPublishedAtDesc(SourceType sourceType, Pageable pageable);
}