// ─── سوئیچ ری‌اکشن‌های نمایشی اولیه سایت (برای حذف کامل در آینده، این مقدار را false کنید) ───
export const ENABLE_SEED_REACTIONS = true;

export function getSeededReactionBoost(article) {
    if (!ENABLE_SEED_REACTIONS || !article) {
        return { like: 0, hot: 0, doubt: 0 };
    }

    const seedId = Number(article?.cluster?.id || article?.id || 0);
    if (!seedId) {
        return { like: 0, hot: 0, doubt: 0 };
    }

    // هش قطعی (Deterministic Hash) بر اساس شناسه خبر تا اعداد در کارت و داخل خبر همیشه یکسان باشند
    let h = Math.imul(seedId ^ 0x9E3779B9, 0x85EBCA6B) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 0xC2B2AE35) >>> 0;
    h = (h ^ (h >>> 16)) >>> 0;

    const score = getArticleScore(article);
    const sourceCount = getArticleSourceCount(article);

    let like = 68 + (h % 175);                  // پایه بین ۶۸ تا ۲۴۲
    let hot = 34 + ((h >>> 5) % 115);           // پایه بین ۳۴ تا ۱۴۸
    let doubt = score >= 80
        ? (4 + ((h >>> 10) % 19))               // برای اخبار معتبر: ۴ تا ۲۲ تردید
        : (26 + ((h >>> 10) % 64));             // برای اخبار کم‌اعتبارتر: ۲۶ تا ۸۹ تردید

    // جهش ویژه برای اخبار فوری
    if (article.breaking) {
        like += 115 + (h % 85);
        hot += 95 + ((h >>> 7) % 75);
    }

    // افزایش متناسب با تعداد منابع پوشش‌دهنده کلستر
    if (sourceCount > 1) {
        like += Math.min(280, (sourceCount - 1) * 46);
        hot += Math.min(210, (sourceCount - 1) * 34);
    }

    // رشد سریع در ۳۰ دقیقه اول انتشار (شروع از ۴۰٪ ظرفیت در دقیقه اول)
    if (article.publishedAt) {
        const ageMins = Math.max(1, (Date.now() - new Date(article.publishedAt).getTime()) / 60000);
        if (ageMins < 30) {
            const ramp = 0.40 + (ageMins / 30) * 0.60;
            like = Math.max(18, Math.round(like * ramp));
            hot = Math.max(9, Math.round(hot * ramp));
            doubt = Math.max(2, Math.round(doubt * ramp));
        }
    }

    return { like, hot, doubt };
}

export function getArticleScore(article) {
    return article?.cluster?.credibilityScore ?? article?.source?.credibility ?? 0;
}

export function getArticleSourceCount(article) {
    return article?.cluster?.sourceCount ?? 1;
}

export function getBadgeClass(score) {
    if (score >= 80) return 'green';
    if (score >= 50) return 'yellow';
    return 'red';
}

export function getScoreLabel(score) {
    if (score >= 80) return 'تأیید شده';
    if (score >= 50) return 'در حال بررسی';
    return 'نامعتبر';
}

export function getScoreColor(score) {
    if (score >= 80) return '#34C759';
    if (score >= 50) return '#FF9500';
    return '#FF3B30';
}

export function getScoreDesc(score, sourceCount = 1) {
    if (score >= 80) return `این خبر توسط ${sourceCount} منبع معتبر پوشش داده شده است.`;
    if (score >= 50) return 'این خبر هنوز توسط منابع بیشتری تأیید نشده است.';
    return 'هیچ منبع معتبری این خبر را تأیید نکرده است.';
}

export function formatRelativeTime(dateStr) {
    if (!dateStr) return '';
    const diffMins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);

    if (diffMins < 1) return 'همین الان';
    if (diffMins < 60) return `${diffMins} دقیقه پیش`;
    const hours = Math.floor(diffMins / 60);
    if (hours < 24) return `${hours} ساعت پیش`;
    const days = Math.floor(hours / 24);
    return `${days} روز پیش`;
}