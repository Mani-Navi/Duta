package com.NewsGrid.V10.repository;

import com.NewsGrid.V10.entity.ArticleCluster;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.ZonedDateTime;
import java.util.List;

@Repository
public interface ArticleClusterRepository extends JpaRepository<ArticleCluster, Long> {

    // cluster های اخیر برای مقایسه (۶ ساعت اخیر)
    List<ArticleCluster> findByCreatedAtAfter(ZonedDateTime since);

    // همه cluster ها با pagination
    Page<ArticleCluster> findAll(Pageable pageable);

    // جستجو در cluster ها
    @Query("SELECT c FROM ArticleCluster c WHERE " +
            "LOWER(c.representativeTitle) LIKE LOWER(CONCAT('%', :keyword, '%'))")
    Page<ArticleCluster> searchByKeyword(@Param("keyword") String keyword, Pageable pageable);
}