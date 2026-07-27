import React from 'react';

const TelegramNewsCard = ({ article, lang = 'fa', onOpen }) => {
    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const now = new Date();
        const diffMins = Math.floor((now - date) / 60000);

        if (diffMins < 60) return `${diffMins} دقیقه پیش`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)} ساعت پیش`;
        return date.toLocaleDateString('fa-IR');
    };

    // محاسبه امتیاز اعتبار و تعداد منابع
    const score = article.cluster?.credibilityScore ?? article.source?.credibility ?? 0;
    const sourceCount = article.cluster?.sourceCount ?? 1;
    const badgeClass = score >= 80 ? 'green' : score >= 50 ? 'yellow' : 'red';

    return (
        <article className="card telegram-news-card" onClick={() => onOpen(article)}>
            {/* هدر کارت تلگرامی */}
            <div className="telegram-header">
                <div className="telegram-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                    </svg>
                </div>

                <div className="telegram-source">
                    <span className="source-name">{article.source?.name}</span>
                    <span className="telegram-badge">تلگرام</span>
                </div>

                {/* بخش سمت راست هدر: چند منبع + درصد اعتبار */}
                <div className="telegram-header-right" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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

            {/* تیتر خبر */}
            <div className="telegram-content">
                <p className="telegram-text">{article.title}</p>
            </div>

            {/* فوتر: زمان و لینک مستقیم */}
            <div className="telegram-footer">
                <span className="telegram-time">{formatDate(article.publishedAt)}</span>
                <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="view-in-telegram"
                    onClick={(e) => e.stopPropagation()}
                >
                    مشاهده در تلگرام ↗
                </a>
            </div>
        </article>
    );
};

export default TelegramNewsCard;