package com.NewsGrid.V10.service;

import com.NewsGrid.V10.entity.Source;
import com.rometools.rome.feed.synd.SyndCategory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;

/**
 * Publisher-Category Mapper (Zero Text/Title Inspection).
 * Maps the category tag explicitly chosen by the publishing website to one of Duta's 12 categories.
 */
@Service
public class CategoryClassifierService {

    /**
     * Maps RSS <category> tags declared by the source website to Duta's 12 categories.
     */
    public String classifyFromRssCategories(List<SyndCategory> rssCategories, Source source) {
        if (rssCategories != null && !rssCategories.isEmpty()) {
            for (SyndCategory cat : rssCategories) {
                if (cat != null && cat.getName() != null) {
                    String mapped = mapPublisherCategory(cat.getName());
                    if (mapped != null) {
                        return mapped;
                    }
                }
            }
        }
        return getSourceDefaultCategory(source);
    }

    /**
     * Maps an HTML category breadcrumb/tag declared by the source website to Duta's 12 categories.
     */
    public String classifyFromHtmlCategory(String htmlCategoryTag, Source source) {
        if (htmlCategoryTag != null && !htmlCategoryTag.isBlank()) {
            String mapped = mapPublisherCategory(htmlCategoryTag);
            if (mapped != null) {
                return mapped;
            }
        }
        return getSourceDefaultCategory(source);
    }

    public String classify(String ignoredTitle, Source source) {
        return getSourceDefaultCategory(source);
    }

    public String classify(String ignoredTitle) {
        return "اجتماعی";
    }

    private String getSourceDefaultCategory(Source source) {
        if (source != null && source.getCategory() != null && source.getCategory().getNameFa() != null) {
            return source.getCategory().getNameFa();
        }
        return "اجتماعی";
    }

    /**
     * Maps the publisher's own category name to one of Duta's 12 official categories.
     */
    public String mapPublisherCategory(String publisherCat) {
        if (publisherCat == null || publisherCat.isBlank()) return null;

        String t = publisherCat.trim().toLowerCase(Locale.ROOT)
                .replace('ي', 'ی')
                .replace('ك', 'ک')
                .replace('\u200C', ' ')
                .replaceAll("\\s+", " ");

        // Ignore non-topical status labels
        if (t.equals("اخبار") || t.equals("خبر") || t.equals("همه اخبار")
                || t.equals("فوری") || t.equals("خبر فوری") || t.equals("اخبار فوری")
                || t.equals("برگزیده") || t.equals("ویژه")) {
            return null;
        }

        // ۱. رمزارز
        if (t.contains("رمزارز") || t.contains("ارز دیجیتال") || t.contains("بلاکچین")
                || t.contains("کریپتو") || t.contains("بیت کوین") || t.contains("crypto")) {
            return "رمزارز";
        }

        // ۲. خودرو
        if (t.contains("خودرو") || t.contains("ماشین") || t.contains("موتورسیکلت") || t.contains("auto")) {
            return "خودرو";
        }

        // ۳. آموزشی
        if (t.contains("آموزش") || t.contains("دانشگاه") || t.contains("مدرسه") || t.contains("مدارس")
                || t.contains("کنکور") || t.contains("فرهنگیان") || t.contains("دانشجو")
                || t.contains("دانش آموز") || t.contains("پژوهش")) {
            return "آموزشی";
        }

        // ۴. تکنولوژی
        if (t.contains("تکنولوژی") || t.contains("فناوری") || t.contains("دیجیتال")
                || t.contains("آی تی") || t.contains("هوش مصنوعی") || t.contains("موبایل")
                || t.contains("سایبری") || t.contains("رایانه") || t.contains("tech")) {
            return "تکنولوژی";
        }

        // ۵. ورزشی
        if (t.contains("ورزش") || t.contains("فوتبال") || t.contains("توپ و تور")
                || t.contains("المپیک") || t.contains("کشتی و رزمی") || t.contains("sport")) {
            return "ورزشی";
        }

        // ۶. اقتصادی
        if (t.contains("اقتصاد") || t.contains("بازار") || t.contains("بورس") || t.contains("بانک")
                || t.contains("صنعت") || t.contains("تجارت") || t.contains("نفت") || t.contains("انرژی")
                || t.contains("مسکن") || t.contains("مالی") || t.contains("کسب و کار")) {
            return "اقتصادی";
        }

        // ۷. جهانی
        if (t.contains("بین الملل") || t.contains("جهان") || t.contains("خاورمیانه")
                || t.contains("سیاست خارجی") || t.contains("اروپا و آمریکا") || t.contains("world")) {
            return "جهانی";
        }

        // ۸. سلامت
        if (t.contains("سلامت") || t.contains("پزشکی") || t.contains("بهداشت")
                || t.contains("درمان") || t.contains("تغذیه") || t.contains("کلینیک")) {
            return "سلامت";
        }

        // ۹. سرگرمی
        if (t.contains("سرگرمی") || t.contains("سینما") || t.contains("تلویزیون")
                || t.contains("گیم") || t.contains("بازی") || t.contains("چهره ها")) {
            return "سرگرمی";
        }

        // ۱۰. فرهنگ و هنر
        if (t.contains("فرهنگ") || t.contains("هنر") || t.contains("کتاب") || t.contains("موسیقی")
                || t.contains("تئاتر") || t.contains("گردشگری") || t.contains("میراث")
                || t.contains("ادبیات") || t.contains("رسانه")) {
            return "فرهنگ و هنر";
        }

        // ۱۱. اجتماعی (شامل کتگوری «عمومی»، «جامعه»، «حوادث»، «استان‌ها» و...)
        if (t.contains("عمومی") || t.contains("اجتماع") || t.contains("جامعه")
                || t.contains("حوادث") || t.contains("شهری") || t.contains("محیط زیست")
                || t.contains("خانواده") || t.contains("انتظامی") || t.contains("قضایی")
                || t.contains("حقوقی") || t.contains("استان") || t.contains("گوناگون")
                || t.contains("زندگی") || t.contains("چندرسانه")) {
            return "اجتماعی";
        }

        // ۱۲. سیاسی
        if (t.contains("سیاس") || t.contains("مجلس") || t.contains("دولت")
                || t.contains("دفاع") || t.contains("امنیت") || t.contains("ایران")) {
            return "سیاسی";
        }

        return null;
    }
}