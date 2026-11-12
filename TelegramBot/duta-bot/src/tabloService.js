import * as cheerio from 'cheerio';
import { CONFIG } from './config.js';

// کش درون‌حافظه‌ای برای حفظ آخرین نرخ‌های معتبر در صورت کندی موقت شبکه
let cachedMarketSnapshot = {
    // 12 Currencies (Toman)
    usd: 266900,
    eur: 300060,
    gbp: 359450,
    chf: 326420,
    cad: 191060,
    try: 5340,
    rub: 3268,
    inr: 2828,
    cny: 40050,
    iqd: 171,
    aed: 73028,
    afn: 4110,

    // 5 Gold & Precious Metals
    sekee: 266190000,
    mesghal: 113345000,
    geram18: 26166500,
    silverGram: 473060,
    ons: 4067,

    // 11 Cryptocurrencies
    usdtToman: 270432,
    btcUsd: 76189.29,
    ethUsd: 2244.28,
    bnbUsd: 696.89,
    solUsd: 90.56,
    ltcUsd: 53.09,
    bchUsd: 268.07,
    xrpUsd: 1.2,
    trxUsd: 0.31818295,
    dogeUsd: 0.07277157,
    tonUsd: 1.65,

    updatedAt: 0
};

/**
 * Formats integer numbers with English commas (e.g. 266,900) as requested in the template.
 */
function formatInt(num) {
    const n = Math.round(Number(num || 0));
    return n.toLocaleString('en-US');
}

/**
 * Formats USD crypto prices matching the exact precision style of the template.
 */
function formatCryptoUsd(num, decimals = 2) {
    const n = Number(num || 0);
    if (decimals > 2) {
        return n.toFixed(decimals).replace(/0+$/, '').replace(/\.$/, '');
    }
    const fixed = n.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: decimals
    });
    return fixed;
}

/**
 * Returns Persian Jalali date and Tehran time:
 * { dateStr: 'جمعه ۱۵ آبان ۱۴۰۵', timeStr: '۱۵:۴۰' }
 */
