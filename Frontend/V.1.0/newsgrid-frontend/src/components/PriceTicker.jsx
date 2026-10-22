import { useEffect, useState } from 'react';
import api from '../api/axiosConfig';

// Module-level singleton state to prevent duplicate requests from mobile + desktop headers
let sharedPrices = null;
let lastFetchTime = 0;
let activePromise = null;
const subscribers = new Set();
const FETCH_INTERVAL_MS = 5 * 60 * 1000;

function notifySubscribers(data) {
    sharedPrices = data;
    lastFetchTime = Date.now();
    subscribers.forEach(cb => cb(data));
}

function fetchSharedPrices(force = false) {
    if (document.hidden) return;
    if (!force && sharedPrices && (Date.now() - lastFetchTime < FETCH_INTERVAL_MS)) {
        return;
    }
    if (activePromise) return;

    activePromise = api.get('/prices')
        .then(res => {
            if (res.data && !res.data.error) {
                notifySubscribers(res.data);
            }
        })
        .catch(() => {})
        .finally(() => {
            activePromise = null;
        });
}

function PriceTicker() {
    const [prices, setPrices] = useState(sharedPrices);

    useEffect(() => {
        subscribers.add(setPrices);
        fetchSharedPrices(false);

        const interval = setInterval(() => fetchSharedPrices(true), FETCH_INTERVAL_MS);
        return () => {
            subscribers.delete(setPrices);
            clearInterval(interval);
        };
    }, []);

    return (
        <div className="price-ticker-wrapper" dir="rtl" aria-label="قیمت زنده دلار و طلا">
            {prices?.usd ? (
                <div className="price-chip usd">
                    <span className="chip-label">دلار</span>
                    <span className="chip-value">{prices.usd.price}</span>
                    <span className="chip-unit">تومان</span>
                </div>
            ) : (
                <div className="price-chip usd skeleton-chip" aria-hidden="true" style={{ opacity: 0.4 }}>
                    <span className="chip-label">دلار</span>
                    <span className="chip-value">---,---</span>
                </div>
            )}

            {prices?.gold ? (
                <div className="price-chip gold">
                    <span className="chip-label">طلا ۱۸ عیار</span>
                    <span className="chip-value">{prices.gold.price}</span>
                    <span className="chip-unit">تومان/گرم</span>
                </div>
            ) : (
                <div className="price-chip gold skeleton-chip" aria-hidden="true" style={{ opacity: 0.4 }}>
                    <span className="chip-label">طلا ۱۸ عیار</span>
                    <span className="chip-value">-,---,---</span>
                </div>
            )}
        </div>
    );
}

export default PriceTicker;