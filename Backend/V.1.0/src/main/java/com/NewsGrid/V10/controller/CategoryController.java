package com.NewsGrid.V10.controller;

import com.NewsGrid.V10.entity.Category;
import com.NewsGrid.V10.repository.CategoryRepository;
import lombok.AllArgsConstructor;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/Categories")
@AllArgsConstructor
@CrossOrigin(origins = "*")
public class CategoryController {
    private final CategoryRepository categoryRepository;

    @GetMapping
    public List<Category> getAllCategories() {
        return categoryRepository.findAll();
    }
}
