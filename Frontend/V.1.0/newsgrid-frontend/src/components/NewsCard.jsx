import { memo, useState } from 'react';
import api from '../api/axiosConfig';
import { useUser } from '../context/UserContext';
import {
    getArticleScore,
    getArticleSourceCount,
    getBadgeClass,
    formatRelativeTime
} from '../utils/articleHelpers';

function NewsCard({ article, onOpen, onHideCard }) {
    const { isLoggedIn, openModal, sendFeedback } = useUser();

    const [menuOpen, setMenuOpen] = useState(false);
    const [likeCount, setLikeCount] = useState(article.cluster?.likeCount || 0);
    const [hotCount, setHotCount] = useState(article.cluster?.hotCount || 0);
    const [doubtCount, setDoubtCount] = useState(article.cluster?.doubtCount || 0);
    const [userReaction, setUserReaction] = useState(article.userReaction || null);

    const score = getArticleScore(article);
    const sourceCount = getArticleSourceCount(article);
    const badgeClass = getBadgeClass(score);
    const isBreaking = article.breaking;
    const srcColor = article.source?.color || '#536471';
    const srcInitials = article.source?.initials || article.source?.name?.substring(0, 2) || '?';
    const articleHref = `/article/${encodeURIComponent(article.slug || article.id)}`;

    const handleReactionClick = async (e, type) => {
        e.stopPropagation();
        if (!isLoggedIn) {
            openModal('auth', 'ورود به حساب برای ثبت بازخورد');
            return;
        }
        const clusterId = article.cluster?.id;
        if (!clusterId) return;

        try {
            const res = await api.post(`/clusters/${clusterId}/reactions`, { type });
            if (res.data) {
                setLikeCount(res.data.likeCount ?? 0);
                setHotCount(res.data.hotCount ?? 0);
                setDoubtCount(res.data.doubtCount ?? 0);
                setUserReaction(res.data.userReaction ?? null);
            }
        } catch {}
    };

    const handleNegativeAction = async (e, actionType) => {
        e.stopPropagation();
        setMenuOpen(false);
        if (!isLoggedIn) {
            openModal('auth', 'ورود به حساب برای شخصی‌سازی فید');
            return;
        }
        if (onHideCard) {
            onHideCard(article, actionType);
        }
        await sendFeedback(actionType, article.category, article.source?.name, article.cluster?.id);
    };

    return (
        <article
            className={`card ${isBreaking ? 'breaking' : ''}`}
            onClick={() => {
                if (menuOpen) setMenuOpen(false);
                else onOpen(article);
            }}
        >
            {isBreaking && (
                <div className="breaking-strip">
                    <span className="pulse-dot" aria-hidden="true" />
                    خبر فوری
                </div>
            )}

            {/* تگ ظریف دلیل پیشنهاد (فقط در فید شخصی) */}
            {article.reasonLabel && (
                <div className={`x-card-signal ${article.reasonType === 'local' ? 'local' : article.reasonType === 'source' ? 'accent' : ''}`}>
                    <span>{article.reasonLabel}</span>
                </div>
            )}

            {/* هدر خلوت کارت: نام کامل منبع در راست | اعتبار و منو در چپ */}
            <div className="card-top">
                <div className="src-group">
                    <span className="src-badge" style={{ background: srcColor }} aria-hidden="true">
                        {srcInitials}
                    </span>
                    <span className="source-label">
                        {article.source?.name || ''}
                    </span>
                </div>

                <div className="card-top-right">
                    {sourceCount > 1 && (
                        <span className="multi-source-badge">
                            {sourceCount} منبع
                        </span>
                    )}
                    <span className={`badge ${badgeClass}`} aria-label={`امتیاز اعتبار ${score} درصد`}>
                        {score}%
                    </span>
                    <button
                        type="button"
                        className="x-dots-btn"
                        aria-label="گزینه‌ها"
                        onClick={(e) => { e.stopPropagation(); setMenuOpen(prev => !prev); }}
                    >
                        <svg className="x-svg" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="1.4" />
                            <circle cx="19" cy="12" r="1.4" />
                            <circle cx="5" cy="12" r="1.4" />
                        </svg>
                    </button>
                </div>
            </div>

            {menuOpen && (
                <div className="x-dropdown-menu" onClick={(e) => e.stopPropagation()}>
                    {article.category && (
                        <button type="button" className="x-dropdown-item danger" onClick={(e) => handleNegativeAction(e, 'DISLIKE_TOPIC')}>
                            <svg className="x-svg-sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                            <span>عدم علاقه به «{article.category}»</span>
                        </button>
                    )}
                    {article.source?.name && (
                        <button type="button" className="x-dropdown-item danger" onClick={(e) => handleNegativeAction(e, 'MUTE_SOURCE')}>
                            <svg className="x-svg-sm" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                            <span>عدم نمایش از «{article.source.name}»</span>
                        </button>
                    )}
                    <button type="button" className="x-dropdown-item" onClick={(e) => handleNegativeAction(e, 'HIDE_CLUSTER')}>
                        <svg className="x-svg-sm" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        <span>پنهان کردن این خبر</span>
                    </button>
                </div>
            )}

            <h2 className="card-title">
                <a
                    href={articleHref}
                    onClick={(e) => e.preventDefault()}
                    style={{ color: 'inherit', textDecoration: 'none' }}
                >
                    {article.title}
                </a>
            </h2>

            {/* فوتر مینیمال به سبک X: زمان انتشار در راست | آیکون‌های خطی بازخورد در چپ */}
            <div className="x-card-actions">
                <span className="time">{formatRelativeTime(article.publishedAt)}</span>

                <div className="x-reaction-bar">
                    <button
                        type="button"
                        className={`x-react-btn ${userReaction === 'LIKE' ? 'active-like' : ''}`}
                        onClick={(e) => handleReactionClick(e, 'LIKE')}
                        title="مفید"
                        aria-label="مفید"
                    >
                        <svg className="x-svg-sm" viewBox="0 0 24 24">
                            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                        </svg>
                        {likeCount > 0 && <span>{likeCount}</span>}
                    </button>

                    <button
                        type="button"
                        className={`x-react-btn ${userReaction === 'HOT' ? 'active-hot' : ''}`}
                        onClick={(e) => handleReactionClick(e, 'HOT')}
                        title="مهم"
                        aria-label="مهم"
                    >
                        <svg className="x-svg-sm" viewBox="0 0 24 24">
                            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                            <polyline points="17 6 23 6 23 12"/>
                        </svg>
                        {hotCount > 0 && <span>{hotCount}</span>}
                    </button>

                    <button
                        type="button"
                        className={`x-react-btn ${userReaction === 'DOUBT' ? 'active-doubt' : ''}`}
                        onClick={(e) => handleReactionClick(e, 'DOUBT')}
                        title="تردید در اعتبار"
                        aria-label="تردید"
                    >
                        <svg className="x-svg-sm" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                            <line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                        {doubtCount > 0 && <span>{doubtCount}</span>}
                    </button>
                </div>
            </div>
        </article>
    );
}

export default memo(NewsCard);