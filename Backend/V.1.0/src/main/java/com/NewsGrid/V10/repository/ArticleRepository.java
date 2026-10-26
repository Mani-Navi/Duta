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

        @Query("""
        SELECT a FROM Article a
        LEFT JOIN FETCH a.source s
        LEFT JOIN FETCH s.category
        LEFT JOIN FETCH a.cluster
        WHERE a.slug = :slug
        """)
        Optional<Article> findBySlug(@Param("slug") String slug);

        @Query("""
        SELECT a FROM Article a
        LEFT JOIN FETCH a.source s
        LEFT JOIN FETCH s.category
        LEFT JOIN FETCH a.cluster
        WHERE a.id = :id
        """)
        Optional<Article> findByIdWithDetails(@Param("id") Long id);

        /**
         * BUG-03 FIX: Hydrates a page/pool of Articles with their Source, Category, and Cluster in 1 single SQL JOIN query.
         */
        @Query("""
        SELECT a FROM Article a
        LEFT JOIN FETCH a.source s
        LEFT JOIN FETCH s.category
        LEFT JOIN FETCH a.cluster
        WHERE a.id IN :ids
        ORDER BY a.publishedAt DESC
        """)
        List<Article> findByIdInWithDetails(@Param("ids") List<Long> ids);

        /**
         * BUG-03 FIX: Fetches top N recent articles for XML Sitemap in 1 single query (eliminates 2000 N+1 selects).
         */
        @Query("""
        SELECT a FROM Article a
        LEFT JOIN FETCH a.source s
        LEFT JOIN FETCH s.category
        LEFT JOIN FETCH a.cluster
        ORDER BY a.publishedAt DESC
        """)
        List<Article> findRecentForSitemap(Pageable pageable);

        @Modifying
        @Transactional
        void deleteByPublishedAtBefore(ZonedDateTime cutoff);

        List<Article> findBySource(Source source);

        @Query("""
        SELECT a FROM Article a
        LEFT JOIN FETCH a.source s
        LEFT JOIN FETCH s.category
        LEFT JOIN FETCH a.cluster
        WHERE a.cluster = :cluster
        ORDER BY s.credibility DESC, a.publishedAt DESC
        """)
        List<Article> findByCluster(@Param("cluster") ArticleCluster cluster);

        @Query("""
        SELECT a FROM Article a
        LEFT JOIN FETCH a.source s
        LEFT JOIN FETCH s.category
        LEFT JOIN FETCH a.cluster
        WHERE a.cluster.id = :clusterId
        ORDER BY s.credibility DESC, a.publishedAt DESC
        """)
        List<Article> findByClusterIdWithSources(@Param("clusterId") Long clusterId);

        @Query(value = """
        SELECT a FROM Article a
        LEFT JOIN FETCH a.source s
        LEFT JOIN FETCH s.category
        LEFT JOIN FETCH a.cluster
        WHERE s.sourceType = :sourceType
        ORDER BY a.publishedAt DESC
        """,
                countQuery = "SELECT COUNT(a) FROM Article a WHERE a.source.sourceType = :sourceType")
        Page<Article> findBySourceSourceTypeOrderByPublishedAtDesc(@Param("sourceType") SourceType sourceType, Pageable pageable);

        @Query(value = """
        SELECT a.id FROM articles a
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
                countQuery = "SELECT COUNT(DISTINCT COALESCE(cluster_id, id)) FROM articles",
                nativeQuery = true)
        Page<Long> findRepresentativeArticleIds(Pageable pageable);

        @Query(value = """
        SELECT a.id FROM articles a
        LEFT JOIN sources s ON a.source_id = s.id
        WHERE a.category = :category
        AND (
            a.cluster_id IS NULL
            OR a.id = (
                SELECT a2.id FROM articles a2
                LEFT JOIN sources s2 ON a2.source_id = s2.id
                WHERE a2.cluster_id = a.cluster_id
                AND a2.category = :category
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
            WHERE a.category = :category
        ) t
        """,
                nativeQuery = true)
        Page<Long> findRepresentativeIdsByCategory(@Param("category") String category, Pageable pageable);

        @Query(value = """
        SELECT a.id FROM articles a
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
                countQuery = "SELECT COUNT(DISTINCT COALESCE(cluster_id, id)) FROM articles WHERE breaking = true",
                nativeQuery = true)
        Page<Long> findRepresentativeIdsBreaking(Pageable pageable);

        @Query(value = """
        SELECT a.id FROM articles a
        LEFT JOIN sources s ON a.source_id = s.id
        WHERE (
            a.title ~* ('(^|[^آ-یa-zA-Z0-9])' || :keyword || '($|[^آ-یa-zA-Z0-9])')
            OR s.name ~* ('(^|[^آ-یa-zA-Z0-9])' || :keyword || '($|[^آ-یa-zA-Z0-9])')
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
        SELECT COUNT(DISTINCT COALESCE(a.cluster_id, a.id))
        FROM articles a
        LEFT JOIN sources s ON a.source_id = s.id
        WHERE (
            a.title ~* ('(^|[^آ-یa-zA-Z0-9])' || :keyword || '($|[^آ-یa-zA-Z0-9])')
            OR s.name ~* ('(^|[^آ-یa-zA-Z0-9])' || :keyword || '($|[^آ-یa-zA-Z0-9])')
        )
        """,
                nativeQuery = true)
        Page<Long> searchRepresentativeIdsByKeyword(@Param("keyword") String keyword, Pageable pageable);
}