import { useEffect, useRef, useState } from 'react';

function ShareBanner({ article, onClose }) {
    const canvasRef = useRef(null);
    const [copied, setCopied] = useState(false);
    const [downloading, setDownloading] = useState(false);

    const srcColor = article.source?.color || '#378ADD';
    const srcInitials = article.source?.initials || article.source?.name?.substring(0, 3) || '?';
    const credibility = article.cluster?.credibilityScore ?? article.source?.credibility ?? 0;
    const isBreaking = article.breaking;

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

    useEffect(() => {
        drawBanner();
    }, [article]);

    const drawBanner = async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const W = 1200, H = 630;
        canvas.width = W;
        canvas.height = H;

        // ── پس‌زمینه gradient ──
        const bg = ctx.createLinearGradient(0, 0, W, H);
        bg.addColorStop(0, '#0D0D1A');
        bg.addColorStop(0.5, '#111128');
        bg.addColorStop(1, '#0A0A18');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        // ── حباب‌های رنگی پس‌زمینه (blur effect) ──
        const blobs = [
            { x: 200, y: 150, r: 280, color: srcColor + '22' },
            { x: 900, y: 450, r: 320, color: '#378ADD22' },
            { x: 1100, y: 100, r: 200, color: '#8B5CF622' },
        ];
        blobs.forEach(b => {
            const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
            grad.addColorStop(0, b.color);
            grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, W, H);
        });

        // ── کارت glass اصلی ──
        const pad = 60;
        const cardX = pad, cardY = pad, cardW = W - pad * 2, cardH = H - pad * 2;
        ctx.save();
        roundRect(ctx, cardX, cardY, cardW, cardH, 32);
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.10)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();

        // ── نوار رنگی منبع بالا ──
        ctx.save();
        roundRect(ctx, cardX, cardY, cardW, 5, { tl: 32, tr: 32, bl: 0, br: 0 });
        const topBar = ctx.createLinearGradient(cardX, 0, cardX + cardW, 0);
        topBar.addColorStop(0, srcColor);
        topBar.addColorStop(1, srcColor + 'AA');
        ctx.fillStyle = topBar;
        ctx.fill();
        ctx.restore();

        // ── لوگو NewsGrid ──
        ctx.font = 'bold 28px -apple-system, Arial';
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillText('News', cardX + 48, cardY + 70);
        ctx.fillStyle = '#378ADD';
        ctx.fillText('Grid', cardX + 48 + ctx.measureText('News').width + 2, cardY + 70);

        // ── badge امتیاز اعتبار ──
        const scoreColor = getScoreColor(credibility);
        const scorePillX = cardX + cardW - 140, scorePillY = cardY + 44;
        ctx.save();
        roundRect(ctx, scorePillX, scorePillY, 120, 36, 18);
        ctx.fillStyle = scoreColor + '22';
        ctx.fill();
        ctx.strokeStyle = scoreColor + '55';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
        ctx.font = 'bold 16px -apple-system, Arial';
        ctx.fillStyle = scoreColor;
        ctx.textAlign = 'center';
        ctx.fillText(`● ${credibility}`, scorePillX + 60, scorePillY + 24);
        ctx.textAlign = 'start';

        // ── badge خبر فوری ──
        if (isBreaking) {
            const bpX = cardX + cardW - 280, bpY = cardY + 44;
            ctx.save();
            roundRect(ctx, bpX, bpY, 120, 36, 18);
            ctx.fillStyle = '#E11D4833';
            ctx.fill();
            ctx.strokeStyle = '#E11D4866';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();
            ctx.font = 'bold 14px -apple-system, Arial';
            ctx.fillStyle = '#E11D48';
            ctx.textAlign = 'center';
            ctx.fillText('● خبر فوری', bpX + 60, bpY + 24);
            ctx.textAlign = 'start';
        }

        // ── خط جداکننده ──
        ctx.strokeStyle = 'rgba(255,255,255,0.07)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cardX + 48, cardY + 96);
        ctx.lineTo(cardX + cardW - 48, cardY + 96);
        ctx.stroke();

        // ── تیتر خبر (فارسی RTL) ──
        ctx.save();
        ctx.font = 'bold 38px Vazirmatn, -apple-system, Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'right';
        ctx.direction = 'rtl';
        const title = article.title || '';
        const maxWidth = cardW - 96;
        const words = title.split(' ');
        let line = '', lines = [];
        for (let word of words) {
            const test = line ? word + ' ' + line : word;
            if (ctx.measureText(test).width > maxWidth && line) {
                lines.push(line);
                line = word;
            } else {
                line = test;
            }
        }
        lines.push(line);
        lines = lines.slice(0, 3);
        const titleY = cardY + 160;
        lines.forEach((l, i) => {
            ctx.fillText(l, cardX + cardW - 48, titleY + i * 56);
        });
        ctx.restore();

        // ── تعداد منابع ──
        const sourceCount = article.cluster?.sourceCount ?? 1;
        ctx.font = '18px Vazirmatn, -apple-system, Arial';
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.textAlign = 'right';
        ctx.fillText(`پوشش داده شده توسط ${sourceCount} منبع`, cardX + cardW - 48, cardY + 160 + lines.length * 56 + 20);
        ctx.textAlign = 'start';

        // ── خط جداکننده پایین ──
        const divY = H - pad - 110;
        ctx.strokeStyle = 'rgba(255,255,255,0.07)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cardX + 48, divY);
        ctx.lineTo(cardX + cardW - 48, divY);
        ctx.stroke();

        // ── badge منبع (glass pill) ──
        const pillX = cardX + 48, pillY = divY + 20;
        ctx.save();
        roundRect(ctx, pillX, pillY, 220, 56, 28);
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();

        // مربع رنگی منبع
        ctx.save();
        roundRect(ctx, pillX + 10, pillY + 10, 36, 36, 10);
        ctx.fillStyle = srcColor;
        ctx.fill();
        ctx.restore();
        ctx.font = 'bold 12px -apple-system, Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText(srcInitials, pillX + 28, pillY + 33);
        ctx.textAlign = 'start';

        ctx.font = 'bold 15px Vazirmatn, -apple-system, Arial';
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillText(article.source?.name || '', pillX + 56, pillY + 28);
        ctx.font = '13px Vazirmatn, -apple-system, Arial';
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillText(formatTime(article.publishedAt), pillX + 56, pillY + 46);

        // ── لینک سایت ──
        ctx.font = '14px -apple-system, Arial';
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.textAlign = 'right';
        ctx.fillText('news-grid-pi.vercel.app', cardX + cardW - 48, divY + 76);
        ctx.textAlign = 'start';
    };

    // helper — rounded rect
    const roundRect = (ctx, x, y, w, h, r) => {
        if (typeof r === 'number') r = { tl: r, tr: r, bl: r, br: r };
        ctx.beginPath();
        ctx.moveTo(x + r.tl, y);
        ctx.lineTo(x + w - r.tr, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r.tr);
        ctx.lineTo(x + w, y + h - r.br);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r.br, y + h);
        ctx.lineTo(x + r.bl, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r.bl);
        ctx.lineTo(x, y + r.tl);
        ctx.quadraticCurveTo(x, y, x + r.tl, y);
        ctx.closePath();
    };

    const downloadBanner = () => {
        setDownloading(true);
        const canvas = canvasRef.current;
        const link = document.createElement('a');
        link.download = 'newsgrid-share.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
        setTimeout(() => setDownloading(false), 1000);
    };

    const copyLink = async () => {
        await navigator.clipboard.writeText(article.url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const shareToTelegram = () => {
        window.open(`https://t.me/share/url?url=${encodeURIComponent(article.url)}&text=${encodeURIComponent(article.title)}`, '_blank');
    };

    const shareToWhatsApp = () => {
        window.open(`https://wa.me/?text=${encodeURIComponent(article.title + '\n' + article.url)}`, '_blank');
    };

    const shareToTwitter = () => {
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(article.title)}&url=${encodeURIComponent(article.url)}`, '_blank');
    };

    const shareNative = async () => {
        const canvas = canvasRef.current;
        canvas.toBlob(async (blob) => {
            const file = new File([blob], 'newsgrid-share.png', { type: 'image/png' });
            if (navigator.share && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    title: article.title,
                    url: article.url,
                    files: [file]
                });
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
                    <button className="share-close" onClick={onClose}>
                        <i className="ti ti-x" />
                    </button>
                </div>

                {/* پیش‌نمایش بنر */}
                <div className="share-preview">
                    <canvas ref={canvasRef} style={{ width: '100%', borderRadius: '12px' }} />
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
                        <div className="share-app-icon" style={{ background: '#000000' }}>
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
