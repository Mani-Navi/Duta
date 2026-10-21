package com.NewsGrid.V10.service;

import com.NewsGrid.V10.entity.Source;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Pattern;

@Service
public class CategoryClassifierService {

    private static final Map<String, Map<String, Integer>> CATEGORY_KEYWORDS = new LinkedHashMap<>();
    private static final Pattern NON_LETTER_PATTERN = Pattern.compile("[^\\p{L}\\p{N}]+");
    private static final Pattern SUFFIX_PATTERN = Pattern.compile("(هایی|های|ها)(?=\\s|$)");

    static {
        // ── اقتصادی ──
        Map<String, Integer> eco = new HashMap<>();
        eco.put("بورس", 10); eco.put("سهام", 10); eco.put("بازار سرمایه", 10);
        eco.put("تورم", 9);  eco.put("نرخ ارز", 9); eco.put("دلار", 8);
        eco.put("بانک", 8);  eco.put("بودجه", 8);   eco.put("صادرات", 7);
        eco.put("واردات", 7); eco.put("نفت", 7);    eco.put("گاز", 7);
        eco.put("اقتصاد", 6); eco.put("اقتصادی", 7); eco.put("قیمت", 5);
        eco.put("گرانی", 6);  eco.put("مالیات", 8);  eco.put("مالی", 6);
        eco.put("سرمایه گذاری", 8); eco.put("تجارت", 7); eco.put("بیمه", 6);
        eco.put("گمرک", 7);   eco.put("ریال", 8);   eco.put("یورو", 8);
        eco.put("طلا", 9);    eco.put("سکه", 9);    eco.put("مسکن", 7);
        eco.put("اشتغال", 6); eco.put("بیکاری", 7); eco.put("تسهیلات", 7);
        eco.put("وام", 8);    eco.put("یارانه", 8);  eco.put("معیشت", 7);
        CATEGORY_KEYWORDS.put("اقتصادی", eco);

        // ── سیاسی ──
        Map<String, Integer> pol = new HashMap<>();
        pol.put("مجلس", 10);      pol.put("نماینده", 8);   pol.put("انتخابات", 10);
        pol.put("رئیس جمهور", 10); pol.put("دولت", 8);     pol.put("وزیر", 9);
        pol.put("وزارت", 8);      pol.put("سیاست", 7);     pol.put("سیاسی", 7);
        pol.put("قانون", 7);      pol.put("شورای نگهبان", 10); pol.put("قوه قضاییه", 9);
        pol.put("رهبری", 9);      pol.put("حزب", 8);       pol.put("ائتلاف", 8);
        pol.put("تحریم", 8);      pol.put("دیپلماسی", 9);  pol.put("سفیر", 8);
        pol.put("سفارت", 8);      pol.put("معاون", 7);     pol.put("استعفا", 9);
        pol.put("رای", 8);        pol.put("مذاکره", 8);    pol.put("مذاکرات", 9);
        pol.put("توافق", 7);      pol.put("پارلمان", 9);   pol.put("تکذیب", 7);
        pol.put("تنگه هرمز", 10); pol.put("نظامی", 8);     pol.put("سپاه", 9);
        pol.put("ارتش", 8);       pol.put("انرژی هسته ای", 10);
        CATEGORY_KEYWORDS.put("سیاسی", pol);

        // ── ورزشی ──
        Map<String, Integer> sport = new HashMap<>();
        sport.put("فوتبال", 10); sport.put("لیگ", 9);      sport.put("گل", 7);
        sport.put("المپیک", 10); sport.put("جام جهانی", 10); sport.put("جام", 8);
        sport.put("قهرمان", 8);  sport.put("قهرمانی", 9);  sport.put("مسابقه", 8);
        sport.put("ورزشکار", 9); sport.put("ورزش", 8);     sport.put("ورزشی", 8);
        sport.put("کشتی", 9);    sport.put("والیبال", 9);  sport.put("بسکتبال", 9);
        sport.put("تنیس", 9);    sport.put("شنا", 8);      sport.put("سرمربی", 9);
        sport.put("مربی", 7);    sport.put("استادیوم", 8); sport.put("ورزشگاه", 8);
        sport.put("پنالتی", 9);  sport.put("فیفا", 10);    sport.put("استقلال", 9);
        sport.put("پرسپولیس", 9); sport.put("تراکتور", 9); sport.put("سپاهان", 9);
        CATEGORY_KEYWORDS.put("ورزشی", sport);

        // ── تکنولوژی ──
        Map<String, Integer> tech = new HashMap<>();
        tech.put("هوش مصنوعی", 10); tech.put("chatgpt", 10); tech.put("گوگل", 8);
        tech.put("اپل", 8);         tech.put("آیفون", 9);    tech.put("مایکروسافت", 8);
        tech.put("اینترنت", 7);     tech.put("موبایل", 7);   tech.put("اپلیکیشن", 8);
        tech.put("نرم افزار", 9);   tech.put("سخت افزار", 9); tech.put("فناوری", 8);
        tech.put("تکنولوژی", 9);    tech.put("دیجیتال", 7);  tech.put("استارتاپ", 9);
        tech.put("سایبری", 9);      tech.put("هک", 9);       tech.put("هکر", 9);
        tech.put("رمزارز", 9);      tech.put("بیت کوین", 10); tech.put("بلاکچین", 10);
        tech.put("ماهواره", 8);     tech.put("فضایی", 7);    tech.put("ربات", 8);
        tech.put("چیپ", 8);         tech.put("پردازنده", 9); tech.put("سامسونگ", 8);
        CATEGORY_KEYWORDS.put("تکنولوژی", tech);

        // ── جهانی ──
        Map<String, Integer> world = new HashMap<>();
        world.put("آمریکا", 8);    world.put("اروپا", 8);    world.put("چین", 8);
        world.put("روسیه", 8);     world.put("اسرائیل", 9);  world.put("غزه", 10);
        world.put("لبنان", 8);     world.put("اوکراین", 9);  world.put("سازمان ملل", 10);
        world.put("ناتو", 10);     world.put("بین الملل", 9); world.put("بین المللی", 8);
        world.put("جهان", 6);      world.put("فرانسه", 7);   world.put("آلمان", 7);
        world.put("انگلیس", 7);    world.put("پوتین", 8);    world.put("ترامپ", 8);
        world.put("بایدن", 8);     world.put("کاخ سفید", 9);
        CATEGORY_KEYWORDS.put("جهانی", world);

        // ── سرگرمی (سینما، سریال و گیمینگ) ──
        Map<String, Integer> ent = new HashMap<>();
        ent.put("فیلم سینمایی", 10); ent.put("سریال", 10);   ent.put("سینما", 10);
        ent.put("سینمایی", 9);       ent.put("گیم", 9);      ent.put("بازی ویدئویی", 10);
        ent.put("گیمینگ", 9);        ent.put("پلی استیشن", 9); ent.put("ایکس باکس", 9);
        ent.put("ps5", 10);          ent.put("xbox", 10);    ent.put("هالیوود", 8);
        ent.put("اکران", 8);         ent.put("بازیگر", 8);   ent.put("کارگردان", 8);
        ent.put("انیمیشن", 8);       ent.put("انیمه", 8);    ent.put("تریلر", 8);
        ent.put("تیزر", 7);          ent.put("جشنواره فجر", 9); ent.put("اسکار", 10);
        ent.put("استیم", 8);         ent.put("گیمر", 8);     ent.put("gta", 10);
        CATEGORY_KEYWORDS.put("سرگرمی", ent);
    }

