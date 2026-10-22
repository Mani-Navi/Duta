package com.NewsGrid.V10.Dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class SeoArticleDto {
    private String title;
    private String description;      // خلاصه غنی‌شده با امتیاز اعتبار و منابع برای Meta/OG و GEO
    private String image;            // تصویر OG
    private String sourceName;
    private String category;
    private String publishedAt;
    private String url;              // آدرس اصلی منبع خبر
    private String slug;
    private String canonicalUrl;     // آدرس استاندارد خبر در duta.ir
    private int credibilityScore;    // امتیاز اعتبار (۰ تا ۱۰۰)
    private String credibilityLabel; // تأیید شده | در حال بررسی | نامعتبر
    private int sourceCount;         // تعداد منابع مستقل پوشش‌دهنده
    private boolean breaking;        // وضعیت خبر فوری
    private List<String> coveredSources; // نام خبرگزاری‌های پوشش‌دهنده این خبر
}