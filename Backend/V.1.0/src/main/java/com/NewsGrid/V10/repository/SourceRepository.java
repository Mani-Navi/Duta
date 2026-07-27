package com.NewsGrid.V10.repository;

import com.NewsGrid.V10.entity.Category;
import com.NewsGrid.V10.entity.Source;
import com.NewsGrid.V10.entity.SourceType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SourceRepository extends JpaRepository<Source, Long> {
        List<Source> findByCategory(Category category);
        List<Source> findBySourceType(SourceType sourceType);
        Optional<Source> findByTelegramUsername(String telegramUsername);
}