package com.NewsGrid.V10.repository;

import com.NewsGrid.V10.entity.Article;
import com.NewsGrid.V10.entity.Category;
import com.NewsGrid.V10.entity.Source;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.stereotype.Repository;

import java.time.ZonedDateTime;
import java.util.List;

@Repository
public interface ArticleRepository
        extends JpaRepository<Article, Long> {

        boolean existsByUrl(String url);

        // حذف اخبار قدیمی
        @Modifying
        @Transactional
        void deleteByPublishedAtBefore(ZonedDateTime cutoff0);


        List<Article> findBySource(Source source);

        //Pagination
        Page<Article> findAll(Pageable pageable);
        Page<Article> findBySource_Category(Category category, Pageable pageable);

        @Query("SELECT a FROM Article a WHERE " +
                "LOWER(a.title) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
                "LOWER(a.source.name) LIKE LOWER(CONCAT('%', :keyword, '%'))")
        Page<Article> searchByKeyword(@Param("keyword") String keyword, Pageable pageable);
}
