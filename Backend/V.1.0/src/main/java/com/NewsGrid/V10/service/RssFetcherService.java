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
import java.util.Set;

@Service
@RequiredArgsConstructor
public class RssFetcherService {

    private final SourceRepository sourceRepository;
    private final ArticleRepository articleRepository;
    private final ClusteringService clusteringService;
    private final SlugService slugService;

    private static final Set<String> BREAKING_KEYWORDS = Set.of(
            "زلزله", "سیل", "آتش‌سوزی", "آتش سوزی", "انفجار", "حمله",
            "جنگ", "بمب", "موشک", "کشته", "شهید", "سقوط", "تصادف",
            "اورژانس", "بحران", "فوری", "خبر فوری", "ترور", "اشغال",
            "طوفان", "سونامی", "آتشفشان", "رانش", "گروگان",
            "earthquake", "flood", "fire", "explosion", "attack",
            "war", "bomb", "missile", "killed", "dead", "crash",
            "emergency", "crisis", "breaking", "urgent", "terror",
            "storm", "tsunami", "volcano"
    );

    @Scheduled(fixedRate = 300000)
    public void fetchAllSources() {
        ZonedDateTime cutoff = ZonedDateTime.now().minusDays(30);
        articleRepository.deleteByPublishedAtBefore(cutoff);

        List<Source> sources = sourceRepository.findAll();

        for (Source source : sources) {
            try {
                URL feedUrl = new URL(source.getRssUrl());
                SyndFeed feed = new SyndFeedInput().build(new XmlReader(feedUrl));

                for (SyndEntry entry : feed.getEntries()) {
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
                        // ساخت slug از تیتر
                        article.setSlug(slugService.generateSlug(entry.getTitle(), articleRepository));

                        articleRepository.save(article);
                        clusteringService.clusterArticle(article);
                    }
                }

                source.setLastFetchedAt(ZonedDateTime.now());
                sourceRepository.save(source);

            } catch (Exception e) {
                System.err.println("خطا در خواندن RSS: " + source.getName() + " — " + e.getMessage());
            }
        }
    }

    private boolean isBreaking(String title) {
        if (title == null) return false;
        String lower = title.toLowerCase();
        return BREAKING_KEYWORDS.stream().anyMatch(lower::contains);
    }
}