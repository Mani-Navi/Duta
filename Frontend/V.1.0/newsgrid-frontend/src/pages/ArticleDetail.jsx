import { useState, useEffect } from 'react';
import strings from '../strings/strings';
import api from '../api/axiosConfig';
import { useUser } from '../context/UserContext';
import {
    getArticleScore,
    getArticleSourceCount,
    getBadgeClass,
    getScoreLabel,
    getScoreColor,
    getScoreDesc,
    formatRelativeTime
} from '../utils/articleHelpers';

function ArticleDetail({ article }) {
    const t = strings.fa;
    const { user, isLoggedIn, openModal, savePreferences, sendFeedback } = useUser();

    const [clusterArticles, setClusterArticles] = useState([]);
    const [copied, setCopied] = useState(false);

    // وضعیت زنده ری‌اکشن‌ها و انیمیشن در صفحه خبر
    const [likeCount, setLikeCount] = useState(article.cluster?.likeCount || 0);
    const [hotCount, setHotCount] = useState(article.cluster?.hotCount || 0);
    const [doubtCount, setDoubtCount] = useState(article.cluster?.doubtCount || 0);
    const [userReaction, setUserReaction] = useState(article.userReaction || null);
    const [animatingType, setAnimatingType] = useState(null);

    const shareUrl = `https://duta.ir/article/${article.slug || article.id}`;
    const categoryName = article.category || article.source?.category?.nameFa;
    const mainSourceName = article.source?.name || 'منبع خبری';
    const mainSourceColor = article.source?.color || '#1D9BF0';
    const mainSourceInitials = article.source?.initials || mainSourceName.substring(0, 2);

    useEffect(() => {
        setLikeCount(article.cluster?.likeCount || 0);
        setHotCount(article.cluster?.hotCount || 0);
        setDoubtCount(article.cluster?.doubtCount || 0);
        setUserReaction(article.userReaction || null);

        if (article.cluster?.id) {
            api.get(`/clusters/${article.cluster.id}/articles`)
                .then(res => setClusterArticles(res.data.filter(a => a.id !== article.id)))
                .catch(() => {});
        }
    }, [article]);

    // فیلتر مکث ۱۲ ثانیه‌ای (Dwell Time) برای ثبت مطالعه واقعی
    useEffect(() => {
        if (!isLoggedIn) return;
        const timer = setTimeout(() => {
            sendFeedback('QUALIFIED_READ', categoryName, mainSourceName, article.cluster?.id);
        }, 12000);
        return () => clearTimeout(timer);
    }, [isLoggedIn, article.id, categoryName, mainSourceName, article.cluster?.id, sendFeedback]);

    const handleReaction = async (type) => {
        if (!isLoggedIn) {
            openModal('auth');
            return;
        }
        const clusterId = article.cluster?.id;
        if (!clusterId) return;

        // اجرای انیمیشن اختصاصی متناسب با نوع ری‌اکشن
        setAnimatingType(type);
        setTimeout(() => setAnimatingType(null), 650);

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

    const handleSourceClick = (srcObj) => {
        if (isLoggedIn) {
            sendFeedback('SOURCE_CLICK', categoryName, srcObj.source?.name || mainSourceName, article.cluster?.id);
        }
    };

    const handleToggleFollowSource = async (srcName) => {
        if (!isLoggedIn) {
            openModal('auth');
            return;
        }
        const current = Array.isArray(user?.followedSources) ? [...user.followedSources] : [];
        const next = current.includes(srcName)
            ? current.filter(s => s !== srcName)
            : [...current, srcName];
        try {
            await savePreferences({ followedSources: next });
        } catch {}
    };

    const buildRing = (score, color) => {
        const r = 23, cx = 29, cy = 29;
        const circ = 2 * Math.PI * r;
        const fill = (score / 100) * circ;
        return (
            <svg width="58" height="58" viewBox="0 0 58 58" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(130,130,140,0.16)" strokeWidth="4.5" />
                <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="4.5" strokeDasharray={`${fill} ${circ}`} strokeLinecap="round" />
            </svg>
        );
    };

    const recordShareSignal = () => {
        if (isLoggedIn) {
            sendFeedback('SHARE', categoryName, mainSourceName, article.cluster?.id);
        }
    };

    const copyLink = async () => {
        recordShareSignal();
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const shareNative = async () => {
        recordShareSignal();
        if (navigator.share) {
            try {
                await navigator.share({ title: article.title, url: shareUrl });
            } catch {}
        } else {
            await copyLink();
        }
    };

    const shareToTelegram = () => {
        recordShareSignal();
        window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(article.title)}`, '_blank');
    };

    const shareToWhatsApp = () => {
        recordShareSignal();
        window.open(`https://wa.me/?text=${encodeURIComponent(article.title + '\n' + shareUrl)}`, '_blank');
    };

    const shareToTwitter = () => {
        recordShareSignal();
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(article.title)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
    };

    const score = getArticleScore(article);
    const sourceCount = getArticleSourceCount(article);
    const scoreColor = getScoreColor(score);
    const allSources = [article, ...clusterArticles];
    const hasDistinctDescription = article.description && article.description.trim() !== article.title?.trim();
    const followedSources = Array.isArray(user?.followedSources) ? user.followedSources : [];
    const isMainFollowed = followedSources.includes(mainSourceName);

    const structuredData = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "NewsArticle",
                "@id": `${shareUrl}#article`,
                "headline": article.title,
                "description": article.description || article.title,
                "datePublished": article.publishedAt,
                "dateModified": article.cluster?.updatedAt || article.publishedAt,
                "articleSection": categoryName || "اخبار",
                "inLanguage": "fa-IR",
                "mainEntityOfPage": shareUrl,
                "author": { "@type": "Organization", "name": mainSourceName },
                "publisher": {
                    "@type": "Organization",
                    "name": "Duta",
                    "url": "https://duta.ir",
                    "logo": { "@type": "ImageObject", "url": "https://duta.ir/duta-logo.svg" }
                }
            },
            {
                "@type": "ClaimReview",
                "@id": `${shareUrl}#claimreview`,
                "url": shareUrl,
                "claimReviewed": article.title,
                "datePublished": article.publishedAt,
                "author": { "@type": "Organization", "name": "Duta", "url": "https://duta.ir" },
                "reviewRating": {
                    "@type": "Rating",
                    "ratingValue": score,
                    "bestRating": 100,
                    "worstRating": 0,
                    "alternateName": getScoreLabel(score)
                }
            }
        ]
    };

    return (
        <div className="detail-content">
            <script type="application/ld+json">
                {JSON.stringify(structuredData)}
            </script>

            <article className="x-detail-article-card">
                {/* ۱. هدر رسانه منتشرکننده + دکمه برجسته دنبال کردن (به سبک X) */}
                <header className="x-publisher-bar">
                    <div className="x-publisher-info">
                        <div className="x-publisher-avatar" style={{ background: mainSourceColor }}>
                            {mainSourceInitials}
                        </div>
                        <div>
                            <div className="x-publisher-name">{mainSourceName}</div>
                            <div className="x-publisher-meta">
                                <span>{formatRelativeTime(article.publishedAt)}</span>
                                {categoryName && (
                                    <>
                                        <span>·</span>
                                        <span className="x-meta-tag">{categoryName}</span>
                                    </>
                                )}
                                {article.location && (
                                    <>
                                        <span>·</span>
                                        <span className="x-meta-tag local">{article.location}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <button
                        type="button"
                        className={`x-follow-btn ${isMainFollowed ? 'following' : ''}`}
                        onClick={() => handleToggleFollowSource(mainSourceName)}
                    >
                        {isMainFollowed ? (
                            <>
                                <svg className="x-svg-sm" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                                <span>دنبال‌شده</span>
                            </>
                        ) : (
                            <>
                                <svg className="x-svg-sm" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                <span>دنبال کردن</span>
                            </>
                        )}
                    </button>
                </header>

                {/* ۲. نشان خبر فوری، تیتر اصلی و باکس خلاصه خبر */}
                {article.breaking && (
                    <div className="detail-breaking">
                        <span className="pulse-dot" aria-hidden="true" />
                        خبر فوری
                    </div>
                )}

                <h1 className="detail-title">{article.title}</h1>

                {hasDistinctDescription && (
                    <p className="detail-description">{article.description}</p>
                )}

                {/* ۳. داک ری‌اکشن‌های تعاملی با انیمیشن اختصاصی برای هر واکنش */}
                <div className="x-detail-reactions-dock" role="group" aria-label="ثبت واکنش به خبر">
                    <button
                        type="button"
                        className={`x-dock-btn like ${userReaction === 'LIKE' ? 'active' : ''} ${animatingType === 'LIKE' ? 'anim-like' : ''}`}
                        onClick={() => handleReaction('LIKE')}
                    >
                        <span className="x-dock-icon">
                            <svg className="x-svg" viewBox="0 0 24 24">
                                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                            </svg>
                        </span>
                        <span className="x-dock-label">مفید</span>
                        <span className="x-dock-count">{likeCount}</span>
                    </button>

                    <button
                        type="button"
                        className={`x-dock-btn hot ${userReaction === 'HOT' ? 'active' : ''} ${animatingType === 'HOT' ? 'anim-hot' : ''}`}
                        onClick={() => handleReaction('HOT')}
                    >
                        <span className="x-dock-icon">
                            <svg className="x-svg" viewBox="0 0 24 24">
                                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                                <polyline points="17 6 23 6 23 12"/>
                            </svg>
                        </span>
                        <span className="x-dock-label">مهم</span>
                        <span className="x-dock-count">{hotCount}</span>
                    </button>

                    <button
                        type="button"
                        className={`x-dock-btn doubt ${userReaction === 'DOUBT' ? 'active' : ''} ${animatingType === 'DOUBT' ? 'anim-doubt' : ''}`}
                        onClick={() => handleReaction('DOUBT')}
                    >
                        <span className="x-dock-icon">
                            <svg className="x-svg" viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="10"/>
                                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                                <line x1="12" y1="17" x2="12.01" y2="17"/>
                            </svg>
                        </span>
                        <span className="x-dock-label">تردید</span>
                        <span className="x-dock-count">{doubtCount}</span>
                    </button>
                </div>
            </article>

            {/* ۴. کارت سنجش اعتبار کلستر */}
            <div className="group-card">
                <div className="cred-row">
                    <div className="cred-ring-wrap" style={{ width: '58px', height: '58px' }}>
                        {buildRing(score, scoreColor)}
                        <div className="cred-num" style={{ color: scoreColor, fontSize: '14px' }}>{score}%</div>
                    </div>
                    <div>
                        <span className="cred-status" style={{ color: scoreColor }}>
                            وضعیت اعتبار: {getScoreLabel(score)}
                        </span>
                        <div className="cred-desc">{getScoreDesc(score, sourceCount)}</div>
                    </div>
                </div>
            </div>

            {/* ۵. لیست منابع مستقل پوشش‌دهنده این خبر */}
            <div className="sources-title">{t.sourcesCoveredBy(sourceCount)}</div>

            <div className="source-list">
                {allSources.map((src, i) => {
                    const srcScore = src.source?.credibility ?? 0;
                    const srcBadgeClass = getBadgeClass(srcScore);
                    const color = src.source?.color || '#536471';
                    const initials = src.source?.initials || src.source?.name?.substring(0, 2) || '?';
                    return (
                        <a
                            key={src.id ?? i}
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="source-item"
                            onClick={() => handleSourceClick(src)}
                        >
                            <div className="source-info">
                                <div className="source-icon" style={{ background: color, color: '#fff' }}>
                                    {initials}
                                </div>
                                <div>
                                    <div className="source-name">{src.source?.name}</div>
                                    <div className="source-time-label">{formatRelativeTime(src.publishedAt)} · مطالعه در سایت منبع</div>
                                </div>
                            </div>
                            <div className="source-right">
                                <span className={`source-badge ${srcBadgeClass}`}>
                                    {srcScore}% · {getScoreLabel(srcScore)}
                                </span>
                                <i className="ti ti-external-link arrow-icon" aria-hidden="true" />
                            </div>
                        </a>
                    );
                })}
            </div>

            {/* ۶. نوار اشتراک‌گذاری */}
            <div className="share-inline-bar">
                <span className="share-inline-label">اشتراک‌گذاری خبر</span>
                <div className="share-inline-btns">
                    <button className="share-inline-btn" onClick={shareNative} aria-label="اشتراک‌گذاری بیشتر">
                        <div className="share-inline-icon" style={{ background: '#007AFF' }}>
                            <i className="ti ti-share" aria-hidden="true" />
                        </div>
                    </button>
                    <button className="share-inline-btn" onClick={shareToTwitter} aria-label="اشتراک‌گذاری در ایکس">
                        <div className="share-inline-icon" style={{ background: '#16181C', border: '1px solid var(--separator)' }}>
                            <i className="ti ti-brand-x" aria-hidden="true" />
                        </div>
                    </button>
                    <button className="share-inline-btn" onClick={shareToWhatsApp} aria-label="اشتراک‌گذاری در واتساپ">
                        <div className="share-inline-icon" style={{ background: '#25D366' }}>
                            <i className="ti ti-brand-whatsapp" aria-hidden="true" />
                        </div>
                    </button>
                    <button className="share-inline-btn" onClick={shareToTelegram} aria-label="اشتراک‌گذاری در تلگرام">
                        <div className="share-inline-icon" style={{ background: '#2AABEE' }}>
                            <i className="ti ti-brand-telegram" aria-hidden="true" />
                        </div>
                    </button>
                    <button className="share-inline-btn" onClick={copyLink} aria-label="کپی لینک خبر">
                        <div className="share-inline-icon" style={{ background: 'var(--chip-bg)', color: copied ? '#00BA7C' : 'var(--label)' }}>
                            <i className={`ti ${copied ? 'ti-check' : 'ti-link'}`} aria-hidden="true" />
                        </div>
                    </button>
                </div>
            </div>

            <div className="footer-note">{t.clickToRead}</div>
        </div>
    );
}

export default ArticleDetail;