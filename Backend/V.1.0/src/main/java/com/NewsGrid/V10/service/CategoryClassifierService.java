package com.NewsGrid.V10.service;

import com.NewsGrid.V10.entity.Source;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class CategoryClassifierService {

    // هر کتگوری ➔ لیست کلمات کلیدی با وزن
    private static final Map<String, Map<String, Integer>> CATEGORY_KEYWORDS = new LinkedHashMap<>();

    static {
        // ── اقتصادی ──
        Map<String, Integer> eco = new HashMap<>();
        eco.put("بورس", 10); eco.put("سهام", 10); eco.put("بازار سرمایه", 10);
        eco.put("تورم", 9);  eco.put("نرخ ارز", 9); eco.put("دلار", 8);
        eco.put("بانک", 8);  eco.put("بودجه", 8);   eco.put("صادرات", 7);
        eco.put("واردات", 7); eco.put("نفت", 7);    eco.put("گاز", 7);
        eco.put("اقتصاد", 6); eco.put("قیمت", 5);  eco.put("گران", 5);
        eco.put("ارزان", 5);  eco.put("مالی", 6);   eco.put("سرمایه‌گذاری", 8);
        eco.put("تجارت", 7);  eco.put("بیمه", 6);   eco.put("گمرک", 7);
        eco.put("ریال", 8);   eco.put("یورو", 8);   eco.put("طلا", 7);
        eco.put("مسکن", 6);   eco.put("اشتغال", 6); eco.put("بیکاری", 7);
        CATEGORY_KEYWORDS.put("اقتصادی", eco);

        // ── سیاسی ──
        Map<String, Integer> pol = new HashMap<>();
        pol.put("مجلس", 10);      pol.put("نماینده", 9);   pol.put("انتخابات", 10);
        pol.put("رئیس‌جمهور", 10); pol.put("دولت", 8);     pol.put("وزیر", 9);
        pol.put("وزارت", 8);      pol.put("سیاست", 7);     pol.put("قانون", 7);
        pol.put("شورای نگهبان", 10); pol.put("قوه قضاییه", 9); pol.put("رهبری", 9);
        pol.put("حزب", 8);        pol.put("ائتلاف", 8);    pol.put("تحریم", 8);
        pol.put("دیپلماسی", 9);   pol.put("سفیر", 8);      pol.put("سفارت", 8);
        pol.put("معاون", 7);      pol.put("استعفا", 9);    pol.put("رای", 8);
        pol.put("مذاکره", 8);     pol.put("توافق", 7);     pol.put("پارلمان", 9);
        CATEGORY_KEYWORDS.put("سیاسی", pol);

        // ── ورزشی ──
        Map<String, Integer> sport = new HashMap<>();
        sport.put("فوتبال", 10); sport.put("لیگ", 9);      sport.put("گل", 8);
        sport.put("بازی", 7);    sport.put("تیم", 7);      sport.put("المپیک", 10);
        sport.put("جام", 9);     sport.put("قهرمان", 8);   sport.put("مسابقه", 8);
        sport.put("ورزشکار", 9); sport.put("کشتی", 9);     sport.put("والیبال", 9);
        sport.put("بسکتبال", 9); sport.put("تنیس", 9);     sport.put("شنا", 8);
        sport.put("مربی", 7);    sport.put("استادیوم", 8); sport.put("ورزشگاه", 8);
        sport.put("پنالتی", 9);  sport.put("فیفا", 10);    sport.put("استقلال", 9);
        sport.put("پرسپولیس", 9);
        CATEGORY_KEYWORDS.put("ورزشی", sport);

        // ── تکنولوژی ──
        Map<String, Integer> tech = new HashMap<>();
        tech.put("هوش مصنوعی", 10); tech.put("ChatGPT", 10); tech.put("گوگل", 8);
        tech.put("اپل", 8);         tech.put("مایکروسافت", 8); tech.put("اینترنت", 7);
        tech.put("موبایل", 7);      tech.put("اپلیکیشن", 8); tech.put("نرم‌افزار", 9);
        tech.put("سخت‌افزار", 9);   tech.put("فناوری", 8);   tech.put("دیجیتال", 7);
        tech.put("استارتاپ", 9);    tech.put("سایبری", 9);   tech.put("هک", 9);
        tech.put("رمزارز", 9);      tech.put("بیت‌کوین", 10); tech.put("بلاکچین", 10);
        tech.put("ماهواره", 8);     tech.put("فضایی", 7);    tech.put("ربات", 8);
        tech.put("چیپ", 8);         tech.put("پردازنده", 9); tech.put("سامسونگ", 8);
        CATEGORY_KEYWORDS.put("تکنولوژی", tech);

        // ── جهانی ──
        Map<String, Integer> world = new HashMap<>();
        world.put("آمریکا", 8);    world.put("اروپا", 8);    world.put("چین", 8);
        world.put("روسیه", 8);     world.put("اسرائیل", 9);  world.put("غزه", 10);
        world.put("اوکراین", 9);   world.put("سازمان ملل", 10); world.put("ناتو", 10);
        world.put("بین‌الملل", 9); world.put("جهان", 6);     world.put("خارجی", 6);
        world.put("فرانسه", 7);    world.put("آلمان", 7);    world.put("انگلیس", 7);
        world.put("پوتین", 8);     world.put("ترامپ", 8);    world.put("بایدن", 8);
        CATEGORY_KEYWORDS.put("جهانی", world);
    }

    /**
     * تشخیص هوشمند کتگوری از روی تیتر خبر
     * @param title تیتر خبر
     * @param source منبع خبر جهت دریافت کتگوری پشتیبان (Fallback) در صورت عدم تطابق کلمات کلیدی
     * @return نام کتگوری واقعی (بدون عبارت "عمومی")
     */
    public String classify(String title, Source source) {
        // تعیین کتگوری پشتیبان از روی منبع (در صورت پیدا نشدن کلمات کلیدی)
        String fallbackCategory = (source != null && source.getCategory() != null && source.getCategory().getNameFa() != null)
                ? source.getCategory().getNameFa()
                : "سیاسی";

        if (title == null || title.isBlank()) return fallbackCategory;

        String lower = title.toLowerCase();
        Map<String, Integer> scores = new HashMap<>();

        // محاسبه امتیاز هر کتگوری
        for (Map.Entry<String, Map<String, Integer>> catEntry : CATEGORY_KEYWORDS.entrySet()) {
            String category = catEntry.getKey();
            int totalScore = 0;

            for (Map.Entry<String, Integer> kwEntry : catEntry.getValue().entrySet()) {
                if (lower.contains(kwEntry.getKey())) {
                    totalScore += kwEntry.getValue();
                }
            }

            if (totalScore > 0) {
                scores.put(category, totalScore);
            }
        }

        // اگر هیچ کلمه کلیدی پیدا نشد، کتگوری پشتیبان منبع برگردانده می‌شود
        if (scores.isEmpty()) return fallbackCategory;

        // انتخاب کتگوری با بالاترین امتیاز
        return scores.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .get()
                .getKey();
    }
}