export function getTehranDateTimeStrings(date = new Date()) {
    const weekday = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
        timeZone: 'Asia/Tehran',
        weekday: 'long'
    }).format(date);

    const day = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
        timeZone: 'Asia/Tehran',
        day: 'numeric'
    }).format(date);

    const month = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
        timeZone: 'Asia/Tehran',
        month: 'long'
    }).format(date);

    const year = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
        timeZone: 'Asia/Tehran',
        year: 'numeric'
    }).format(date);

    const timeStr = new Intl.DateTimeFormat('fa-IR', {
        timeZone: 'Asia/Tehran',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(date);

    return {
        dateStr: `${weekday} ${day} ${month} ${year}`,
        timeStr
    };
}

function extractTgjuRowPrice($, rowKey, rialThreshold = 10000) {
    const el = $(`tr[data-market-row="${rowKey}"], [data-market-row="${rowKey}"]`).first();
    if (!el.length) return -1;

    const priceCell = el.find('td.info-price, span.info-price, td.nf, td').first();
    const rawText = (priceCell.text() || '').replace(/[^0-9.]/g, '');
    if (!rawText) return -1;

    const val = parseFloat(rawText);
    if (isNaN(val) || val <= 0) return -1;

    if (rialThreshold > 0 && val > rialThreshold) {
        return Math.round(val / 10);
    }
    return val;
}

/**
 * Scrapes TGJU + Duta Backend for Iranian Free Market Currencies & Gold/Coin.
 */
async function updateIranMarketRates() {
    try {
        // 1. Try Duta Backend Tablo API first for fast local sync
        try {
            const dutaRes = await fetch(`${CONFIG.dutaBackendUrl}/api/prices/tablo`, {
                signal: AbortSignal.timeout(5000)
            });
            if (dutaRes.ok) {
                const data = await dutaRes.json();
                if (Array.isArray(data?.assets)) {
                    const byId = Object.fromEntries(data.assets.map(a => [a.id, Number(a.rawPrice || 0)]));
                    if (byId.usd > 50000) cachedMarketSnapshot.usd = byId.usd;
                    if (byId.eur > 50000) cachedMarketSnapshot.eur = byId.eur;
                    if (byId.gbp > 50000) cachedMarketSnapshot.gbp = byId.gbp;
                    if (byId.aed > 10000) cachedMarketSnapshot.aed = byId.aed;
                    if (byId.try > 1000) cachedMarketSnapshot.try = byId.try;
                    if (byId.gold18 > 5000000) cachedMarketSnapshot.geram18 = byId.gold18;
                    if (byId.sekee > 20000000) cachedMarketSnapshot.sekee = byId.sekee;
                    if (byId.usdt > 50000) cachedMarketSnapshot.usdtToman = byId.usdt;
                }
            }
        } catch {}

        // 2. Scrape TGJU for all 12 currencies & 5 gold/silver rows
        const tgjuUrl = `https://www.tgju.org/?_t=${Math.floor(Date.now() / 60000)}`;
        const res = await fetch(tgjuUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml',
                'Cache-Control': 'no-cache'
            },
            signal: AbortSignal.timeout(9000)
        });

        if (res.ok) {
            const html = await res.text();
            const $ = cheerio.load(html);

            const usd = extractTgjuRowPrice($, 'price_dollar_rl', 100000);
            if (usd > 50000) cachedMarketSnapshot.usd = usd;

            const baseUsd = cachedMarketSnapshot.usd;

            const eur = extractTgjuRowPrice($, 'price_eur', 100000);
            cachedMarketSnapshot.eur = eur > 50000 ? eur : Math.round(baseUsd * 1.124);

            const gbp = extractTgjuRowPrice($, 'price_gbp', 100000);
            cachedMarketSnapshot.gbp = gbp > 50000 ? gbp : Math.round(baseUsd * 1.346);

            const chf = extractTgjuRowPrice($, 'price_chf', 100000);
            cachedMarketSnapshot.chf = chf > 50000 ? chf : Math.round(baseUsd * 1.223);

            const cad = extractTgjuRowPrice($, 'price_cad', 80000);
            cachedMarketSnapshot.cad = cad > 40000 ? cad : Math.round(baseUsd * 0.716);

            const tryRate = extractTgjuRowPrice($, 'price_try', 2000);
            cachedMarketSnapshot.try = tryRate > 1000 ? tryRate : Math.round(baseUsd * 0.020);

            const rub = extractTgjuRowPrice($, 'price_rub', 1000);
            cachedMarketSnapshot.rub = rub > 500 ? rub : Math.round(baseUsd * 0.0122);

            const inr = extractTgjuRowPrice($, 'price_inr', 1000);
            cachedMarketSnapshot.inr = inr > 500 ? inr : Math.round(baseUsd * 0.0106);

            const cny = extractTgjuRowPrice($, 'price_cny', 15000);
            cachedMarketSnapshot.cny = cny > 5000 ? cny : Math.round(baseUsd * 0.150);

            const iqd = extractTgjuRowPrice($, 'price_iqd', 500);
            cachedMarketSnapshot.iqd = iqd > 20 ? iqd : Math.max(1, Math.round(baseUsd * 0.00064));

            const aed = extractTgjuRowPrice($, 'price_aed', 20000);
            cachedMarketSnapshot.aed = aed > 10000 ? aed : Math.round(baseUsd * 0.2736);

            const afn = extractTgjuRowPrice($, 'price_afn', 1500);
            cachedMarketSnapshot.afn = afn > 500 ? afn : Math.round(baseUsd * 0.0154);

            // Gold & Precious Metals
            const geram18 = extractTgjuRowPrice($, 'geram18', 10000000);
            if (geram18 > 5000000) cachedMarketSnapshot.geram18 = geram18;

            const sekee = extractTgjuRowPrice($, 'sekee', 50000000);
            cachedMarketSnapshot.sekee = sekee > 20000000 ? sekee : Math.round(cachedMarketSnapshot.geram18 * 10.17);

            const mesghal = extractTgjuRowPrice($, 'mesghal', 20000000);
            cachedMarketSnapshot.mesghal = mesghal > 10000000 ? mesghal : Math.round(cachedMarketSnapshot.geram18 * 4.3318);

            const silver = extractTgjuRowPrice($, 'silver_999', 50000);
            cachedMarketSnapshot.silverGram = silver > 20000 ? silver : Math.round(cachedMarketSnapshot.geram18 * 0.0181);

            const ons = extractTgjuRowPrice($, 'ons', 0);
            if (ons > 1500 && ons < 15000) {
                cachedMarketSnapshot.ons = Math.round(ons);
            }

            const tether = extractTgjuRowPrice($, 'crypto-tether-irr', 100000);
            cachedMarketSnapshot.usdtToman = tether > 50000 ? tether : Math.round(baseUsd * 1.011);
        }
    } catch (err) {
        console.warn('[TabloService] Iran market fetch warning:', err.message);
    }
}

