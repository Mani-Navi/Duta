package com.NewsGrid.V10.service;

import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * UCS-011: High-speed word-boundary location detector for Iranian provinces and major cities.
 */
@Service
public class LocationClassifierService {

    private static final Pattern NON_LETTER_PATTERN = Pattern.compile("[^\\p{L}\\p{N}]+");

    // Maps city/province keywords in news to the canonical city name selectable by users
    private static final Map<String, String> KEYWORD_TO_CITY = new LinkedHashMap<>();

    static {
        KEYWORD_TO_CITY.put("تهران", "تهران");
        KEYWORD_TO_CITY.put("پایتخت", "تهران");
        KEYWORD_TO_CITY.put("شیراز", "شیراز");
        KEYWORD_TO_CITY.put("فارس", "شیراز");
        KEYWORD_TO_CITY.put("اصفهان", "اصفهان");
        KEYWORD_TO_CITY.put("مشهد", "مشهد");
        KEYWORD_TO_CITY.put("خراسان رضوی", "مشهد");
        KEYWORD_TO_CITY.put("تبریز", "تبریز");
        KEYWORD_TO_CITY.put("آذربایجان شرقی", "تبریز");
        KEYWORD_TO_CITY.put("کرج", "کرج");
        KEYWORD_TO_CITY.put("البرز", "کرج");
        KEYWORD_TO_CITY.put("اهواز", "اهواز");
        KEYWORD_TO_CITY.put("خوزستان", "اهواز");
        KEYWORD_TO_CITY.put("رشت", "رشت");
        KEYWORD_TO_CITY.put("گیلان", "رشت");
        KEYWORD_TO_CITY.put("قم", "قم");
        KEYWORD_TO_CITY.put("کرمانشاه", "کرمانشاه");
        KEYWORD_TO_CITY.put("ارومیه", "ارومیه");
        KEYWORD_TO_CITY.put("آذربایجان غربی", "ارومیه");
        KEYWORD_TO_CITY.put("یزد", "یزد");
        KEYWORD_TO_CITY.put("کرمان", "کرمان");
        KEYWORD_TO_CITY.put("همدان", "همدان");
        KEYWORD_TO_CITY.put("بندرعباس", "بندرعباس");
        KEYWORD_TO_CITY.put("هرمزگان", "بندرعباس");
        KEYWORD_TO_CITY.put("ساری", "ساری");
        KEYWORD_TO_CITY.put("مازندران", "ساری");
        KEYWORD_TO_CITY.put("بوشهر", "بوشهر");
        KEYWORD_TO_CITY.put("زنجان", "زنجان");
        KEYWORD_TO_CITY.put("قزوین", "قزوین");
        KEYWORD_TO_CITY.put("اردبیل", "اردبیل");
        KEYWORD_TO_CITY.put("سنندج", "سنندج");
        KEYWORD_TO_CITY.put("کردستان", "سنندج");
        KEYWORD_TO_CITY.put("زاهدان", "زاهدان");
        KEYWORD_TO_CITY.put("سیستان و بلوچستان", "زاهدان");
        KEYWORD_TO_CITY.put("گرگان", "گرگان");
        KEYWORD_TO_CITY.put("گلستان", "گرگان");
        KEYWORD_TO_CITY.put("خرم آباد", "خرم‌آباد");
        KEYWORD_TO_CITY.put("لرستان", "خرم‌آباد");
        KEYWORD_TO_CITY.put("اراک", "اراک");
        KEYWORD_TO_CITY.put("ایلام", "ایلام");
        KEYWORD_TO_CITY.put("بجنورد", "بجنورد");
        KEYWORD_TO_CITY.put("بیرجند", "بیرجند");
        KEYWORD_TO_CITY.put("شهرکرد", "شهرکرد");
        KEYWORD_TO_CITY.put("سمنان", "سمنان");
        KEYWORD_TO_CITY.put("یاسوج", "یاسوج");
    }

    public String detectLocation(String title, String description) {
        String combined = ((title != null ? title : "") + " " + (description != null ? description : "")).trim();
        if (combined.isBlank()) return null;

        String normalized = combined.toLowerCase(Locale.ROOT)
                .replace('ي', 'ی')
                .replace('ك', 'ک')
                .replace('\u200C', ' ');
        normalized = NON_LETTER_PATTERN.matcher(normalized).replaceAll(" ").replaceAll("\\s+", " ").trim();

        String padded = " " + normalized + " ";

        for (Map.Entry<String, String> entry : KEYWORD_TO_CITY.entrySet()) {
            if (padded.contains(" " + entry.getKey() + " ")) {
                return entry.getValue();
            }
        }
        return null;
    }
}