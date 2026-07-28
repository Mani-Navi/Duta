import { useState, useEffect } from 'react';
import api from "../api/axiosConfig.js";

const ICONS = {
    usd:  { emoji: '💵' },
    gold: { emoji: '🥇' },
};

const ORDER = ['usd', 'gold'];

function PriceTicker() {
    const [prices, setPrices] = useState(null);
    const [error, setError]   = useState(false);

    const fetchPrices = async () => {
        try {
            const res = await api.get('/prices');
            if (res.data && !res.data.error) {
                setPrices(res.data);
                setError(false);
            } else {
                setError(true);
            }
        } catch {
            setError(true);
        }
    };

    useEffect(() => {
        const fetchPrices = () => {
            if (document.hidden) return; // اگر کاربر در تب دیگری است درخواست نزن
            api.get('/prices').then(res => setPrices(res.data)).catch(() => {});
        };

        fetchPrices();
        const interval = setInterval(fetchPrices, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    if (error || !prices) return null;

    return (
        <div className="price-ticker">
            <div className="ticker-inner">
                {ORDER.map(key => {
                    const item = prices[key];
                    if (!item) return null;
                    return (
                        <div className="ticker-item" key={key}>
                            <span className="ticker-symbol">{ICONS[key].emoji}</span>
                            <span className="ticker-label">{item.label}</span>
                            <span className="ticker-price">{item.price}</span>
                            <span className="ticker-unit">تومان</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default PriceTicker;
