import React from 'react';

function DutaLogo({ breaking = false, loading = false }) {
    return (
        <div className={`duta-eye-wrap ${breaking ? 'is-breaking' : ''} ${loading ? 'is-loading' : ''}`} aria-label="Duta - لوگو">
            <svg
                width="38"
                height="38"
                viewBox="0 0 32 32"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="duta-eye-svg"
            >
                <path
                    d="M 3 16 C 9 6, 23 6, 29 16"
                    stroke="var(--blue)"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    className="eye-lid eye-lid-top"
                />

                <path
                    d="M 3 16 C 9 26, 23 26, 29 16"
                    stroke="var(--blue)"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    className="eye-lid eye-lid-bottom"
                />

                <circle
                    cx="16"
                    cy="16"
                    r="6"
                    className="eye-pupil"
                />
            </svg>
        </div>
    );
}

export default React.memo(DutaLogo);