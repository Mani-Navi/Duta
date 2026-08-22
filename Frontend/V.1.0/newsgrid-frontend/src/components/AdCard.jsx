import { memo, useEffect } from 'react';

function AdCard() {
    useEffect(() => {
        // AD_PERF_OPTIMIZATION: لود تبلیغ با یک وقفه کوتاه برای جلوگیری از بلاک شدن فریم‌های رندر
        const timer = setTimeout(() => {
            try {
                if (window._mediaad && typeof window._mediaad.load === 'function') {
                    window._mediaad.load();
                }
            } catch (e) {
                // خطاهای اسکریپت خارجی نباید باعث توقف برنامه ما شود
            }
        }, 300);

        return () => clearTimeout(timer);
    }, []);

    return (
        <article className="card ad-wrapper" style={{
            minHeight: '120px',
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* کانتینر استاندارد مدیااد */}
            <div id="mediaad-p7aP3"></div>

            {/* برچسب کوچک اسپانسر */}
            <div style={{
                marginTop: 'auto',
                paddingTop: '10px',
                fontSize: '9px',
                fontWeight: '700',
                color: 'var(--turquoise)',
                textAlign: 'left',
                opacity: 0.7
            }}>
                اسپانسر
            </div>
        </article>
    );
}

// استفاده از memo برای جلوگیری از رندر مجدد کارت‌های تبلیغاتی در هر بار اسکرول
export default memo(AdCard);