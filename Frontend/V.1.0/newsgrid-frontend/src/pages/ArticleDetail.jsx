import { useState, useEffect } from 'react';
import strings from '../strings/strings';
import api from '../api/axiosConfig';

function ArticleDetail({ article }) {
    const t = strings.fa;
    const [clusterArticles, setClusterArticles] = useState([]);
    const [copied, setCopied] = useState(false);

    const shareUrl = `https://news-grid-pi.vercel.app/article/${article.slug || article.id}`;

    useEffect(() => {
        if (article.cluster?.id) {
            api.get(`/clusters/${article.cluster.id}/articles`)
                .then(res => setClusterArticles(res.data.filter(a => a.id !== article.id)))
                .catch(() => {});
        }
    }, [article.id, article.cluster?.id]);

    const getBadgeClass = (score) => {
        if (score >= 80) return 'green';
        if (score >= 50) return 'yellow';
        return 'red';
    };

    const getScoreLabel = (score) => {
        if (score >= 80) return 'تأیید شده';
        if (score >= 50) return 'در حال بررسی';
        return 'نامعتبر';
    };

    const getScoreDesc = (score) => {
        const count = article.cluster?.sourceCount ?? 1;
        if (score >= 80) return `این خبر توسط ${count} منبع معتبر پوشش داده شده است.`;
        if (score >= 50) return 'این خبر هنوز توسط منابع بیشتری تأیید نشده است.';
        return 'هیچ منبع معتبری این خبر را تأیید نکرده است.';
    };

    const getScoreColor = (score) => {
        if (score >= 80) return '#34C759';
        if (score >= 50) return '#FF9500';
        return '#FF3B30';
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

    const buildRing = (score, color) => {
        const r = 21, cx = 27, cy = 27;
        const circ = 2 * Math.PI * r;
        const fill = (score / 100) * circ;
        return (
            <svg width="54" height="54" viewBox="0 0 54 54" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(130,130,140,0.18)" strokeWidth="4" />
                <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="4"
                        strokeDasharray={`${fill} ${circ}`} strokeLinecap="round" />
            </svg>
        );
    };

    const copyLink = async () => {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const shareNative = async () => {
        if (navigator.share) {
            try {
                await navigator.share({ title: article.title, url: shareUrl });
            } catch (ignored) {}
        } else {
            await copyLink();
        }
    };

    const shareToTelegram = () =>
        window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(article.title)}`, '_blank');

    const shareToWhatsApp = () =>
        window.open(`https://wa.me/?text=${encodeURIComponent(article.title + '\n' + shareUrl)}`, '_blank');

    const shareToTwitter = () =>
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(article.title)}&url=${encodeURIComponent(shareUrl)}`, '_blank');

    const score = article.cluster?.credibilityScore ?? article.source?.credibility ?? 0;
    const sourceCount = article.cluster?.sourceCount ?? 1;
    const scoreColor = getScoreColor(score);
    const categoryName = article.source?.category?.nameFa || article.category;
    const allSources = [article, ...clusterArticles];

    // Structured JSON-LD Schema for Google News
    const newsSchema = {
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        "headline": article.title,
        "datePublished": article.publishedAt,
        "author": {
            "@type": "Organization",
            "name": article.source?.name || "Nitt"
        },
        "publisher": {
            "@type": "Organization",
            "name": "Nitt",
            "url": "https://news-grid-pi.vercel.app"
        }
    };

    return (
        <div className="detail-content">
            <script type="application/ld+json">
                {JSON.stringify(newsSchema)}
            </script>

            {article.breaking && (
                <div className="detail-breaking">
                    <span className="pulse-dot" />
                    خبر فوری
                </div>
            )}

            <div className="detail-meta">
                {categoryName && (
                    <span className="detail-category">{categoryName}</span>
                )}
                <span className="detail-time">{formatTime(article.publishedAt)}</span>
            </div>

            <div className="detail-title">{article.title}</div>

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
                        <div className="cred-desc">{getScoreDesc(score)}</div>
                    </div>
                </div>
            </div>

            <div className="sources-title">{t.sourcesCoveredBy(sourceCount)}</div>

            <div className="source-list">
                {allSources.map((src, i) => {
                    const srcBadgeClass = getBadgeClass(src.source?.credibility ?? 0);
                    const color = src.source?.color || '#8E8E93';
                    const initials = src.source?.initials || src.source?.name?.substring(0, 2) || '?';
                    return (
                        <div key={src.id ?? i} className="source-item"
                             onClick={() => window.open(src.url, '_blank')}
                             role="button" tabIndex={0}
                             onKeyDown={(e) => e.key === 'Enter' && window.open(src.url, '_blank')}>
                            <div className="source-info">
                                <div className="source-icon" style={{ background: color, color: '#fff' }}>
                                    {initials}
                                </div>
                                <div>
                                    <div className="source-name">{src.source?.name}</div>
                                    <div className="source-time-label">{formatTime(src.publishedAt)}</div>
                                </div>
                            </div>
                            <div className="source-right">
                                <span className={`source-badge ${srcBadgeClass}`}>
                                    {getScoreLabel(src.source?.credibility ?? 0)}
                                </span>
                                <i className="ti ti-chevron-left arrow-icon" />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* نوار اشتراک‌گذاری */}
            <div className="share-inline-bar">
                <span className="share-inline-label">اشتراک‌گذاری</span>
                <div className="share-inline-btns">
                    <button className="share-inline-btn" onClick={shareNative} aria-label="اشتراک‌گذاری همه‌جانبه">
                        <div className="share-inline-icon" style={{ background: '#007AFF' }}>
                            <i className="ti ti-share" />
                        </div>
                    </button>
                    <button className="share-inline-btn" onClick={shareToTwitter} aria-label="اشتراک‌گذاری در توییتر">
                        <div className="share-inline-icon" style={{ background: '#000' }}>
                            <i className="ti ti-brand-x" />
                        </div>
                    </button>
                    <button className="share-inline-btn" onClick={shareToWhatsApp} aria-label="اشتراک‌گذاری در واتساپ">
                        <div className="share-inline-icon" style={{ background: '#25D366' }}>
                            <i className="ti ti-brand-whatsapp" />
                        </div>
                    </button>
                    <button className="share-inline-btn" onClick={shareToTelegram} aria-label="اشتراک‌گذاری در تلگرام">
                        <div className="share-inline-icon" style={{ background: '#2AABEE' }}>
                            <i className="ti ti-brand-telegram" />
                        </div>
                    </button>
                    <button className="share-inline-btn" onClick={copyLink} aria-label="کپی لینک خبر">
                        <div className="share-inline-icon" style={{ background: 'var(--chip-bg)', color: copied ? '#34C759' : 'var(--label)' }}>
                            <i className={`ti ${copied ? 'ti-check' : 'ti-link'}`} />
                        </div>
                    </button>
                </div>
            </div>

            <div className="footer-note">{t.clickToRead}</div>
        </div>
    );
}

export default ArticleDetail;