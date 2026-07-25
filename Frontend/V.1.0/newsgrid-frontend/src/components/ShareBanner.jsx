import { useState } from 'react';

const OG_IMAGE_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || '';

function ShareBanner({ article, onClose }) {
    const [copied, setCopied] = useState(false);
    const [tooltip, setTooltip] = useState('');
    const [downloading, setDownloading] = useState(false);

    const ogImageUrl = `${OG_IMAGE_BASE}/api/articles/${article.id}/og-image`;
    const shareUrl = article.url;

    const showTooltip = (label) => {
        setTooltip(label);
        setTimeout(() => setTooltip(''), 1500);
    };

    const copyLink = async () => {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        showTooltip('کپی شد!');
        setTimeout(() => setCopied(false), 2000);
    };

    const downloadBanner = async () => {
        setDownloading(true);
        showTooltip('دانلود...');
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
                await navigator.share({ title: article.title, url: shareUrl, files: [file] });
                return;
            }
        } catch {}
        downloadBanner();
    };

    const buttons = [
        {
            label: 'کپی لینک',
            icon: copied ? 'ti-check' : 'ti-link',
            bg: '#F2F2F7',
            color: '#1C1C1E',
            onClick: copyLink,
        },
        {
            label: 'دانلود',
            icon: 'ti-download',
            bg: '#F2F2F7',
            color: '#1C1C1E',
            onClick: downloadBanner,
        },
        {
            label: 'تلگرام',
            icon: 'ti-brand-telegram',
            bg: '#2AABEE',
            color: '#fff',
            onClick: () => window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(article.title)}`, '_blank'),
        },
        {
            label: 'واتساپ',
            icon: 'ti-brand-whatsapp',
            bg: '#25D366',
            color: '#fff',
            onClick: () => window.open(`https://wa.me/?text=${encodeURIComponent(article.title + '\n' + shareUrl)}`, '_blank'),
        },
        {
            label: 'توییتر',
            icon: 'ti-brand-x',
            bg: '#000',
            color: '#fff',
            onClick: () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(article.title)}&url=${encodeURIComponent(shareUrl)}`, '_blank'),
        },
        {
            label: 'بیشتر',
            icon: 'ti-dots',
            bg: '#F2F2F7',
            color: '#1C1C1E',
            onClick: shareNative,
        },
    ];

    const [activeTooltip, setActiveTooltip] = useState(null);

    return (
        <div className="share-overlay" onClick={onClose}>
            <div className="share-sheet-minimal" onClick={e => e.stopPropagation()}>

                {/* پیش‌نمایش بنر */}
                <div className="share-preview-minimal">
                    <img
                        src={ogImageUrl}
                        alt="پیش‌نمایش"
                        style={{ width: '100%', borderRadius: '12px', display: 'block' }}
                        onError={e => e.target.style.display = 'none'}
                    />
                </div>

                {/* pill افقی دکمه‌ها */}
                <div className="share-pill">
                    {buttons.map((btn, i) => (
                        <div key={i} className="share-pill-item">
                            {activeTooltip === i && (
                                <div className="share-tooltip">{btn.label}</div>
                            )}
                            <button
                                className="share-pill-btn"
                                style={{ background: btn.bg, color: btn.color }}
                                onClick={btn.onClick}
                                onMouseEnter={() => setActiveTooltip(i)}
                                onMouseLeave={() => setActiveTooltip(null)}
                                aria-label={btn.label}
                            >
                                <i className={`ti ${btn.icon}`} />
                            </button>
                        </div>
                    ))}

                    <div className="share-pill-divider" />

                    <button className="share-pill-close" onClick={onClose} aria-label="بستن">
                        <i className="ti ti-x" />
                        بستن
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ShareBanner;
