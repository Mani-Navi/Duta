package com.NewsGrid.V10.service;

import com.NewsGrid.V10.entity.Article;
import com.NewsGrid.V10.entity.Source;
import com.NewsGrid.V10.entity.SourceType;
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
import java.net.URLConnection;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class RssFetcherService {

    private final SourceRepository sourceRepository;
    private final ArticleRepository articleRepository;
    private final ClusteringService clusteringService;
    private final SlugService slugService;

    private static final Set<String> BREAKING_KEYWORDS = Set.of(
            "زلزله", "سیل", "آتش‌سوزی", "انفجار", "حمله", "جنگ", "بمب", "موشک",
            "کشته", "شهید", "سقوط", "تصادف", "اورژانس", "بحران", "فوری", "خبر فوری", "ترور"
    );

    @Scheduled(fixedRate = 300000)
    public void fetchAllSources() {
        ZonedDateTime cutoff = ZonedDateTime.now().minusDays(30);
        articleRepository.deleteByPublishedAtBefore(cutoff);

        List<Source> sources = sourceRepository.findAll().stream()
                .filter(s -> (s.getSourceType() == null || s.getSourceType() == SourceType.RSS))
                .filter(s -> s.getRssUrl() != null && !s.getRssUrl().contains("t.me/"))
                .toList();

        System.out.println("🚀 شروع دریافت اخبار RSS برای " + sources.size() + " منبع...");

        for (Source source : sources) {
            try {
                // شبیه‌سازی دقیق مرورگر واقعی Chrome جهت دور زدن فایروال کلودفلر/ابرآروان سایت‌ها
                URL feedUrl = new URL(source.getRssUrl());
                URLConnection conn = feedUrl.openConnection();
                conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
                conn.setRequestProperty("Accept", "application/rss+xml, application/xml, text/xml, */*");
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(10000);

                SyndFeed feed = new SyndFeedInput().build(new XmlReader(conn));
                int savedCount = 0;

                for (SyndEntry entry : feed.getEntries()) {
                    try {
                        if (!articleRepository.existsByUrl(entry.getLink())) {
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
                            article.setBreaking(isBreaking(entry.getTitle()));
                            article.setSlug(slugService.generateSlug(entry.getTitle(), articleRepository));

                            articleRepository.save(article);
                            clusteringService.clusterArticle(article);
                            savedCount++;
                        }
                    } catch (Exception ignored) {
                        // حذف لاگ داخل حلقه جهت جلوگیری از پر شدن حجم لاگ در Railway
                    }
                }

                source.setLastFetchedAt(ZonedDateTime.now());
                sourceRepository.save(source);
                System.out.println("✅ RSS " + source.getName() + ": " + savedCount + " خبر جدید.");

            } catch (Exception e) {
                System.err.println("❌ خطا در RSS " + source.getName() + " ➔ " + e.getMessage());
            }
        }
    }

    private boolean isBreaking(String title) {
        if (title == null) return false;
        String lower = title.toLowerCase();
        return BREAKING_KEYWORDS.stream().anyMatch(lower::contains);
    }
}