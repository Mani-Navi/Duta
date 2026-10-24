import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import { useUser } from '../context/UserContext';

// Module-level singleton store for Tablo & Header market data
let sharedTabloAssets = null;
let lastFetchTime = 0;
let activePromise = null;
const subscribers = new Set();
const FETCH_INTERVAL_MS = 5 * 60 * 1000;

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
            // Fallback to legacy /prices if /prices/tablo is not yet populated
            return api.get('/prices').then(legacy => {
                if (legacy.data && !legacy.data.error) {
                    const fallbackList = [];
                    if (legacy.data.usd) {
                        fallbackList.push({ id: 'usd', name: 'دلار', price: legacy.data.usd.price, unit: 'تومان', chipTheme: 'usd' });
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

    return (
        <div
            className="price-ticker-wrapper"
            dir="rtl"
            aria-label="نرخ زنده بازار — کلیک برای مشاهده تابلو"
            onClick={() => navigate('/tablo')}
            style={{ cursor: 'pointer' }}
            title="مشاهده تابلو کامل بازار"
        >
            {displayedAssets.length > 0 ? (
                displayedAssets.map(item => (
                    <div key={item.id} className={`price-chip ${item.chipTheme === 'gold' ? 'gold' : 'usd'}`}>
                        <span className="chip-label">{item.name}</span>
                        <span className="chip-value">{item.price}</span>
                        <span className="chip-unit">{item.unit}</span>
                    </div>
                ))
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