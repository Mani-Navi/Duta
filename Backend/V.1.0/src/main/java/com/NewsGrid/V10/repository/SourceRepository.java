package com.NewsGrid.V10.repository;

import com.NewsGrid.V10.entity.Category;
import com.NewsGrid.V10.entity.Source;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SourceRepository
        extends JpaRepository<Source, Long> {

        List<Source> findByCategory(Category category);
}
