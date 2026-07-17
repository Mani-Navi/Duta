import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const ICONS = {
    usd:    { symbol: '$', emoji: '💵' },
    gold:   { symbol: 'Au', emoji: '🥇' },
    silver: { symbol: 'Ag', emoji: '🥈' },
    tether: { symbol: '₮', emoji: '₮'  },
};

const ORDER = ['usd', 'tether', 'gold', 'silver'];

function PriceTicker() {
    const [prices, setPrices] = useState(null);
    const [error, setError]   = useState(false);

    const fetchPrices = async () => {
        try {
            const res = await axios.get('/api/prices');
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
        fetchPrices();
        const interval = setInterval(fetchPrices, 5 * 60 * 1000); // هر ۵ دقیقه
        return () => clearInterval(interval);
    }, []);

    if (error || !prices) return null;

    return (
        <div className="price-ticker">
            <div className="ticker-inner">
                {ORDER.map(key => {
                    const item = prices[key];
                    if (!item) return null;
                    const icon = ICONS[key];
                    return (
                        <div className="ticker-item" key={key}>
                            <span className="ticker-symbol">{icon.emoji}</span>
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
