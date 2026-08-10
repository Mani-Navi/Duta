import React, { useState } from 'react';

// Helper function to dynamically update browser tab favicon
const updateFavicon = (color = '#123378') => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="${color}"/></svg>`;
    const encoded = `data:image/svg+xml;base64,${btoa(svg)}`;
    let link = document.querySelector("link[rel*='icon']");
    if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
    }
    link.href = encoded;
};

function DutaLogo({ breaking = false, loading = false }) {
    const [isClicked, setIsClicked] = useState(false);

    // Interactive Click Trigger: Turns browser tab Favicon Red
    const handleClick = () => {
        setIsClicked(true);
        updateFavicon('#A8292B'); // Persian Red

        setTimeout(() => {
            setIsClicked(false);
            updateFavicon('#123378'); // Reset to Persian Blue
        }, 2000);
    };

    return (
        <div
            className={`duta-dot-wrap ${breaking || isClicked ? 'is-red' : ''} ${loading ? 'is-loading' : ''}`}
            onClick={handleClick}
            aria-label="Duta - لوگو دایره‌ای"
            role="button"
            tabIndex={0}
        >
            <svg
                width="32"
                height="32"
                viewBox="0 0 32 32"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="duta-dot-svg"
            >
                {/* Duta Pure Minimal Circle Dot */}
                <circle
                    cx="16"
                    cy="16"
                    r="12"
                    className="duta-circle-dot"
                />
            </svg>
        </div>
    );
}

export default React.memo(DutaLogo);