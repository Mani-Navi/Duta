import { useState, useEffect } from 'react';
import { fetchSharedMarketData } from '../components/PriceTicker';
import { useUser } from '../context/UserContext';

function SparklineChart({ id = 'asset', points = [], isUp = true }) {
    if (!points || points.length < 2) return null;
    const width = 122;
    const height = 42;

    const rawMin = Math.min(...points);
    const rawMax = Math.max(...points);
    const avg = (rawMin + rawMax) / 2 || 1;

    const minVisualSpan = avg * 0.012;
    const actualSpan = rawMax - rawMin;
    const effectiveSpan = Math.max(actualSpan, minVisualSpan, 1);
    const paddedMin = rawMin - (effectiveSpan - actualSpan) / 2;

    const pts = points.map((p, i) => {
        const x = (i / (points.length - 1)) * (width - 10) + 4;
        const y = height - ((p - paddedMin) / effectiveSpan) * (height - 14) - 7;
        return { x, y };
    });

    let linePath = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
        const curr = pts[i];
        const next = pts[i + 1];
        const midX = ((curr.x + next.x) / 2).toFixed(1);
        const midY = ((curr.y + next.y) / 2).toFixed(1);
        linePath += ` Q ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}, ${midX} ${midY}`;
    }
    const last = pts[pts.length - 1];
    linePath += ` T ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;

    const areaPath = `${linePath} L ${last.x.toFixed(1)} ${height} L ${pts[0].x.toFixed(1)} ${height} Z`;

    const strokeColor = isUp ? '#00BA7C' : '#F4212E';
    const gradId = `spark-grad-${id}`;
    const baselineY = pts[0].y.toFixed(1);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
            <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
                <defs>
                    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={strokeColor} stopOpacity="0.26" />
                        <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
                    </linearGradient>
                </defs>

                {/* خط‌چین قیمت پایه ۲۴ ساعت قبل به سبک Apple Stocks */}
                <line
                    x1="2"
                    y1={baselineY}
                    x2={width - 2}
                    y2={baselineY}
                    stroke="var(--label-3)"
                    strokeOpacity="0.35"
                    strokeWidth="1"
                    strokeDasharray="2.5 2.5"
                />

                <path d={areaPath} fill={`url(#${gradId})`} />

                <path
                    d={linePath}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth="2.1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {/* نقطه قیمت لحظه‌ای در انتهای نمودار */}
                <circle
                    cx={last.x.toFixed(1)}
                    cy={last.y.toFixed(1)}
                    r="2.8"
                    fill={strokeColor}
                />
            </svg>
            <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--label-3)', whiteSpace: 'nowrap' }}>
                روند ۲۴ ساعت اخیر
            </span>
        </div>
    );
}

function Tablo() {
    const [assets, setAssets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeGroup, setActiveGroup] = useState('all');
    const { user, togglePinTicker } = useUser();

    useEffect(() => {
        let mounted = true;
        fetchSharedMarketData(true).then(data => {
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                        <h1 className="tablo-main-title" style={{ marginBottom: 0 }}>تابلو بازار</h1>
                        <span
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '11.5px',
                                fontWeight: 700,
                                padding: '4px 11px',
                                borderRadius: '99px',
                                background: 'var(--chip-bg)',
                                color: 'var(--label-2)',
                                border: '1px solid var(--separator)'
                            }}
                        >
                            <span className="pulse-dot" style={{ background: 'var(--green)' }} aria-hidden="true" />
                            بازه تغییرات و نمودار: ۲۴ ساعت اخیر
                        </span>
                    </div>
                    <p className="tablo-subtitle">
                        نرخ لحظه‌ای ارز، طلا، سکه و رمزارز (به‌روزرسانی خودکار هر ۵ دقیقه) — حداکثر ۴ دارایی را برای نمایش در نوار بالای سایت پین کنید.
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
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                                                <span className={`badge ${asset.up ? 'green' : 'red'}`} style={{ direction: 'ltr' }}>
                                                    {asset.change}
                                                </span>
                                                <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--label-3)' }}>
                                                    ۲۴ ساعته
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <SparklineChart
                                        id={asset.id}
                                        points={asset.points}
                                        isUp={asset.up !== false}
                                    />
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