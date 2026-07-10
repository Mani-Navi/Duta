function NewsCard({ article, lang, onOpen }) {

    const getBadgeClass = (credibility) => {
        if (credibility >= 80) return 'green';
        if (credibility >= 50) return 'yellow';
        return 'red';
    };

    const getBadgeLabel = (credibility, lang) => {
        if (credibility >= 80) return lang === 'fa' ? 'تأیید شده' : 'Verified';
        if (credibility >= 50) return lang === 'fa' ? 'در حال بررسی' : 'Developing';
        return lang === 'fa' ? 'نامعتبر' : 'Unverified';
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
    const badgeLabel = getBadgeLabel(credibility, lang);

    return (
        <div
            className="card"
            dir={lang === 'fa' ? 'rtl' : 'ltr'}
            onClick={() => onOpen(article)}
        >
            <div className="card-top">
        <span className="source-label">
          {article.source?.name || ''}
        </span>
                <span className={`badge ${badgeClass}`}>
          {credibility}%
        </span>
            </div>

            <div className="card-title">{article.title}</div>

            <div className="card-bottom">
                <span className="time">{formatTime(article.publishedAt)}</span>
                <i className="ti ti-external-link ext" aria-hidden="true" />
            </div>
        </div>
    );
}

export default NewsCard;