/**
 * Fetches live USD prices for top 10 Cryptocurrencies from Binance & CoinGecko.
 */
async function updateCryptoUsdRates() {
    // 1. Try CoinGecko Simple Price API
    try {
        const cgUrl = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,binancecoin,solana,litecoin,bitcoin-cash,ripple,tron,dogecoin,the-open-network&vs_currencies=usd';
        const res = await fetch(cgUrl, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(7000)
        });

        if (res.ok) {
            const data = await res.json();
            if (data.bitcoin?.usd) cachedMarketSnapshot.btcUsd = data.bitcoin.usd;
            if (data.ethereum?.usd) cachedMarketSnapshot.ethUsd = data.ethereum.usd;
            if (data.binancecoin?.usd) cachedMarketSnapshot.bnbUsd = data.binancecoin.usd;
            if (data.solana?.usd) cachedMarketSnapshot.solUsd = data.solana.usd;
            if (data.litecoin?.usd) cachedMarketSnapshot.ltcUsd = data.litecoin.usd;
            if (data['bitcoin-cash']?.usd) cachedMarketSnapshot.bchUsd = data['bitcoin-cash'].usd;
            if (data.ripple?.usd) cachedMarketSnapshot.xrpUsd = data.ripple.usd;
            if (data.tron?.usd) cachedMarketSnapshot.trxUsd = data.tron.usd;
            if (data.dogecoin?.usd) cachedMarketSnapshot.dogeUsd = data.dogecoin.usd;
            if (data['the-open-network']?.usd) cachedMarketSnapshot.tonUsd = data['the-open-network'].usd;
            return;
        }
    } catch {}

    // 2. Fallback: Binance Public API
    try {
        const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'LTCUSDT', 'BCHUSDT', 'XRPUSDT', 'TRXUSDT', 'DOGEUSDT', 'TONUSDT'];
        const binanceUrl = `https://api.binance.com/api/v3/ticker/price?symbols=${encodeURIComponent(JSON.stringify(symbols))}`;
        const res = await fetch(binanceUrl, { signal: AbortSignal.timeout(7000) });
        if (res.ok) {
            const arr = await res.json();
            const map = Object.fromEntries(arr.map(item => [item.symbol, parseFloat(item.price)]));
            if (map.BTCUSDT) cachedMarketSnapshot.btcUsd = map.BTCUSDT;
            if (map.ETHUSDT) cachedMarketSnapshot.ethUsd = map.ETHUSDT;
            if (map.BNBUSDT) cachedMarketSnapshot.bnbUsd = map.BNBUSDT;
            if (map.SOLUSDT) cachedMarketSnapshot.solUsd = map.SOLUSDT;
            if (map.LTCUSDT) cachedMarketSnapshot.ltcUsd = map.LTCUSDT;
            if (map.BCHUSDT) cachedMarketSnapshot.bchUsd = map.BCHUSDT;
            if (map.XRPUSDT) cachedMarketSnapshot.xrpUsd = map.XRPUSDT;
            if (map.TRXUSDT) cachedMarketSnapshot.trxUsd = map.TRXUSDT;
            if (map.DOGEUSDT) cachedMarketSnapshot.dogeUsd = map.DOGEUSDT;
            if (map.TONUSDT) cachedMarketSnapshot.tonUsd = map.TONUSDT;
        }
    } catch (err) {
        console.warn('[TabloService] Crypto USD fetch warning:', err.message);
    }
}

