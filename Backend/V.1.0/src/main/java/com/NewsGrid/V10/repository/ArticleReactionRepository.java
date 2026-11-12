package com.NewsGrid.V10.repository;

import com.NewsGrid.V10.entity.ArticleReaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Repository
public interface ArticleReactionRepository extends JpaRepository<ArticleReaction, Long> {

    Optional<ArticleReaction> findByUserIdAndClusterId(Long userId, Long clusterId);

    List<ArticleReaction> findByUserIdAndClusterIdIn(Long userId, List<Long> clusterIds);

    // Phase 2 (UCS-005 & UCS-009): Automatically purge reactions of deleted >30-day clusters
    @Modifying
    @Transactional
    @Query(value = """
        DELETE FROM article_reactions r
        WHERE NOT EXISTS (
            SELECT 1 FROM article_clusters c WHERE c.id = r.cluster_id
        )
        """, nativeQuery = true)
    int deleteOrphanReactions();
}