    public String classify(String title) {
        return classify(title, null);
    }

    public String classify(String title, Source source) {
        String fallbackCategory = (source != null && source.getCategory() != null && source.getCategory().getNameFa() != null)
                ? source.getCategory().getNameFa()
                : "سیاسی";

        if (title == null || title.isBlank()) return fallbackCategory;

        // نرمال‌سازی متن و ایجاد مرز کلمه با فاصله در ابتدا و انتها
        String normalized = normalizeText(title);
        String paddedTitle = " " + normalized + " ";

        String bestCategory = fallbackCategory;
        int maxScore = 0;

        for (Map.Entry<String, Map<String, Integer>> catEntry : CATEGORY_KEYWORDS.entrySet()) {
            int totalScore = 0;

            for (Map.Entry<String, Integer> kwEntry : catEntry.getValue().entrySet()) {
                // جستجوی دقیق کلمه یا عبارت با مرز فاصله
                String boundedKeyword = " " + kwEntry.getKey() + " ";
                if (paddedTitle.contains(boundedKeyword)) {
                    totalScore += kwEntry.getValue();
                }
            }

            if (totalScore > maxScore) {
                maxScore = totalScore;
                bestCategory = catEntry.getKey();
            }
        }

        return bestCategory;
    }

    private String normalizeText(String input) {
        String s = input.toLowerCase(Locale.ROOT)
                .replace('ي', 'ی')
                .replace('ك', 'ک')
                .replace('\u200C', ' '); // تبدیل نیم‌فاصله به فاصله استاندارد

        // تبدیل علائم نگارشی به فاصله
        s = NON_LETTER_PATTERN.matcher(s).replaceAll(" ").trim();
        // جدا کردن پسوندهای جمع چسبیده (مثل بورس‌ها -> بورس ها)
        s = SUFFIX_PATTERN.matcher(s).replaceAll(" ");
        return s.replaceAll("\\s+", " ").trim();
    }
}