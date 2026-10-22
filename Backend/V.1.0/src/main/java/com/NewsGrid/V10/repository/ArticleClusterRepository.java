package com.NewsGrid.V10.repository;

import com.NewsGrid.V10.entity.ArticleCluster;
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
public interface ArticleClusterRepository extends JpaRepository<ArticleCluster, Long> {

    List<ArticleCluster> findByCreatedAtAfter(ZonedDateTime since);

    Page<ArticleCluster> findAll(Pageable pageable);

    @Query("SELECT c FROM ArticleCluster c WHERE " +
            "LOWER(c.representativeTitle) LIKE LOWER(CONCAT('%', :keyword, '%'))")
    Page<ArticleCluster> searchByKeyword(@Param("keyword") String keyword, Pageable pageable);

    // FIXED: Clean up orphan clusters that no longer have any associated articles
    @Modifying
    @Transactional
    @Query(value = """
        DELETE FROM article_clusters c
        WHERE NOT EXISTS (
            SELECT 1 FROM articles a WHERE a.cluster_id = c.id
        )
        """, nativeQuery = true)
    int deleteOrphanClusters();
}