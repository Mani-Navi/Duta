package com.NewsGrid.V10.service;

import com.NewsGrid.V10.entity.Article;
import com.NewsGrid.V10.entity.Source;
import com.NewsGrid.V10.entity.SourceType;
import com.NewsGrid.V10.repository.ArticleRepository;
import com.NewsGrid.V10.repository.SourceRepository;
import lombok.RequiredArgsConstructor;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class TelegramScraperService {

    private final SourceRepository sourceRepository;
    private final ArticleRepository articleRepository;
    private final ClusteringService clusteringService;
    private final SlugService slugService;

    private static final Set<String> BREAKING_KEYWORDS = Set.of(
            "زلزله", "سیل", "آتش‌سوزی", "انفجار", "حمله", "جنگ", "بمب", "موشک",
            "کشته", "شهید", "سقوط", "تصادف", "اورژانس", "بحران", "فوری", "خبر فوری", "ترور"
    );

    @Scheduled(fixedRate = 300000) // هر ۵ دقیقه
    public void fetchRecentPosts() {
        List<Source> telegramSources = sourceRepository.findBySourceType(SourceType.TELEGRAM);

        for (Source source : telegramSources) {
            fetchChannelPosts(source);
        }
    }

    public void fetchChannelPosts(Source source) {
        if (source.getTelegramUsername() == null || source.getTelegramUsername().isBlank()) {
            return;
        }

        try {
            String cleanUsername = source.getTelegramUsername().replace("@", "").trim();
            String url = "https://t.me/s/" + cleanUsername;

            Document doc = Jsoup.connect(url)
                    .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
                    .header("Accept-Language", "fa-IR,fa;q=0.9,en-US;q=0.8,en;q=0.7")
                    .timeout(12000)
                    .get();

            Elements posts = doc.select(".tgme_widget_message");
            int savedCount = 0;

            for (Element post : posts) {
                try {
                    Element textEl = post.selectFirst(".tgme_widget_message_text");
                    Element dateAnchor = post.selectFirst(".tgme_widget_message_date");

                    if (textEl == null || dateAnchor == null) continue;

                    String fullText = textEl.text().trim();
                    String link = dateAnchor.attr("href");

                    if (fullText.isBlank() || articleRepository.existsByUrl(link)) {
                        continue;
                    }

                    String title = extractTitle(fullText);

                    ZonedDateTime publishedAt = ZonedDateTime.now();
                    Element timeEl = post.selectFirst("time[datetime]");
                    if (timeEl != null) {
                        try {
                            publishedAt = ZonedDateTime.parse(timeEl.attr("datetime"), DateTimeFormatter.ISO_OFFSET_DATE_TIME);
                        } catch (Exception ignored) {}
                    }

                    Article article = new Article();
                    article.setTitle(title);
                    article.setUrl(link);
                    article.setSource(source);
                    article.setPublishedAt(publishedAt);
                    article.setBreaking(isBreaking(title));
                    article.setSlug(slugService.generateSlug(title, articleRepository));

                    articleRepository.save(article);
                    clusteringService.clusterArticle(article);
                    savedCount++;

                } catch (Exception innerEx) {
                    System.err.println("⚠️ خطا در ذخیره یک پست تلگرام: " + innerEx.getMessage());
                }
            }

            source.setLastFetchedAt(ZonedDateTime.now());
            sourceRepository.save(source);
            System.out.println("✅ کانال تلگرام " + source.getName() + ": " + savedCount + " خبر جدید ذخیره شد.");

        } catch (Exception e) {
            System.err.println("❌ خطا در کراول کانال تلگرام " + source.getTelegramUsername() + ": " + e.getMessage());
        }
    }

    private String extractTitle(String text) {
        String cleanText = text.replaceAll("https?://\\S+", "").replaceAll("#\\S+", "").trim();
        String firstLine = cleanText.split("\r?\n")[0].trim();
        firstLine = firstLine.replaceAll("^[📌🔴⚪️⚡️🔻🔥▪️▫️🔹🔸◀️▶️\\s]+", "").trim();

        if (firstLine.length() > 90) {
            int lastSpace = firstLine.substring(0, 90).lastIndexOf(' ');
            return (lastSpace > 20) ? firstLine.substring(0, lastSpace) + "..." : firstLine.substring(0, 87) + "...";
        }
        return firstLine.isBlank() ? "پست تلگرام" : firstLine;
    }

    private boolean isBreaking(String title) {
        if (title == null) return false;
        String lower = title.toLowerCase();
        return BREAKING_KEYWORDS.stream().anyMatch(lower::contains);
    }
}