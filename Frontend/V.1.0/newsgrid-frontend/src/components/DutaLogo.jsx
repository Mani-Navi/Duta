import React from 'react';

function DutaLogo({ breaking = false }) {
    return (
        <div className={`duta-circle-eye-wrap ${breaking ? 'is-breaking' : ''}`} aria-label="Duta - لوگو اصلی">
            <svg
                width="34"
                height="34"
                viewBox="0 0 32 32"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="duta-circle-eye-svg"
            >
                {/* دایره بیرونی چشم هندسی */}
                <circle
                    cx="16"
                    cy="16"
                    r="11"
                    stroke="currentColor"
                    strokeWidth="2.8"
                    className="circle-eye-ring"
                />

                {/* مردمک دایره‌ای داخلی */}
                <circle
                    cx="16"
                    cy="16"
                    r="4.8"
                    className="circle-eye-pupil"
                />
            </svg>
        </div>
    );
}

export default React.memo(DutaLogo);