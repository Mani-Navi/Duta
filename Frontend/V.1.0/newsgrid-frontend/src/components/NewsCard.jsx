import { memo } from 'react';
import {
    getArticleScore,
    getArticleSourceCount,
    getBadgeClass,
    formatRelativeTime
} from '../utils/articleHelpers';

function NewsCard({ article, onOpen }) {
    const score = getArticleScore(article);
    const sourceCount = getArticleSourceCount(article);
    const badgeClass = getBadgeClass(score);
    const isBreaking = article.breaking;
    const srcColor = article.source?.color || '#8E8E93';
    const srcInitials = article.source?.initials || article.source?.name?.substring(0, 2) || '?';
    const articleHref = `/article/${encodeURIComponent(article.slug || article.id)}`;

    return (
        <article
            className={`card ${isBreaking ? 'breaking' : ''}`}
            onClick={() => onOpen(article)}
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
                    <span className={`badge ${badgeClass}`} aria-label={`امتیاز اعتبار ${score} درصد`}>
                        {score}%
                    </span>
                </div>
            </div>

            <h2 className="card-title">
                <a
                    href={articleHref}
                    onClick={(e) => e.preventDefault()}
                    style={{ color: 'inherit', textDecoration: 'none' }}
                >
                    {article.title}
                </a>
            </h2>

            <div className="card-bottom">
                <span className="time">{formatRelativeTime(article.publishedAt)}</span>
                <i className="ti ti-external-link ext" aria-hidden="true" />
            </div>
        </article>
    );
}

export default memo(NewsCard);