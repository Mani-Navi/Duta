import React, { useEffect, useState } from 'react';
import api from '../api/axiosConfig';

function PriceTicker({ lang = 'fa' }) {
    const [prices, setPrices] = useState(null);

    useEffect(() => {
        const fetchPrices = () => {
            if (document.hidden) return; // اگر کاربر در تب دیگری است درخواست نزن
            api.get('/prices')
                .then(res => setPrices(res.data))
                .catch(() => {});
        };

        fetchPrices();
        const interval = setInterval(fetchPrices, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    if (!prices || prices.error) return null;

    return (
        <div className="price-ticker">
            {prices.usd && (
                <div className="price-item green-trend">
                    <span className="price-label">{prices.usd.label}:</span>
                    <span className="price-val">{prices.usd.price} تومان</span>
                    <span className="trend-badge green">▲ +0.4%</span>
                </div>
            )}
            {prices.gold && (
                <div className="price-item red-trend">
                    <span className="price-label">{prices.gold.label}:</span>
                    <span className="price-val">{prices.gold.price} تومان</span>
                    <span className="trend-badge red">▼ -0.2%</span>
                </div>
            )}
        </div>
    );
}

export default PriceTicker;