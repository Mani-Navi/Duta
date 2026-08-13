import { memo, useEffect } from 'react';

function AdCard() {
    useEffect(() => {
        // اجرای مجدد لودر مدیااد به محض رندر شدن کامپوننت
        try {
            if (window._mediaad && typeof window._mediaad.load === 'function') {
                window._mediaad.load();
            }
        } catch (e) {
            console.error("Mediaad load error:", e);
        }
    }, []);

    return (
        <article className="card ad-wrapper">
            {/* کانتینر اصلی تبلیغ */}
            <div id="mediaad-p7aP3"></div>

            <div style={{
                marginTop: '12px',
                fontSize: '10px',
                fontWeight: '700',
                color: 'var(--turquoise)',
                textAlign: 'left',
                opacity: 0.8
            }}>
                اسپانسر
            </div>
        </article>
    );
}

export default memo(AdCard);