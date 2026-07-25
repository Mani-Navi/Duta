import { useState } from 'react';
import api from '../api/axiosConfig';

const OG_IMAGE_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || '';

function ShareBanner({ article, onClose }) {
    const [copied, setCopied] = useState(false);
    const [downloading, setDownloading] = useState(false);

    const ogImageUrl = `${OG_IMAGE_BASE}/api/articles/${article.id}/og-image`;

    const copyLink = async () => {
        await navigator.clipboard.writeText(article.url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const downloadBanner = async () => {
        setDownloading(true);
        try {
            const res = await fetch(ogImageUrl);
            const blob = await res.blob();
            const link = document.createElement('a');
            link.download = 'newsgrid-share.png';
            link.href = URL.createObjectURL(blob);
            link.click();
        } catch {}
        setTimeout(() => setDownloading(false), 1000);
    };

    const shareNative = async () => {
        try {
            const res = await fetch(ogImageUrl);
            const blob = await res.blob();
            const file = new File([blob], 'newsgrid-share.png', { type: 'image/png' });
            if (navigator.share && navigator.canShare?.({ files: [file] })) {
                await navigator.share({ title: article.title, url: article.url, files: [file] });
            } else {
                downloadBanner();
            }
        } catch {
            downloadBanner();
        }
    };

    const shareToTelegram = () =>
        window.open(`https://t.me/share/url?url=${encodeURIComponent(article.url)}&text=${encodeURIComponent(article.title)}`, '_blank');

    const shareToWhatsApp = () =>
        window.open(`https://wa.me/?text=${encodeURIComponent(article.title + '\n' + article.url)}`, '_blank');

    const shareToTwitter = () =>
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(article.title)}&url=${encodeURIComponent(article.url)}`, '_blank');

    return (
        <div className="share-overlay" onClick={onClose}>
            <div className="share-sheet" onClick={e => e.stopPropagation()}>

                <div className="share-header">
                    <span className="share-title">اشتراک‌گذاری</span>
                    <button className="share-close" onClick={onClose} aria-label="بستن">
                        <i className="ti ti-x" />
                    </button>
                </div>

                {/* پیش‌نمایش — مستقیم از Backend */}
                <div className="share-preview">
                    <img
                        src={ogImageUrl}
                        alt="پیش‌نمایش خبر"
                        style={{ width: '100%', borderRadius: '10px', display: 'block' }}
                    />
                </div>

                {/* دکمه‌های شبکه اجتماعی */}
                <div className="share-apps">
                    <button className="share-app-btn" onClick={shareToTelegram}>
                        <div className="share-app-icon" style={{ background: '#2AABEE' }}>
                            <i className="ti ti-brand-telegram" />
                        </div>
                        <span>تلگرام</span>
                    </button>

                    <button className="share-app-btn" onClick={shareToWhatsApp}>
                        <div className="share-app-icon" style={{ background: '#25D366' }}>
                            <i className="ti ti-brand-whatsapp" />
                        </div>
                        <span>واتساپ</span>
                    </button>

                    <button className="share-app-btn" onClick={shareToTwitter}>
                        <div className="share-app-icon" style={{ background: '#000' }}>
                            <i className="ti ti-brand-x" />
                        </div>
                        <span>توییتر</span>
                    </button>

                    <button className="share-app-btn" onClick={shareNative}>
                        <div className="share-app-icon" style={{ background: 'var(--blue)' }}>
                            <i className="ti ti-share" />
                        </div>
                        <span>بیشتر</span>
                    </button>
                </div>

                <div className="share-actions">
                    <button className="share-action-btn" onClick={downloadBanner}>
                        <i className="ti ti-download" />
                        {downloading ? 'در حال دانلود...' : 'دانلود بنر'}
                    </button>
                    <button className="share-action-btn" onClick={copyLink}>
                        <i className={`ti ${copied ? 'ti-check' : 'ti-link'}`} />
                        {copied ? 'کپی شد!' : 'کپی لینک'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ShareBanner;
