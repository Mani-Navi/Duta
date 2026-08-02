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
        <div className="price-ticker-capsules" dir="rtl" aria-label="قیمت زنده ارز و طلا">
            {prices.usd && (
                <div className="price-capsule">
                    <span className="capsule-title">دلار آمریکا</span>
                    <span className="capsule-price">{prices.usd.price}</span>
                    <span className="capsule-unit">تومان</span>
                </div>
            )}
            {prices.gold && (
                <div className="price-capsule">
                    <span className="capsule-title">طلا ۱۸ عیار</span>
                    <span className="capsule-price">{prices.gold.price}</span>
                    <span className="capsule-unit">تومان/گرم</span>
                </div>
            )}
        </div>
    );
}

export default PriceTicker;