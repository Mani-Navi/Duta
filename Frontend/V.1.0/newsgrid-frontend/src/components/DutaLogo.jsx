import React from 'react';

function DutaLogo({ breaking = false }) {
    return (
        <div className={`duta-eye-wrap ${breaking ? 'is-breaking' : ''}`} aria-label="Duta - لوگو اصلی">
            <svg
                width="32"
                height="32"
                viewBox="0 0 32 32"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="duta-eye-svg"
            >
                {/* پلک بالای چشم بادامی */}
                <path
                    d="M 4 16 C 10 7, 22 7, 28 16"
                    stroke="var(--blue)"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                    className="eye-lid eye-lid-top"
                />

                {/* پلک پایین چشم بادامی */}
                <path
                    d="M 4 16 C 10 25, 22 25, 28 16"
                    stroke="var(--blue)"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                    className="eye-lid eye-lid-bottom"
                />

                {/* مردمک فیروزه‌ای انیمیشنی Duta */}
                <circle
                    cx="16"
                    cy="16"
                    r="5"
                    className="eye-pupil"
                />
            </svg>
        </div>
    );
}

export default React.memo(DutaLogo);