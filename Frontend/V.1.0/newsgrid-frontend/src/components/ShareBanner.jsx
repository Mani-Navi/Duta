import { useEffect, useRef, useState } from 'react';

function ShareBanner({ article, onClose }) {
    const canvasRef = useRef(null);
    const [copied, setCopied] = useState(false);
    const [downloading, setDownloading] = useState(false);

    const srcColor = article.source?.color || '#007AFF';
    const srcInitials = article.source?.initials || article.source?.name?.substring(0, 3) || '?';
    const credibility = article.cluster?.credibilityScore ?? article.source?.credibility ?? 0;
    const isBreaking = article.breaking;
    const sourceCount = article.cluster?.sourceCount ?? 1;

    const formatTime = (dateStr) => {
        if (!dateStr) return '';
        const diff = Math.floor((Date.now() - new Date(dateStr)) / 60000);
        if (diff < 60) return `${diff} دقیقه پیش`;
        const hours = Math.floor(diff / 60);
        if (hours < 24) return `${hours} ساعت پیش`;
        return `${Math.floor(hours / 24)} روز پیش`;
    };

    const getScoreColor = (s) => {
        if (s >= 80) return '#34C759';
        if (s >= 50) return '#FF9500';
        return '#FF3B30';
    };

    const getScoreLabel = (s) => {
        if (s >= 80) return 'تأیید شده';
        if (s >= 50) return 'در حال بررسی';
        return 'نامعتبر';
    };

    const roundRect = (ctx, x, y, w, h, r) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.arcTo(x + w, y, x + w, y + r, r);
        ctx.lineTo(x + w, y + h - r);
        ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
        ctx.lineTo(x + r, y + h);
        ctx.arcTo(x, y + h, x, y + h - r, r);
        ctx.lineTo(x, y + r);
        ctx.arcTo(x, y, x + r, y, r);
        ctx.closePath();
    };

    const wrapText = (ctx, text, maxWidth) => {
        const words = text.split(' ');
        const lines = [];
        let line = '';
        for (const word of words) {
            const test = line ? word + ' ' + line : word;
            if (ctx.measureText(test).width > maxWidth && line) {
                lines.push(line);
                line = word;
            } else {
                line = test;
            }
        }
        lines.push(line);
        return lines;
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const W = 1200, H = 630;
        canvas.width = W;
        canvas.height = H;

        const scoreColor = getScoreColor(credibility);

        // ── پس‌زمینه سفید تمیز ──
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, W, H);

        // ── نوار رنگی سمت چپ (accent) ──
        ctx.fillStyle = srcColor;
        ctx.fillRect(0, 0, 8, H);

        // ── بالای صفحه: لوگو + badge ──
        // لوگو
        ctx.font = 'bold 26px -apple-system, Arial, sans-serif';
        ctx.fillStyle = '#1C1C1E';
        ctx.textAlign = 'left';
        ctx.fillText('News', 52, 60);
        const newsW = ctx.measureText('News').width;
        ctx.fillStyle = '#007AFF';
        ctx.fillText('Grid', 52 + newsW + 2, 60);

        // badge امتیاز — بالا راست
        const scoreLabel = getScoreLabel(credibility);
        roundRect(ctx, W - 180, 30, 140, 38, 19);
        ctx.fillStyle = scoreColor + '18';
        ctx.fill();
        ctx.strokeStyle = scoreColor + '60';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.font = 'bold 15px -apple-system, Arial';
        ctx.fillStyle = scoreColor;
        ctx.textAlign = 'right';
        ctx.fillText(`${credibility}  ${scoreLabel}`, W - 32, 54);

        // ── خط جداکننده افقی ──
        ctx.strokeStyle = '#F2F2F7';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(52, 82);
        ctx.lineTo(W - 52, 82);
        ctx.stroke();

        // ── badge خبر فوری ──
        if (isBreaking) {
            roundRect(ctx, 52, 100, 120, 32, 16);
            ctx.fillStyle = '#E11D4815';
            ctx.fill();
            ctx.strokeStyle = '#E11D4840';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.font = 'bold 13px -apple-system, Arial';
            ctx.fillStyle = '#E11D48';
            ctx.textAlign = 'left';
            ctx.fillText('● خبر فوری', 68, 121);
        }

        // ── تیتر خبر ──
        ctx.font = 'bold 44px Vazirmatn, -apple-system, Arial';
        ctx.fillStyle = '#1C1C1E';
        ctx.textAlign = 'right';
        ctx.direction = 'rtl';
        const titleY = isBreaking ? 190 : 160;
        const lines = wrapText(ctx, article.title || '', W - 104);
        lines.slice(0, 3).forEach((line, i) => {
            ctx.fillText(line, W - 52, titleY + i * 60);
        });

        // ── تعداد منابع ──
        ctx.font = '18px -apple-system, Arial';
        ctx.fillStyle = '#8E8E93';
        ctx.textAlign = 'right';
        const afterTitle = titleY + Math.min(lines.length, 3) * 60 + 16;
        ctx.fillText(`پوشش توسط ${sourceCount} منبع`, W - 52, afterTitle);

        // ── خط جداکننده پایین ──
        ctx.strokeStyle = '#F2F2F7';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(52, H - 110);
        ctx.lineTo(W - 52, H - 110);
        ctx.stroke();

        // ── badge منبع ──
        // مربع رنگی
        ctx.save();
        roundRect(ctx, 52, H - 92, 52, 52, 12);
        ctx.fillStyle = srcColor;
        ctx.fill();
        ctx.restore();

        ctx.font = 'bold 14px -apple-system, Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.direction = 'ltr';
        ctx.fillText(srcInitials, 78, H - 60);

        // نام منبع
        ctx.font = 'bold 17px Vazirmatn, -apple-system, Arial';
        ctx.fillStyle = '#1C1C1E';
        ctx.textAlign = 'left';
        ctx.fillText(article.source?.name || '', 116, H - 72);

        ctx.font = '14px -apple-system, Arial';
        ctx.fillStyle = '#8E8E93';
        ctx.fillText(formatTime(article.publishedAt), 116, H - 50);

        // ── لینک سایت — پایین راست ──
        ctx.font = '13px -apple-system, Arial';
        ctx.fillStyle = '#C7C7CC';
        ctx.textAlign = 'right';
        ctx.fillText('news-grid-pi.vercel.app', W - 52, H - 50);

    }, [article]);

    const downloadBanner = () => {
        setDownloading(true);
        const link = document.createElement('a');
        link.download = 'newsgrid-share.png';
        link.href = canvasRef.current.toDataURL('image/png');
        link.click();
        setTimeout(() => setDownloading(false), 1000);
    };

    const copyLink = async () => {
        await navigator.clipboard.writeText(article.url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const shareToTelegram = () =>
        window.open(`https://t.me/share/url?url=${encodeURIComponent(article.url)}&text=${encodeURIComponent(article.title)}`, '_blank');

    const shareToWhatsApp = () =>
        window.open(`https://wa.me/?text=${encodeURIComponent(article.title + '\n' + article.url)}`, '_blank');

    const shareToTwitter = () =>
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(article.title)}&url=${encodeURIComponent(article.url)}`, '_blank');

    const shareNative = () => {
        canvasRef.current.toBlob(async (blob) => {
            const file = new File([blob], 'newsgrid-share.png', { type: 'image/png' });
            if (navigator.share && navigator.canShare?.({ files: [file] })) {
                await navigator.share({ title: article.title, url: article.url, files: [file] });
            } else {
                downloadBanner();
            }
        });
    };

    return (
        <div className="share-overlay" onClick={onClose}>
            <div className="share-sheet" onClick={e => e.stopPropagation()}>
                <div className="share-header">
                    <span className="share-title">اشتراک‌گذاری</span>
                    <button className="share-close" onClick={onClose} aria-label="بستن">
                        <i className="ti ti-x" />
                    </button>
                </div>

                <div className="share-preview">
                    <canvas ref={canvasRef} style={{ width: '100%', borderRadius: '10px', display: 'block' }} />
                </div>

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