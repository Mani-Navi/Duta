function NewsCard({ article, lang, onOpen }) {

    const getBadgeClass = (credibility) => {
        if (credibility >= 80) return 'green';
        if (credibility >= 50) return 'yellow';
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

    const credibility = article.source?.credibility || 0;
    const badgeClass = getBadgeClass(credibility);
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
            {/* نوار خبر فوری */}
            {isBreaking && (
                <div className="breaking-strip">
                    <span className="pulse-dot" />
                    خبر فوری
                </div>
            )}

            <div className="card-top">
                {/* badge رنگی منبع + نام */}
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

                <span
                    className={`badge ${badgeClass}`}
                    aria-label={`امتیاز اعتبار ${credibility}`}
                >
                    {credibility}%
                </span>
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
