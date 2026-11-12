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
        // ── ۱. آموزشی (کنکور، سازمان سنجش، کانون، مدارس و دانشگاه) ──
        Map<String, Integer> edu = new HashMap<>();
        edu.put("کنکور", 10); edu.put("سازمان سنجش", 10); edu.put("متادرس", 10);
        edu.put("قلم چی", 10); edu.put("کانون فرهنگی آموزش", 10); edu.put("آموزش و پرورش", 10);
        edu.put("امتحان نهایی", 10); edu.put("ترمیم معدل", 10); edu.put("انتخاب رشته", 10);
        edu.put("کارت ورود به جلسه", 10); edu.put("رتبه برتر", 10); edu.put("تیزهوشان", 10);
        edu.put("سمپاد", 10); edu.put("فرهنگیان", 9); edu.put("دانشگاه فرهنگیان", 10);
        edu.put("هدایت تحصیلی", 10); edu.put("کارشناسی ارشد", 10); edu.put("آزمون دکتری", 10);
        edu.put("دانشگاه آزاد", 10); edu.put("پیام نور", 9); edu.put("وزارت علوم", 10);
        edu.put("دانش آموز", 9); edu.put("دانش آموزان", 9); edu.put("دانشجو", 9);
        edu.put("دانشجویان", 9); edu.put("دانشگاه", 8); edu.put("مدارس", 9);
        edu.put("مدرسه", 8); edu.put("معلم", 9); edu.put("فرهنگیان", 9);
        edu.put("پایه دوازدهم", 10); edu.put("پایه یازدهم", 10); edu.put("پایه دهم", 10);
        edu.put("امتحانات", 9); edu.put("کارنامه", 9); edu.put("المپیاد", 9);
        edu.put("تحصیلی", 9); edu.put("کتاب درسی", 10); edu.put("سوالات امتحان", 10);
        CATEGORY_KEYWORDS.put("آموزشی", edu);

        // ── ۲. رمزارز و فین‌تک ──
        Map<String, Integer> crypto = new HashMap<>();
        crypto.put("بیت کوین", 10); crypto.put("اتریوم", 10); crypto.put("رمزارز", 10);
        crypto.put("ارز دیجیتال", 10); crypto.put("بلاکچین", 10); crypto.put("تتر", 9);
        crypto.put("ساتوشی", 9); crypto.put("بایننس", 9); crypto.put("کیف پول", 8);
        crypto.put("ماینینگ", 9); crypto.put("ماینر", 9); crypto.put("آلت کوین", 10);
        crypto.put("دوج کوین", 10); crypto.put("سولانا", 10); crypto.put("ریپل", 9);
        crypto.put("فین تک", 9); crypto.put("صرافی ارز", 10); crypto.put("کریپتو", 10);
        CATEGORY_KEYWORDS.put("رمزارز", crypto);

        // ── ۳. خودرو و صنعت ──
        Map<String, Integer> auto = new HashMap<>();
        auto.put("خودرو", 10); auto.put("ایران خودرو", 10); auto.put("سایپا", 10);
        auto.put("واردات خودرو", 10); auto.put("قیمت خودرو", 10); auto.put("پژو", 9);
        auto.put("سمند", 9); auto.put("دنا", 9); auto.put("تارا", 9);
        auto.put("شاهین", 9); auto.put("کوییک", 9); auto.put("پراید", 9);
        auto.put("گیربکس", 8); auto.put("پیشرانه", 8); auto.put("خودروساز", 9);
        auto.put("خودروسازی", 9); auto.put("موتورسیکلت", 8); auto.put("برقی", 6);
        auto.put("هیبریدی", 8); auto.put("شاسی بلند", 9); auto.put("تویوتا", 8);
        auto.put("هیوندای", 8); auto.put("بنز", 8); auto.put("بی ام و", 8);
        CATEGORY_KEYWORDS.put("خودرو", auto);

        // ── ۴. اقتصادی ──
        Map<String, Integer> eco = new HashMap<>();
        eco.put("بورس", 10); eco.put("سهام", 10); eco.put("بازار سرمایه", 10);
        eco.put("تورم", 9);  eco.put("نرخ ارز", 9); eco.put("دلار", 8);
        eco.put("بانک", 8);  eco.put("بودجه", 8);   eco.put("صادرات", 7);
        eco.put("واردات", 7); eco.put("نفت", 7);    eco.put("گاز", 7);
        eco.put("اقتصاد", 6); eco.put("اقتصادی", 7); eco.put("قیمت", 5);
        eco.put("گرانی", 6);  eco.put("مالیات", 8);  eco.put("مالی", 6);
        eco.put("سرمایه گذاری", 8); eco.put("تجارت", 7); eco.put("بیمه", 6);
        eco.put("گمرک", 7);   eco.put("ریال", 8);   eco.put("یورو", 8);
        eco.put("طلا", 9);    eco.put("سکه", 9);    eco.put("مسکن", 8);
        eco.put("اجاره", 7);  eco.put("بیکاری", 7); eco.put("تسهیلات", 7);
        eco.put("وام", 8);    eco.put("یارانه", 8);  eco.put("معیشت", 7);
        eco.put("حقوق", 6);   eco.put("بازنشستگان", 8);
        CATEGORY_KEYWORDS.put("اقتصادی", eco);

        // ── ۵. سیاسی ──
        Map<String, Integer> pol = new HashMap<>();
        pol.put("مجلس", 10);      pol.put("نماینده", 8);   pol.put("انتخابات", 10);
        pol.put("رئیس جمهور", 10); pol.put("دولت", 8);     pol.put("وزیر", 9);
        pol.put("وزارت", 8);      pol.put("سیاست", 7);     pol.put("سیاسی", 7);
        pol.put("شورای نگهبان", 10); pol.put("رهبری", 9);  pol.put("حزب", 8);
        pol.put("ائتلاف", 8);     pol.put("تحریم", 8);     pol.put("دیپلماسی", 9);
        pol.put("سفیر", 8);       pol.put("سفارت", 8);     pol.put("استعفا", 9);
        pol.put("رای", 8);        pol.put("مذاکره", 8);    pol.put("مذاکرات", 9);
        pol.put("توافق", 7);      pol.put("پارلمان", 9);   pol.put("سپاه", 9);
        pol.put("ارتش", 8);       pol.put("انرژی هسته ای", 10); pol.put("پزشکیان", 9);
        CATEGORY_KEYWORDS.put("سیاسی", pol);

        // ── ۶. اجتماعی و حوادث ──
        Map<String, Integer> soc = new HashMap<>();
        soc.put("حوادث", 10); soc.put("حادثه", 8); soc.put("تصادف", 9);
        soc.put("آتش سوزی", 9); soc.put("زلزله", 10); soc.put("سیل", 9);
        soc.put("پلیس", 9); soc.put("فراجا", 9); soc.put("دادگاه", 9);
        soc.put("قوه قضاییه", 9); soc.put("بازداشت", 8); soc.put("زندان", 8);
        soc.put("شهرداری", 8); soc.put("مترو", 8); soc.put("ترافیک", 8);
        soc.put("هواشناسی", 9); soc.put("بارش", 8); soc.put("آلودگی هوا", 10);
        soc.put("محیط زیست", 9); soc.put("تعطیلی", 8); soc.put("اجتماعی", 8);
        soc.put("اورژانس", 8);
        CATEGORY_KEYWORDS.put("اجتماعی", soc);

        // ── ۷. ورزشی ──
        Map<String, Integer> sport = new HashMap<>();
        sport.put("فوتبال", 10); sport.put("لیگ", 9);      sport.put("گل", 7);
        sport.put("المپیک", 10); sport.put("جام جهانی", 10); sport.put("جام", 8);
        sport.put("قهرمان", 8);  sport.put("قهرمانی", 9);  sport.put("مسابقه", 8);
        sport.put("ورزشکار", 9); sport.put("ورزش", 8);     sport.put("ورزشی", 8);
        sport.put("کشتی", 9);    sport.put("والیبال", 9);  sport.put("بسکتبال", 9);
        sport.put("تنیس", 9);    sport.put("شنا", 8);      sport.put("سرمربی", 9);
        sport.put("مربی", 7);    sport.put("استادیوم", 8); sport.put("ورزشگاه", 8);
        sport.put("پنالتی", 9);  sport.put("فیفا", 10);    sport.put("استقلال", 10);
        sport.put("پرسپولیس", 10); sport.put("تراکتور", 9); sport.put("سپاهان", 9);
        CATEGORY_KEYWORDS.put("ورزشی", sport);

        // ── ۸. تکنولوژی ──
        Map<String, Integer> tech = new HashMap<>();
        tech.put("هوش مصنوعی", 10); tech.put("chatgpt", 10); tech.put("گوگل", 8);
        tech.put("اپل", 8);         tech.put("آیفون", 9);    tech.put("مایکروسافت", 8);
        tech.put("اینترنت", 7);     tech.put("موبایل", 7);   tech.put("اپلیکیشن", 8);
        tech.put("نرم افزار", 9);   tech.put("سخت افزار", 9); tech.put("فناوری", 8);
        tech.put("تکنولوژی", 9);    tech.put("دیجیتال", 7);  tech.put("استارتاپ", 9);
        tech.put("سایبری", 9);      tech.put("هک", 9);       tech.put("هکر", 9);
        tech.put("ماهواره", 8);     tech.put("ربات", 8);     tech.put("پردازنده", 9);
        tech.put("سامسونگ", 8);     tech.put("شیائومی", 8);  tech.put("فیلترینگ", 8);
        CATEGORY_KEYWORDS.put("تکنولوژی", tech);

        // ── ۹. سلامت و علمی ──
        Map<String, Integer> health = new HashMap<>();
        health.put("سلامت", 9); health.put("پزشکی", 10); health.put("بیماری", 8);
        health.put("بیمارستان", 8); health.put("دارو", 9); health.put("درمان", 8);
        health.put("واکسن", 9); health.put("سرطان", 9); health.put("تغذیه", 9);
        health.put("ویتامین", 9); health.put("قلب", 7); health.put("دیابت", 9);
        health.put("روانشناسی", 9); health.put("نجوم", 9); health.put("ناسا", 9);
        health.put("فضا", 7); health.put("علمی", 8); health.put("پژوهش", 7);
        CATEGORY_KEYWORDS.put("سلامت", health);

        // ── ۱۰. جهانی ──
        Map<String, Integer> world = new HashMap<>();
        world.put("آمریکا", 8);    world.put("اروپا", 8);    world.put("چین", 8);
        world.put("روسیه", 8);     world.put("اسرائیل", 9);  world.put("غزه", 10);
        world.put("لبنان", 8);     world.put("اوکراین", 9);  world.put("سازمان ملل", 10);
        world.put("ناتو", 10);     world.put("بین الملل", 9); world.put("بین المللی", 8);
        world.put("جهان", 6);      world.put("فرانسه", 7);   world.put("آلمان", 7);
        world.put("انگلیس", 7);    world.put("پوتین", 8);    world.put("ترامپ", 8);
        world.put("کاخ سفید", 9);  world.put("اتحادیه اروپا", 9);
        CATEGORY_KEYWORDS.put("جهانی", world);

        // ── ۱۱. سرگرمی (سینما، سریال و گیمینگ) ──
        Map<String, Integer> ent = new HashMap<>();
        ent.put("فیلم سینمایی", 10); ent.put("سریال", 10);   ent.put("سینما", 10);
        ent.put("سینمایی", 9);       ent.put("گیم", 9);      ent.put("بازی ویدئویی", 10);
        ent.put("گیمینگ", 9);        ent.put("پلی استیشن", 9); ent.put("ایکس باکس", 9);
        ent.put("ps5", 10);          ent.put("xbox", 10);    ent.put("هالیوود", 8);
        ent.put("اکران", 8);         ent.put("بازیگر", 8);   ent.put("کارگردان", 8);
        ent.put("انیمیشن", 8);       ent.put("انیمه", 8);    ent.put("تریلر", 8);
        ent.put("اسکار", 10);        ent.put("استیم", 8);    ent.put("گیمر", 8);
        CATEGORY_KEYWORDS.put("سرگرمی", ent);

        // ── ۱۲. فرهنگ و هنر ──
        Map<String, Integer> cul = new HashMap<>();
        cul.put("کتاب", 9); cul.put("موسیقی", 10); cul.put("کنسرت", 10);
        cul.put("تئاتر", 10); cul.put("نمایشگاه", 8); cul.put("میراث فرهنگی", 10);
        cul.put("گردشگری", 9); cul.put("شعر", 8); cul.put("ادبیات", 9);
        cul.put("نقاشی", 9); cul.put("هنری", 8); cul.put("موزه", 8);
        cul.put("باستان شناسی", 9); cul.put("سمفونی", 9);
        CATEGORY_KEYWORDS.put("فرهنگ و هنر", cul);
    }

    public String classify(String title) {
        return classify(title, null);
    }

    public String classify(String title, Source source) {
        String fallbackCategory = (source != null && source.getCategory() != null && source.getCategory().getNameFa() != null)
                ? source.getCategory().getNameFa()
                : "سیاسی";

        if (title == null || title.isBlank()) return fallbackCategory;

        String normalized = normalizeText(title);
        String paddedTitle = " " + normalized + " ";

        String bestCategory = fallbackCategory;
        int maxScore = 0;

        for (Map.Entry<String, Map<String, Integer>> catEntry : CATEGORY_KEYWORDS.entrySet()) {
            int totalScore = 0;

            for (Map.Entry<String, Integer> kwEntry : catEntry.getValue().entrySet()) {
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
                .replace('\u200C', ' ');

        s = NON_LETTER_PATTERN.matcher(s).replaceAll(" ").trim();
        s = SUFFIX_PATTERN.matcher(s).replaceAll(" ");
        return s.replaceAll("\\s+", " ").trim();
    }
}