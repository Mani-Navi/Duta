function NewsCard({ article, lang, onOpen }) {

    const getBadgeClass = (score) => {
        if (score >= 80) return 'green';
        if (score >= 50) return 'yellow';
        return 'red';
    };

    const formatTime = (dateStr) => {
        if (!dateStr) return '';
        const diff = Math.floor((Date.now() - new Date(dateStr)) / 60000);
        if (diff < 60) return lang === 'fa' ? `${diff} دقیقه پیش` : `${diff} minutes ago`;
        const hours = Math.floor(diff / 60);
        if (hours < 24) return lang === 'fa' ? `${hours} ساعت پیش` : `${hours} hours ago`;
        const days = Math.floor(hours / 24);
        return lang === 'fa' ? `${days} روز پیش` : `${days} days ago`;
    };

    // امتیاز از cluster اگه وجود داشت، وگرنه از منبع
    const score = article.cluster?.credibilityScore ?? article.source?.credibility ?? 0;
    const sourceCount = article.cluster?.sourceCount ?? 1;
    const badgeClass = getBadgeClass(score);
    const isBreaking = article.breaking;
    const srcColor = article.source?.color || '#8E8E93';
    const srcInitials = article.source?.initials || article.source?.name?.substring(0, 2) || '?';

    return (
        <article
            className={`card ${isBreaking ? 'breaking' : ''}`}
            dir={lang === 'fa' ? 'rtl' : 'ltr'}
            onClick={() => onOpen(article)}
            role="button"
            tabIndex={0}
            aria-label={article.title}
            onKeyDown={(e) => e.key === 'Enter' && onOpen(article)}
        >
            {isBreaking && (
                <div className="breaking-strip">
                    <span className="pulse-dot" />
                    خبر فوری
                </div>
            )}

            <div className="card-top">
                <span className="src-group">
                    <span
                        className="src-badge"
                        style={{ background: srcColor }}
                        aria-hidden="true"
                    >
                        {srcInitials}
                    </span>
                    <span className="source-label">
                        {article.source?.name || ''}
                    </span>
                </span>

                <div className="card-top-right">
                    {/* نشان چند منبع */}
                    {sourceCount > 1 && (
                        <span className="multi-source-badge">
                            <i className="ti ti-layers-intersect" aria-hidden="true" />
                            {sourceCount} منبع
                        </span>
                    )}
                    <span className={`badge ${badgeClass}`} aria-label={`امتیاز ${score}`}>
                        {score}%
                    </span>
                </div>
            </div>

            <div className="card-title">{article.title}</div>

            <div className="card-bottom">
                <span className="time">{formatTime(article.publishedAt)}</span>
                <i className="ti ti-external-link ext" aria-hidden="true" />
            </div>
        </article>
    );
}

export default NewsCard;
