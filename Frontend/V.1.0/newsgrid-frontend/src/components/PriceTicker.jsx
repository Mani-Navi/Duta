import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import { useUser } from '../context/UserContext';

let sharedTabloAssets = null;
let lastFetchTime = 0;
let activePromise = null;
const subscribers = new Set();
const FETCH_INTERVAL_MS = 5 * 60 * 1000;

const SHORT_NAMES = {
    usd: 'دلار',
    eur: 'یورو',
    aed: 'درهم',
    gbp: 'پوند',
    try: 'لیر',
    gold18: 'طلا ۱۸',
    gold24: 'طلا ۲۴',
    sekee: 'سکه امامی',
    sekeb: 'سکه بهار',
    nim: 'نیم‌سکه',
    rob: 'ربع‌سکه',
    usdt: 'تتر'
};

function notifySubscribers(assets) {
    sharedTabloAssets = assets;
    lastFetchTime = Date.now();
    subscribers.forEach(cb => cb(assets));
}

export function fetchSharedMarketData(force = false) {
    if (document.hidden) return Promise.resolve(sharedTabloAssets);
    if (!force && sharedTabloAssets && (Date.now() - lastFetchTime < FETCH_INTERVAL_MS)) {
        return Promise.resolve(sharedTabloAssets);
    }
    if (activePromise) return activePromise;

    activePromise = api.get('/prices/tablo')
        .then(res => {
            if (res.data && Array.isArray(res.data.assets) && res.data.assets.length > 0) {
                notifySubscribers(res.data.assets);
                return res.data.assets;
            }
            return api.get('/prices').then(legacy => {
                if (legacy.data && !legacy.data.error) {
                    const fallbackList = [];
                    if (legacy.data.usd) {
                        fallbackList.push({ id: 'usd', name: 'دلار آزاد', price: legacy.data.usd.price, unit: 'تومان', chipTheme: 'usd' });
                    }
                    if (legacy.data.gold) {
                        fallbackList.push({ id: 'gold18', name: 'طلا ۱۸ عیار', price: legacy.data.gold.price, unit: 'تومان/گرم', chipTheme: 'gold' });
                    }
                    if (fallbackList.length > 0) notifySubscribers(fallbackList);
                }
                return sharedTabloAssets;
            });
        })
        .catch(() => sharedTabloAssets)
        .finally(() => {
            activePromise = null;
        });

    return activePromise;
}

function PriceTicker() {
    const [assets, setAssets] = useState(sharedTabloAssets);
    const { user } = useUser();
    const navigate = useNavigate();

    useEffect(() => {
        subscribers.add(setAssets);
        fetchSharedMarketData(false);

        const interval = setInterval(() => fetchSharedMarketData(true), FETCH_INTERVAL_MS);
        return () => {
            subscribers.delete(setAssets);
            clearInterval(interval);
        };
    }, []);

    const pinnedIds = (user?.pinnedTickers && user.pinnedTickers.length > 0)
        ? user.pinnedTickers
        : ['usd', 'gold18'];

    const displayedAssets = assets
        ? pinnedIds.map(id => assets.find(a => a.id === id)).filter(Boolean)
        : [];

    const isCompact = displayedAssets.length >= 3;

    return (
        <div
            className={`price-ticker-wrapper ${isCompact ? 'is-compact' : ''}`}
            dir="rtl"
            aria-label="نرخ زنده بازار — کلیک برای مشاهده تابلو"
            onClick={() => navigate('/tablo')}
            style={{ cursor: 'pointer' }}
            title="مشاهده تابلو کامل بازار"
        >
            {displayedAssets.length > 0 ? (
                displayedAssets.map(item => {
                    const label = isCompact ? (SHORT_NAMES[item.id] || item.name) : item.name;
                    return (
                        <div key={item.id} className={`price-chip ${item.chipTheme === 'gold' ? 'gold' : 'usd'}`}>
                            <span className="chip-label">{label}</span>
                            <span className="chip-value">{item.price}</span>
                            {!isCompact && <span className="chip-unit">{item.unit}</span>}
                        </div>
                    );
                })
            ) : (
                <>
                    <div className="price-chip usd skeleton-chip" aria-hidden="true" style={{ opacity: 0.4 }}>
                        <span className="chip-label">دلار</span>
                        <span className="chip-value">---,---</span>
                    </div>
                    <div className="price-chip gold skeleton-chip" aria-hidden="true" style={{ opacity: 0.4 }}>
                        <span className="chip-label">طلا ۱۸ عیار</span>
                        <span className="chip-value">-,---,---</span>
                    </div>
                </>
            )}
        </div>
    );
}

export default PriceTicker;