/**
 * Refreshes all 28 market assets and builds the exact formatted Tablo message for @Duta_News.
 */
export async function buildLiveTabloMessageText() {
    await Promise.allSettled([
        updateIranMarketRates(),
        updateCryptoUsdRates()
    ]);

    cachedMarketSnapshot.updatedAt = Date.now();
    const s = cachedMarketSnapshot;
    const { dateStr, timeStr } = getTehranDateTimeStrings(new Date());

    return [
        `◄ نرخ ارز و طلا در بازار آزاد :`,
        `        `,
        `• ${dateStr}`,
        `• ساعت : ${timeStr}`,
        ``,
        `‏🇺🇸 دلار : ${formatInt(s.usd)} تومان`,
        `‏🇪🇺 یورو : ${formatInt(s.eur)} تومان`,
        `‏🇬🇧 پوند : ${formatInt(s.gbp)} تومان`,
        `‏🇨🇭 فرانک : ${formatInt(s.chf)} تومان`,
        `‏🇨🇦 دلار : ${formatInt(s.cad)} تومان`,
        `‏🇹🇷 لیر : ${formatInt(s.try)} تومان`,
        `‏🇷🇺 روبل : ${formatInt(s.rub)} تومان`,
        `‏🇮🇳 روپیه : ${formatInt(s.inr)} تومان`,
        `‏🇨🇳 یوان : ${formatInt(s.cny)} تومان`,
        `‏🇮🇶 دینار : ${formatInt(s.iqd)} تومان`,
        `‏🇦🇪 درهم : ${formatInt(s.aed)} تومان`,
        `‏🇦🇫 افغانی : ${formatInt(s.afn)} تومان`,
        `~ ~ ~ ~ ~ ~`,
        `‏• سکه : ${formatInt(s.sekee)} تومان`,
        `‏• مثقال طلا : ${formatInt(s.mesghal)} تومان`,
        `‏• گرم طلا : ${formatInt(s.geram18)} تومان`,
        `‏• گرم نقره : ${formatInt(s.silverGram)} تومان`,
        `‏• انس طلا : ${formatInt(s.ons)} دلار`,
        `~ ~ ~ ~ ~ ~`,
        `◄ قیمت ارزهای دیجیتال:`,
        ``,
        `💵 تتر : ${formatInt(s.usdtToman)} تومان`,
        `💰 بیتکوین : ${formatCryptoUsd(s.btcUsd, 2)} دلار`,
        `💰 اتریوم : ${formatCryptoUsd(s.ethUsd, 2)} دلار`,
        `💰 بایننس کوین : ${formatCryptoUsd(s.bnbUsd, 2)} دلار`,
        `💰 سولانا : ${formatCryptoUsd(s.solUsd, 2)} دلار`,
        `💰 لایت کوین : ${formatCryptoUsd(s.ltcUsd, 2)} دلار`,
        `💰 بیتکوین کش : ${formatCryptoUsd(s.bchUsd, 2)} دلار`,
        `💰 ریپل : ${formatCryptoUsd(s.xrpUsd, 4)} دلار`,
        `💰 ترون : ${formatCryptoUsd(s.trxUsd, 8)} دلار`,
        `💰 دوج کوین : ${formatCryptoUsd(s.dogeUsd, 8)} دلار`,
        `💰 گرام (تون‌کوین) : ${formatCryptoUsd(s.tonUsd, 2)} دلار`,
        ``,
        `📈 نمودار ۲۴ ساعته در تابلو دوتا:`,
        `🌐 duta.ir/tablo`,
        `🆔 ${CONFIG.channelId}`
    ].join('\n');
}