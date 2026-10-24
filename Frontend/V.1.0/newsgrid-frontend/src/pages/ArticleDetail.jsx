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

    const shareUrl = `https://duta.ir/article/${article.slug || article.id}`;
    const categoryName = article.category || article.source?.category?.nameFa;
    const mainSourceName = article.source?.name;

    useEffect(() => {
        if (article.cluster?.id) {
            api.get(`/clusters/${article.cluster.id}/articles`)
                .then(res => setClusterArticles(res.data.filter(a => a.id !== article.id)))
                .catch(() => {});
        }
    }, [article.id, article.cluster?.id]);

    // UCS-009: Dwell Time Filter — Only count as a qualified read (+1) if user stays >= 12 seconds
    useEffect(() => {
        if (!isLoggedIn) return;
        const timer = setTimeout(() => {
            sendFeedback('QUALIFIED_READ', categoryName, mainSourceName, article.cluster?.id);
        }, 12000);
        return () => clearTimeout(timer);
    }, [isLoggedIn, article.id, categoryName, mainSourceName, article.cluster?.id, sendFeedback]);

    const handleSourceClick = (srcObj) => {
        if (isLoggedIn) {
            sendFeedback('SOURCE_CLICK', categoryName, srcObj.source?.name || mainSourceName, article.cluster?.id);
        }
    };

    const handleToggleFollowSource = async (srcName) => {
        if (!isLoggedIn) {
            openModal('auth', `ورود برای دنبال کردن «${srcName}»`);
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
        const r = 21, cx = 27, cy = 27;
        const circ = 2 * Math.PI * r;
        const fill = (score / 100) * circ;
        return (
            <svg width="54" height="54" viewBox="0 0 54 54"
                 style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={cx} cy={cy} r={r} fill="none"
                        stroke="rgba(130,130,140,0.18)" strokeWidth="4" />
                <circle cx={cx} cy={cy} r={r} fill="none"
                        stroke={color} strokeWidth="4"
                        strokeDasharray={`${fill} ${circ}`}
                        strokeLinecap="round" />
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
                "author": {
                    "@type": "Organization",
                    "name": article.source?.name || "Duta"
                },
                "publisher": {
                    "@type": "Organization",
                    "name": "Duta",
                    "url": "https://duta.ir",
                    "logo": {
                        "@type": "ImageObject",
                        "url": "https://duta.ir/duta-logo.svg"
                    }
                },
                "isBasedOn": allSources.map(s => ({
                    "@type": "NewsArticle",
                    "headline": s.title,
                    "url": s.url,
                    "publisher": {
                        "@type": "Organization",
                        "name": s.source?.name || "منبع خبری"
                    }
                }))
            },
            {
                "@type": "ClaimReview",
                "@id": `${shareUrl}#claimreview`,
                "url": shareUrl,
                "claimReviewed": article.title,
                "datePublished": article.publishedAt,
                "author": {
                    "@type": "Organization",
                    "name": "Duta",
                    "url": "https://duta.ir"
                },
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

            {article.breaking && (
                <div className="detail-breaking">
                    <span className="pulse-dot" aria-hidden="true" />
                    خبر فوری
                </div>
            )}

            <div className="detail-meta" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {categoryName && (
                        <span className="detail-category">
                            {categoryName}
                        </span>
                    )}
                    {article.location && (
                        <span className="detail-category" style={{ background: 'rgba(21,128,61,0.12)', color: 'var(--green)' }}>
                            {article.location}
                        </span>
                    )}
                    <span className="detail-time">{formatRelativeTime(article.publishedAt)}</span>
                </div>

                {mainSourceName && (
                    <button
                        type="button"
                        className={`tablo-pin-btn ${followedSources.includes(mainSourceName) ? 'active' : ''}`}
                        onClick={() => handleToggleFollowSource(mainSourceName)}
                    >
                        {followedSources.includes(mainSourceName) ? `✓ دنبال‌شده: ${mainSourceName}` : `+ دنبال کردن ${mainSourceName}`}
                    </button>
                )}
            </div>

            <h1 className="detail-title">{article.title}</h1>

            {hasDistinctDescription && (
                <p className="detail-description">{article.description}</p>
            )}

            <div className="group-card">
                <div className="cred-row">
                    <div className="cred-ring-wrap">
                        {buildRing(score, scoreColor)}
                        <div className="cred-num" style={{ color: scoreColor }}>{score}</div>
                    </div>
                    <div>
                        <span className="cred-status" style={{ color: scoreColor }}>
                            {getScoreLabel(score)}
                        </span>
                        <div className="cred-desc">{getScoreDesc(score, sourceCount)}</div>
                    </div>
                </div>
            </div>

            <div className="sources-title">{t.sourcesCoveredBy(sourceCount)}</div>

            <div className="source-list">
                {allSources.map((src, i) => {
                    const srcScore = src.source?.credibility ?? 0;
                    const srcBadgeClass = getBadgeClass(srcScore);
                    const color = src.source?.color || '#8E8E93';
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
                                    <div className="source-time-label">{formatRelativeTime(src.publishedAt)}</div>
                                </div>
                            </div>
                            <div className="source-right">
                                <span className={`source-badge ${srcBadgeClass}`}>
                                    {getScoreLabel(srcScore)}
                                </span>
                                <i className="ti ti-chevron-left arrow-icon" aria-hidden="true" />
                            </div>
                        </a>
                    );
                })}
            </div>

            <div className="share-inline-bar">
                <span className="share-inline-label">اشتراک‌گذاری</span>
                <div className="share-inline-btns">
                    <button className="share-inline-btn" onClick={shareNative} aria-label="اشتراک‌گذاری بیشتر">
                        <div className="share-inline-icon" style={{ background: '#007AFF' }}>
                            <i className="ti ti-share" aria-hidden="true" />
                        </div>
                    </button>
                    <button className="share-inline-btn" onClick={shareToTwitter} aria-label="اشتراک‌گذاری در توییتر">
                        <div className="share-inline-icon" style={{ background: '#000' }}>
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
                        <div className="share-inline-icon" style={{ background: 'var(--chip-bg)', color: copied ? '#34C759' : 'var(--label)' }}>
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