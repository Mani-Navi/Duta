import { useState, useEffect } from 'react';
import { fetchSharedMarketData } from '../components/PriceTicker';
import { useUser } from '../context/UserContext';

function SparklineChart({ points = [], isUp = true }) {
    if (!points || points.length < 2) return null;
    const width = 108;
    const height = 34;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;

    const coords = points.map((p, i) => {
        const x = (i / (points.length - 1)) * width;
        const y = height - ((p - min) / range) * (height - 8) - 4;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    const strokeColor = isUp ? '#15803d' : '#be123c';

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
            <polyline
                fill="none"
                stroke={strokeColor}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={coords}
            />
        </svg>
    );
}

function Tablo() {
    const [assets, setAssets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeGroup, setActiveGroup] = useState('all');
    const { user, togglePinTicker } = useUser();

    useEffect(() => {
        let mounted = true;
        fetchSharedMarketData(false).then(data => {
            if (mounted && Array.isArray(data)) {
                setAssets(data);
            }
            if (mounted) setLoading(false);
        });
        return () => { mounted = false; };
    }, []);

    const pinnedIds = (user?.pinnedTickers && user.pinnedTickers.length > 0)
        ? user.pinnedTickers
        : ['usd', 'gold18'];

    const filteredAssets = activeGroup === 'all'
        ? assets
        : assets.filter(a => a.group === activeGroup);

    const GROUPS = [
        { id: 'all', label: 'همه بازارها' },
        { id: 'currency', label: 'ارزهای آزاد' },
        { id: 'gold', label: 'طلا و سکه' },
        { id: 'crypto', label: 'رمزارز' }
    ];

    return (
        <div className="page-content">
            <div className="tablo-header-row">
                <div>
                    <h1 className="tablo-main-title">تابلو بازار</h1>
                    <p className="tablo-subtitle">
                        نرخ لحظه‌ای ارز، طلا، سکه و رمزارز به همراه نمودار تغییرات — حداکثر ۴ دارایی را برای نمایش در نوار بالای سایت پین کنید.
                    </p>
                </div>

                <div className="categories" style={{ padding: 0, margin: 0, minHeight: 'auto' }}>
                    {GROUPS.map(g => (
                        <button
                            key={g.id}
                            className={`cat ${activeGroup === g.id ? 'active' : ''}`}
                            onClick={() => setActiveGroup(g.id)}
                        >
                            {g.label}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="grid-status">
                    <div className="status-text">در حال دریافت نرخ‌های لحظه‌ای بازار...</div>
                </div>
            ) : (
                <div className="tablo-grid">
                    {filteredAssets.map(asset => {
                        const isPinned = pinnedIds.includes(asset.id);
                        return (
                            <div key={asset.id} className={`tablo-card ${isPinned ? 'is-pinned' : ''}`}>
                                <div className="tablo-card-top">
                                    <div className="tablo-symbol-group">
                                        <div className="tablo-symbol-box">{asset.symbol}</div>
                                        <div>
                                            <h2 className="tablo-asset-name">{asset.name}</h2>
                                            <span className="tablo-asset-code">{asset.symbol} / IRR</span>
                                        </div>
                                    </div>

                                    <button
                                        className={`tablo-pin-btn ${isPinned ? 'active' : ''}`}
                                        onClick={() => togglePinTicker(asset.id)}
                                        aria-label={isPinned ? `برداشتن پین ${asset.name}` : `پین کردن ${asset.name} در هدر`}
                                    >
                                        {isPinned ? 'پین‌شده در هدر' : '+ پین در هدر'}
                                    </button>
                                </div>

                                <div className="tablo-card-bottom">
                                    <div>
                                        <span className="tablo-price-val">{asset.price}</span>
                                        <span className="tablo-price-unit">{asset.unit}</span>
                                        {asset.change && (
                                            <div>
                                                <span className={`badge ${asset.up ? 'green' : 'red'}`} style={{ display: 'inline-block', marginTop: '6px', direction: 'ltr' }}>
                                                    {asset.change}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <SparklineChart points={asset.points} isUp={asset.up !== false} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default Tablo;