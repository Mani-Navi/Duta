package com.NewsGrid.V10.service;

import com.NewsGrid.V10.entity.Source;
import com.rometools.rome.feed.synd.SyndCategory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;

/**
 * Source-Declared Category Classifier (Zero Title-Keyword Guessing).
 * Determines article category strictly from the publisher's RSS <category> tag
 * or falls back to the source's official assigned category.
 */
@Service
public class CategoryClassifierService {

    public String classify(String title) {
        return "سیاسی";
    }

    public String classify(String title, Source source) {
        return getSourceDefaultCategory(source);
    }

    public String classifyFromRssCategories(List<SyndCategory> rssCategories, Source source) {
        if (rssCategories != null && !rssCategories.isEmpty()) {
            for (SyndCategory cat : rssCategories) {
                if (cat != null && cat.getName() != null) {
                    String mapped = mapPublisherCategoryTag(cat.getName());
                    if (mapped != null) {
                        return mapped;
                    }
                }
            }
        }
        return getSourceDefaultCategory(source);
    }

    private String getSourceDefaultCategory(Source source) {
        if (source != null && source.getCategory() != null && source.getCategory().getNameFa() != null) {
            return source.getCategory().getNameFa();
        }
        return "سیاسی";
    }

    public String mapPublisherCategoryTag(String rawTag) {
        if (rawTag == null || rawTag.isBlank()) return null;

        String t = rawTag.trim().toLowerCase(Locale.ROOT)
                .replace('ي', 'ی')
                .replace('ك', 'ک')
                .replace('\u200C', ' ')
                .replaceAll("\\s+", " ");

        if (t.equals("اخبار") || t.equals("خبر") || t.equals("همه اخبار") || t.equals("فوری")
                || t.equals("خبر فوری") || t.equals("برگزیده") || t.equals("ویژه")) {
            return null;
        }

        if (t.contains("رمزارز") || t.contains("ارز دیجیتال") || t.contains("بلاکچین") || t.contains("کریپتو") || t.contains("crypto")) {
            return "رمزارز";
        }
        if (t.contains("خودرو") || t.contains("ماشین") || t.contains("موتورسیکلت") || t.contains("auto")) {
            return "خودرو";
        }
        if (t.contains("آموزش") || t.contains("دانشگاه") || t.contains("مدرسه") || t.contains("کنکور") || t.contains("فرهنگیان") || t.contains("دانشجو")) {
            return "آموزشی";
        }
        if (t.contains("تکنولوژی") || t.contains("فناوری") || t.contains("دیجیتال") || t.contains("آی تی") || t.contains("هوش مصنوعی") || t.contains("موبایل") || t.contains("tech")) {
            return "تکنولوژی";
        }
        if (t.contains("ورزش") || t.contains("فوتبال") || t.contains("توپ و تور") || t.contains("المپیک") || t.contains("sport")) {
            return "ورزشی";
        }
        if (t.contains("اقتصاد") || t.contains("بازار") || t.contains("بورس") || t.contains("بانک") || t.contains("صنعت") || t.contains("تجارت") || t.contains("نفت") || t.contains("انرژی") || t.contains("مسکن")) {
            return "اقتصادی";
        }
        if (t.contains("بین الملل") || t.contains("جهان") || t.contains("خاورمیانه") || t.contains("سیاست خارجی") || t.contains("world")) {
            return "جهانی";
        }
        if (t.contains("سلامت") || t.contains("پزشکی") || t.contains("بهداشت") || t.contains("درمان") || t.contains("تغذیه") || t.contains("کلینیک")) {
            return "سلامت";
        }
        if (t.contains("سرگرمی") || t.contains("سینما") || t.contains("تلویزیون") || t.contains("گیم") || t.contains("بازی") || t.contains("سبک زندگی")) {
            return "سرگرمی";
        }
        if (t.contains("فرهنگ") || t.contains("هنر") || t.contains("کتاب") || t.contains("موسیقی") || t.contains("تئاتر") || t.contains("گردشگری") || t.contains("میراث") || t.contains("ادبیات")) {
            return "فرهنگ و هنر";
        }
        if (t.contains("اجتماع") || t.contains("جامعه") || t.contains("حوادث") || t.contains("شهری") || t.contains("محیط زیست") || t.contains("خانواده") || t.contains("انتظامی") || t.contains("قضایی") || t.contains("استان")) {
            return "اجتماعی";
        }
        if (t.contains("سیاس") || t.contains("مجلس") || t.contains("دولت") || t.contains("دفاع") || t.contains("امنیت")) {
            return "سیاسی";
        }

        return null;
    }
}