import { useState, useEffect } from 'react';
import strings from '../strings/strings';
import api from '../api/axiosConfig';

function ArticleDetail({ lang, article }) {
    const t = strings[lang];
    const [clusterArticles, setClusterArticles] = useState([]);
    const [copied, setCopied] = useState(false);

    const shareUrl = `https://news-grid-pi.vercel.app/article/${article.slug || article.id}`;

    useEffect(() => {
        if (article.cluster?.id) {
            api.get(`/clusters/${article.cluster.id}/articles`)
                .then(res => setClusterArticles(res.data.filter(a => a.id !== article.id)))
                .catch(() => {});
        }
    }, [article.id]);

    const getBadgeClass = (score) => {
        if (score >= 80) return 'green';
        if (score >= 50) return 'yellow';
        return 'red';
    };

    const getScoreLabel = (score) => {
        if (score >= 80) return lang === 'fa' ? 'تأیید شده' : 'Verified';
        if (score >= 50) return lang === 'fa' ? 'در حال بررسی' : 'Developing';
        return lang === 'fa' ? 'نامعتبر' : 'Unverified';
    };

    const getScoreDesc = (score) => {
        const count = article.cluster?.sourceCount ?? 1;
        if (score >= 80) return lang === 'fa'
            ? `این خبر توسط ${count} منبع معتبر پوشش داده شده است.`
            : `This story has been covered by ${count} credible sources.`;
        if (score >= 50) return lang === 'fa'
            ? 'این خبر هنوز توسط منابع بیشتری تأیید نشده است.'
            : 'This story has not yet been confirmed by more sources.';
        return lang === 'fa'
            ? 'هیچ منبع معتبری این خبر را تأیید نکرده است.'
            : 'No credible source has confirmed this story.';
    };

    const getScoreColor = (score) => {
        if (score >= 80) return '#34C759';
        if (score >= 50) return '#FF9500';
        return '#FF3B30';
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

    const copyLink = async () => {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const shareNative = async () => {
        if (navigator.share) {
            await navigator.share({ title: article.title, url: shareUrl });
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
    const category = article.source?.category;
    const allSources = [article, ...clusterArticles];

    return (
        <div className="detail-content">

            {article.breaking && (
                <div className="detail-breaking">
                    <span className="pulse-dot" />
                    خبر فوری
                </div>
            )}

            <div className="detail-meta">
                {category && (
                    <span className="detail-category">
                        {lang === 'fa' ? category.nameFa : category.nameEn}
                    </span>
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

            {/* نوار share */}
            <div className="share-inline-bar">
                <span className="share-inline-label">اشتراک‌گذاری</span>
                <div className="share-inline-btns">
                    <button className="share-inline-btn" onClick={shareNative} aria-label="بیشتر">
                        <div className="share-inline-icon" style={{ background: '#007AFF' }}>
                            <i className="ti ti-share" />
                        </div>
                    </button>
                    <button className="share-inline-btn" onClick={shareToTwitter} aria-label="توییتر">
                        <div className="share-inline-icon" style={{ background: '#000' }}>
                            <i className="ti ti-brand-x" />
                        </div>
                    </button>
                    <button className="share-inline-btn" onClick={shareToWhatsApp} aria-label="واتساپ">
                        <div className="share-inline-icon" style={{ background: '#25D366' }}>
                            <i className="ti ti-brand-whatsapp" />
                        </div>
                    </button>
                    <button className="share-inline-btn" onClick={shareToTelegram} aria-label="تلگرام">
                        <div className="share-inline-icon" style={{ background: '#2AABEE' }}>
                            <i className="ti ti-brand-telegram" />
                        </div>
                    </button>
                    <button className="share-inline-btn" onClick={copyLink} aria-label="کپی لینک">
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
