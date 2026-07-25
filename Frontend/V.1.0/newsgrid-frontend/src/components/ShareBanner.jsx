import { useState } from 'react';

const BACKEND = import.meta.env.VITE_API_URL?.replace('/api', '') || '';

function ShareBanner({ article, onClose }) {
    const [copied, setCopied] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [tooltip, setTooltip] = useState('');

    // لینک به OG image — تلگرام/واتساپ این رو preview میکنن
    const ogImageUrl = `${BACKEND}/api/articles/${article.id}/og-image`;
    // لینک share — خود سایت ما با article id
    const shareUrl = `${BACKEND}/api/articles/${article.id}/og-image`;

    const showTooltip = (label) => {
        setTooltip(label);
        setTimeout(() => setTooltip(''), 1500);
    };

    const copyLink = async () => {
        await navigator.clipboard.writeText(ogImageUrl);
        setCopied(true);
        showTooltip('کپی شد!');
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
                await navigator.share({ title: article.title, files: [file] });
            } else {
                downloadBanner();
            }
        } catch { downloadBanner(); }
    };

    const shareToTelegram = () => {
        showTooltip('تلگرام');
        window.open(`https://t.me/share/url?url=${encodeURIComponent(ogImageUrl)}&text=${encodeURIComponent(article.title)}`, '_blank');
    };

    const shareToWhatsApp = () => {
        showTooltip('واتساپ');
        window.open(`https://wa.me/?text=${encodeURIComponent(article.title + '\n' + ogImageUrl)}`, '_blank');
    };

    const shareToTwitter = () => {
        showTooltip('توییتر');
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(article.title)}&url=${encodeURIComponent(ogImageUrl)}`, '_blank');
    };

    const buttons = [
        { icon: 'ti-link', label: 'کپی لینک', action: copyLink, bg: '#F2F2F7', color: '#1C1C1E' },
        { icon: 'ti-download', label: 'دانلود', action: downloadBanner, bg: '#F2F2F7', color: '#1C1C1E' },
        { icon: 'ti-brand-telegram', label: 'تلگرام', action: shareToTelegram, bg: '#2AABEE', color: '#fff' },
        { icon: 'ti-brand-whatsapp', label: 'واتساپ', action: shareToWhatsApp, bg: '#25D366', color: '#fff' },
        { icon: 'ti-brand-x', label: 'توییتر', action: shareToTwitter, bg: '#000', color: '#fff' },
        { icon: 'ti-share', label: 'بیشتر', action: shareNative, bg: '#007AFF', color: '#fff' },
    ];

    return (
        <div className="share-overlay" onClick={onClose}>
            <div className="share-sheet-v2" onClick={e => e.stopPropagation()}>

                {/* پیش‌نمایش بنر */}
                <div className="share-preview-v2">
                    <img src={ogImageUrl} alt="پیش‌نمایش"
                         style={{ width: '100%', borderRadius: '14px', display: 'block' }} />
                </div>

                {/* نوار آیکون‌ها */}
                <div className="share-bar">
                    {tooltip && <div className="share-tooltip">{tooltip}</div>}
                    {buttons.map((btn, i) => (
                        <button
                            key={i}
                            className="share-bar-btn"
                            onClick={btn.action}
                            aria-label={btn.label}
                        >
                            <div className="share-bar-icon"
                                 style={{ background: btn.bg, color: btn.color }}>
                                <i className={`ti ${btn.icon}`} />
                            </div>
                        </button>
                    ))}
                </div>

            </div>
        </div>
    );
}

export default ShareBanner;
