import { memo } from 'react';
import api from '../api/axiosConfig';

function NewsCard({ article, onOpen }) {

    const handlePrefetch = () => {
        const slug = article.slug || article.id;
        if (slug) {
            api.get(`/articles/slug/${slug}`).catch(() => {});
        }
    };

    const getBadgeClass = (score) => {
        if (score >= 80) return 'green';
        if (score >= 50) return 'yellow';
        return 'red';
    };

    const formatTime = (dateStr) => {
        if (!dateStr) return '';
        const diff = Math.floor((Date.now() - new Date(dateStr)) / 60000);

        if (diff < 1) return 'همین الان';
        if (diff < 60) return `${diff} دقیقه پیش`;
        const hours = Math.floor(diff / 60);
        if (hours < 24) return `${hours} ساعت پیش`;
        const days = Math.floor(hours / 24);
        return `${days} روز پیش`;
    };

    const score = article.cluster?.credibilityScore ?? article.source?.credibility ?? 0;
    const sourceCount = article.cluster?.sourceCount ?? 1;
    const badgeClass = getBadgeClass(score);
    const isBreaking = article.breaking;
    const srcColor = article.source?.color || '#8E8E93';
    const srcInitials = article.source?.initials || article.source?.name?.substring(0, 2) || '?';

    return (
        <article
            className={`card ${isBreaking ? 'breaking' : ''}`}
            onClick={() => onOpen(article)}
            onMouseEnter={handlePrefetch}
            onTouchStart={handlePrefetch}
            role="button"
            tabIndex={0}
            aria-label={article.title}
            onKeyDown={(e) => e.key === 'Enter' && onOpen(article)}
        >
            {isBreaking && (
                <div className="breaking-strip">
                    <span className="pulse-dot" aria-hidden="true" />
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

            <h2 className="card-title">{article.title}</h2>

            <div className="card-bottom">
                <span className="time">{formatTime(article.publishedAt)}</span>
                <i className="ti ti-external-link ext" aria-hidden="true" />
            </div>
        </article>
    );
}

export default memo(NewsCard);