import React from 'react';

function DutaLogo({ breaking = false }) {
    return (
        <div className={`duta-eye-wrap ${breaking ? 'is-breaking' : ''}`} aria-label="Duta - لوگو اصلی">
            <svg
                width="36"
                height="36"
                viewBox="0 0 32 32"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="duta-eye-svg"
            >
                {/* پلک بالای درشت */}
                <path
                    d="M 3 16 C 9 6, 23 6, 29 16"
                    stroke="currentColor"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    className="eye-lid eye-lid-top"
                />

                {/* پلک پایین درشت */}
                <path
                    d="M 3 16 C 9 26, 23 26, 29 16"
                    stroke="currentColor"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    className="eye-lid eye-lid-bottom"
                />

                {/* مردمک درشت سیاه و سفید */}
                <circle
                    cx="16"
                    cy="16"
                    r="6.5"
                    className="eye-pupil"
                />
            </svg>
        </div>
    );
}

export default React.memo(DutaLogo);