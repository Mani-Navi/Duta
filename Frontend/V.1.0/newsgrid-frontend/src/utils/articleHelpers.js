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