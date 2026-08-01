import React, { useEffect, useState } from 'react';
import api from '../api/axiosConfig';

function PriceTicker({ lang = 'fa' }) {
    const [prices, setPrices] = useState(null);

    useEffect(() => {
        const fetchPrices = () => {
            if (document.hidden) return;
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
        <div className="price-ticker-capsules" dir="rtl">
            {prices.usd && (
                <div className="price-capsule">
                    <span className="capsule-title">دلار آمریکا</span>
                    <span className="capsule-price">{prices.usd.price}</span>
                    <span className="capsule-unit">تومان</span>
                    <span className="capsule-badge green-badge" dir="ltr">▲ 2.84%</span>
                </div>
            )}
            {prices.gold && (
                <div className="price-capsule">
                    <span className="capsule-title">طلا ۱۸ عیار</span>
                    <span className="capsule-price">{prices.gold.price}</span>
                    <span className="capsule-unit">تومان/گرم</span>
                    <span className="capsule-badge green-badge" dir="ltr">▲ 3.03%</span>
                </div>
            )}
        </div>
    );
}

export default PriceTicker;