import { memo } from 'react';

function AdCard() {
    return (
        <article className="card ad-wrapper">
            {/* AD_INJECTION_START: Container for Mediaad Ad */}
            <div id="mediaad-p7aP3"></div>

            {/* نمایش برچسب اسپانسر با استایل برند Duta */}
            <div style={{
                marginTop: '12px',
                fontSize: '10px',
                fontWeight: '700',
                color: 'var(--turquoise)',
                textAlign: 'left',
                opacity: 0.8
            }}>
                اسپانسر دوتا
            </div>
            {/* AD_INJECTION_END */}
        </article>
    );
}

export default memo(AdCard);