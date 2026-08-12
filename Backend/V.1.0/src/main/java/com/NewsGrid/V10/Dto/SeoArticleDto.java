package com.NewsGrid.V10.Dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class SeoArticleDto {
    private String title;
    private String description; // خلاصه‌ای از متن یا همان تیتر
    private String image;       // اگر در آینده تصویر اضافه شد
    private String sourceName;
    private String category;
    private String publishedAt;
    private String url;         // آدرس اصلی منبع
}