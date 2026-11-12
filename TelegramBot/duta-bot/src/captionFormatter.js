import { CONFIG, CATEGORIES_META } from './config.js';

const STOP_HASHTAG_WORDS = new Set([
    'از', 'به', 'در', 'با', 'بر', 'برای', 'این', 'آن', 'یک', 'که', 'را', 'شد', 'شود',
    'کرد', 'کرده', 'است', 'هستند', 'بود', 'دارد', 'گفت', 'اعلام', 'جدید', 'امروز',
    'ایران', 'کشور', 'خبر', 'اخبار', 'گزارش', 'جزئیات', 'درباره', 'پس', 'پیش', 'توسط',
    'همراه', 'سایت', 'کانال', 'ادامه', 'بیشتر', 'مطلب', 'اولین', 'سال', 'ماه', 'روز'
]);

const COMPOUND_HASHTAGS = [
    ['ایران خودرو', '#ایران_خودرو'],
    ['سایپا', '#سایپا'],
    ['واردات خودرو', '#واردات_خودرو'],
    ['قیمت خودرو', '#قیمت_خودرو'],
    ['سامانه یکپارچه', '#سامانه_یکپارچه'],
    ['بانک مرکزی', '#بانک_مرکزی'],
    ['بورس', '#بورس'],
    ['بیت کوین', '#بیت_کوین'],
    ['اتریوم', '#اتریوم'],
    ['تتر', '#تتر'],
    ['رمزارز', '#رمزارز'],
    ['طلا', '#طلا'],
    ['سکه', '#سکه'],
    ['دلار', '#دلار'],
    ['تورم', '#تورم'],
    ['سازمان سنجش', '#سازمان_سنجش'],
    ['کنکور', '#کنکور'],
    ['امتحان نهایی', '#امتحان_نهایی'],
    ['آموزش و پرورش', '#آموزش_و_پرورش'],
    ['هوش مصنوعی', '#هوش_مصنوعی'],
    ['فیلترینگ', '#فیلترینگ'],
    ['پرسپولیس', '#پرسپولیس'],
    ['استقلال', '#استقلال'],
    ['فوتبال', '#فوتبال']
];

function toPersianDigits(input) {
    const persian = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(input ?? '').replace(/\d/g, d => persian[Number(d)]);
}

function getScoreStatusText(score) {
    const s = Number(score || 75);
    if (s >= 80) return 'تأیید شده ✅';
    if (s >= 50) return 'در حال بررسی 🟠';
    return 'نامعتبر 🔴';
}

export function buildSmartHashtags(title = '', category = 'سیاسی') {
    const catMeta = CATEGORIES_META[category] || CATEGORIES_META['سیاسی'];
    const tags = new Set();

    tags.add(catMeta.tag);

    const normalizedTitle = String(title)
        .replace(/ي/g, 'ی')
        .replace(/ك/g, 'ک')
        .replace(/\u200C/g, ' ');

    for (const [phrase, hashtag] of COMPOUND_HASHTAGS) {
        if (normalizedTitle.includes(phrase)) {
            tags.add(hashtag);
            if (tags.size >= 4) break;
        }
    }

    if (tags.size < 4) {
        const words = normalizedTitle
            .replace(/[^\p{L}\p{N}\s]/gu, ' ')
            .split(/\s+/)
            .map(w => w.trim())
            .filter(w => w.length >= 4 && !STOP_HASHTAG_WORDS.has(w) && !/^\d+$/.test(w));

        for (const w of words) {
            tags.add(`#${w}`);
            if (tags.size >= 4) break;
        }
    }

    for (const defTag of catMeta.defaultHashtags) {
        if (tags.size >= 4) break;
        tags.add(defTag);
    }

    tags.add('#فکت_چک');
    return Array.from(tags).slice(0, 5).join(' ');
}

function formatSummaryLine(summary, title) {
    const cleanTitle = String(title || '').trim();
    let cleanSum = String(summary || '')
        .replace(/The post[\s\S]*$/i, '')
        .replace(/(نوشته|مطلب).*?اولین بار در[\s\S]*$/i, '')
        .replace(/(ادامه مطلب|بیشتر بخوانید).*$/i, '')
        .replace(/\s+/g, ' ')
        .trim();

    if (!cleanSum || cleanSum === cleanTitle || cleanSum.length < 15) {
        return `${cleanTitle}؛ جزئیات و بررسی اعتبار این خبر از منابع خبری مستقل جمع‌آوری شده است.`;
    }

    if (cleanSum.length > 230) {
        const cut = cleanSum.slice(0, 225);
        const lastSpace = cut.lastIndexOf(' ');
        cleanSum = (lastSpace > 100 ? cut.slice(0, lastSpace) : cut) + '...';
    }
    return cleanSum;
}

function extractCoveredSourceNames(item) {
    const names = [];
    if (Array.isArray(item.coveredSourcesList)) {
        for (const s of item.coveredSourcesList) {
            const n = typeof s === 'string' ? s : s?.name;
            if (n && !names.includes(n)) names.push(n);
        }
    }
    if (item.sourceName && !names.includes(item.sourceName)) {
        names.unshift(item.sourceName);
    }
    return names;
}

/**
 * Formats the exact Telegram caption requested for @Duta_News including covered agency names.
 */
export function formatNewsCaption(item, { isCredibilityUpgraded = false } = {}) {
    const category = item.category || 'سیاسی';
    const catMeta = CATEGORIES_META[category] || CATEGORIES_META['سیاسی'];
    const title = String(item.title || '').trim();
    const summaryText = formatSummaryLine(item.summary, title);
    const score = Math.min(100, Math.max(0, Number(item.credibilityScore ?? 78)));

    const coveredNames = extractCoveredSourceNames(item);
    const sourceCount = Math.max(1, Number(item.sourceCount ?? 1), coveredNames.length);
    const sourcesNamesLabel = coveredNames.length > 0
        ? ` (${coveredNames.slice(0, 5).join('، ')})`
        : '';

    const statusLabel = getScoreStatusText(score);

    const headerPrefix = item.breaking
        ? `🚨 #خبر_فوری | ${catMeta.emoji} ${catMeta.tag}`
        : `${catMeta.emoji} ${catMeta.tag}`;

    const upgradeBadge = isCredibilityUpgraded ? ' (ارتقا یافته 🔄)' : '';

    const lines = [
        `${headerPrefix} | ${title}`,
        ``,
        `خلاصه خبر:`,
        `${summaryText}`,
        ``,
        `📊 ضریب اعتبار: ${toPersianDigits(score)}٪ (${statusLabel})${upgradeBadge}`,
        `📡 پوشش: ${toPersianDigits(sourceCount)} منبع مستقل${sourcesNamesLabel}`
    ];

    if (item.shortUrl && String(item.shortUrl).trim()) {
        const displayLink = String(item.shortUrl)
            .trim()
            .replace(/^https?:\/\//i, '');

        lines.push(
            ``,
            ``,
            `🔍 بررسی اطلاعیه‌های رسمی در سامانه دوتا:`,
            `🌐 ${displayLink}`
        );
    }

    const hashtags = buildSmartHashtags(title, category);
    lines.push(
        ``,
        `🆔 ${CONFIG.channelId}`,
        hashtags
    );

    return lines.join('\n');
}