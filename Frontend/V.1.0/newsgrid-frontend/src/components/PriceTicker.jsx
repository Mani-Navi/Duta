import { useEffect, useState } from 'react';
import api from '../api/axiosConfig';

function PriceTicker() {
    const [prices, setPrices] = useState(null);

    useEffect(() => {
        const fetchPrices = () => {
            if (document.hidden) return;
            api.get('/prices')
                .then(res => {
                    if (res.data && !res.data.error) {
                        setPrices(res.data);
                    }
                })
                .catch(() => {});
        };

        fetchPrices();
        const interval = setInterval(fetchPrices, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    if (!prices || prices.error) return null;

    return (
        <div className="price-ticker-wrapper" dir="rtl" aria-label="قیمت زنده دلار و طلا">
            {prices.usd && (
                <div className="price-chip">
                    <span className="chip-label">دلار</span>
                    <span className="chip-value">{prices.usd.price}</span>
                    <span className="chip-unit">تومان</span>
                </div>
            )}
            {prices.gold && (
                <div className="price-chip">
                    <span className="chip-label">طلا ۱۸ عیار</span>
                    <span className="chip-value">{prices.gold.price}</span>
                    <span className="chip-unit">تومان/گرم</span>
                </div>
            )}
        </div>
    );
}

export default PriceTicker;