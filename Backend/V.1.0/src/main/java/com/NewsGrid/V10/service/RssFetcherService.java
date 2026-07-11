package com.NewsGrid.V10.service;

import com.NewsGrid.V10.entity.Article;
import com.NewsGrid.V10.entity.Source;
import com.NewsGrid.V10.repository.ArticleRepository;
import com.NewsGrid.V10.repository.SourceRepository;
import com.rometools.rome.feed.synd.SyndEntry;
import com.rometools.rome.feed.synd.SyndFeed;
import com.rometools.rome.io.SyndFeedInput;
import com.rometools.rome.io.XmlReader;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.net.URL;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class RssFetcherService {

    private final SourceRepository sourceRepository;
    private final ArticleRepository articleRepository;

    // هر ۱۵ دقیقه یکبار اجرا میشه — UCS-005 گام ۱
    @Scheduled(fixedRate = 300000)
    public void fetchAllSources() {

        ZonedDateTime cutoff = ZonedDateTime.now().minusDays(7);
        articleRepository.deleteByPublishedAtBefore(cutoff);
        System.out.println("اخبار قدیمی‌تر از ۷ روز حذف شدند.");

        // UCS-005 گام ۲ — لیست منابع از دیتابیس
        List<Source> sources = sourceRepository.findAll();

        for (Source source : sources) {
            try {
                // UCS-005 گام ۳ — خواندن RSS هر منبع
                URL feedUrl = new URL(source.getRssUrl());
                SyndFeed feed = new SyndFeedInput()
                        .build(new XmlReader(feedUrl));

                // UCS-005 گام ۴ — پارس اخبار جدید
                for (SyndEntry entry : feed.getEntries()) {


                    // UCS-005 گام ۵ — بررسی تکراری بودن
                    if (!articleRepository.existsByUrl(entry.getLink())) {

                        // UCS-005 گام ۷ — ذخیره خبر جدید
                        Article article = new Article();
                        article.setTitle(entry.getTitle());
                        article.setUrl(entry.getLink());

                        if (entry.getPublishedDate() != null) {
                            article.setPublishedAt(
                                    entry.getPublishedDate()
                                            .toInstant()
                                            .atZone(ZoneId.systemDefault())
                            );
                        } else {
                            article.setPublishedAt(ZonedDateTime.now());
                        }

                        article.setSource(source);
                        articleRepository.save(article);
                    }
                }

                // UCS-005 گام ۸ — ثبت زمان آخرین آپدیت
                source.setLastFetchedAt(ZonedDateTime.now());
                sourceRepository.save(source);

            } catch (Exception e) {
                // UCS-005 — استثنا: خطا لاگ میشه، منبع بعدی پردازش میشه
                System.err.println("خطا در خواندن RSS: "
                        + source.getName() + " — " + e.getMessage());
            }
        }
    }
}
