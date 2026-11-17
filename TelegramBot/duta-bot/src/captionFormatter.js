import { CONFIG, CATEGORIES_META } from './config.js';

const STOP_HASHTAG_WORDS = new Set([
  'از', 'به', 'در', 'با', 'بر', 'برای', 'این', 'آن', 'یک', 'که', 'را', 'شد', 'شود',
  'کرد', 'کرده', 'است', 'هستند', 'بود', 'دارد', 'گفت', 'اعلام', 'جدید', 'امروز',
  'ایران', 'کشور', 'خبر', 'اخبار', 'گزارش', 'جزئیات', 'درباره', 'پس', 'پیش', 'توسط',
  'همراه', 'سایت', 'کانال', 'ادامه', 'بیشتر', 'مطلب', 'اولین', 'سال', 'ماه', 'روز',
  'هیئت', 'مدیره', 'هیئت_مدیره', 'آماده', 'می_شود', 'میشود', 'برکناری', 'کردند', 'شدند',
  'اظهارات', 'فوری', 'حالا', 'امکان', 'کوتاه', 'علیه', 'تمام', 'متوقف'
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
  ['انویدیا', '#انویدیا'],
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

export function sanitizeNewsText(raw = '') {
  return String(raw || '')
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/t\.me\/\S+/gi, '')
    .replace(/@[a-zA-Z0-9_]+/g, '')
    .replace(/#\S+/g, '')
    .replace(/The post[\s\S]*$/i, '')
    .replace(/(نوشته|مطلب).*?اولین بار در[\s\S]*$/i, '')
    .replace(/(ادامه مطلب|بیشتر بخوانید).*$/i, '')
    .replace(/(کانال|عضویت|لینک|منبع)\s*[:：]\s*\S+/gi, '')
    .replace(/[🆔📢🔗👇👈]+/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanHeadlineTitle(rawTitle = '') {
  return sanitizeNewsText(rawTitle)
    .replace(/^[:：\-–—•▪▫🚨🔴⚡️\s]+/u, '')
    .replace(/[:：\-–—\s]+$/, '')
    .trim();
}

export function cleanSourceDisplayName(rawName = '', defaultHandle = '') {
  const str = String(rawName || '').trim();
  const handleMatch = str.match(/@([a-zA-Z0-9_]+)/) || String(defaultHandle || '').match(/@?([a-zA-Z0-9_]{4,})/);
  const handlePart = handleMatch ? ` | @${handleMatch[1]}` : '';

  let base = str
    .replace(/\s*[\(|]?\s*@[a-zA-Z0-9_]+\s*\)?/g, '')
    .replace(/اخبارفوری/g, 'اخبار فوری')
    .replace(/خبرفوری/g, 'خبر فوری')
    .trim();

  const words = base.split(/\s+/).filter(Boolean);
  const uniqueWords = [];
  for (const w of words) {
    if (!uniqueWords.includes(w)) {
      uniqueWords.push(w);
    }
    if (uniqueWords.length >= 3) break;
  }
  base = uniqueWords.join(' ').trim() || 'کانال تلگرام';
  return `${base}${handlePart}`;
}

export function buildSmartHashtags(title = '', category = 'سیاسی') {
  const catMeta = CATEGORIES_META[category] || CATEGORIES_META['سیاسی'];
  const tags = new Set();

  tags.add(catMeta.tag);

  const cleanTitle = cleanHeadlineTitle(title);
  const normalizedForPhrase = cleanTitle
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\u200C/g, ' ');

  for (const [phrase, hashtag] of COMPOUND_HASHTAGS) {
    if (normalizedForPhrase.includes(phrase)) {
      tags.add(hashtag);
      if (tags.size >= 4) break;
    }
  }

  if (tags.size < 4) {
    const words = cleanTitle
      .replace(/ي/g, 'ی')
      .replace(/ك/g, 'ک')
      .replace(/\u200C/g, '_')
      .replace(/[^\p{L}\p{N}_\s]/gu, ' ')
      .split(/\s+/)
      .map(w => w.replace(/^_+|_+$/g, '').trim())
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

function formatSummaryLine(summary, cleanTitle) {
  let cleanSum = sanitizeNewsText(summary)
    .replace(/^[:：\-–—•\s]+/, '')
    .trim();

  if (!cleanSum || cleanSum === cleanTitle || cleanSum.length < 12) {
    return '';
  }

  if (cleanSum.length > 220) {
    const cut = cleanSum.slice(0, 215);
    const lastSpace = cut.lastIndexOf(' ');
    cleanSum = (lastSpace > 100 ? cut.slice(0, lastSpace) : cut) + '…';
  }
  return cleanSum;
}

function extractCoveredSourceNames(item) {
  const names = [];
  const mainInitials = String(item.sourceInitials || item.source_initials || '');
  const mainFallbackHandle = mainInitials.startsWith('@') ? mainInitials : '';

  if (Array.isArray(item.coveredSourcesList)) {
    for (const s of item.coveredSourcesList) {
      const rawN = typeof s === 'string' ? s : s?.name;
      if (rawN) {
        const cleaned = cleanSourceDisplayName(rawN);
        if (cleaned && !names.includes(cleaned)) names.push(cleaned);
      }
    }
  }

  if (item.sourceName || item.source_name) {
    const mainClean = cleanSourceDisplayName(item.sourceName || item.source_name, mainFallbackHandle);
    const baseMain = mainClean.split('|')[0].trim();
    const existingIdx = names.findIndex(n => n.split('|')[0].trim() === baseMain);
    if (existingIdx >= 0) {
      if (mainClean.includes('@') && !names[existingIdx].includes('@')) {
        names[existingIdx] = mainClean;
      }
    } else if (mainClean) {
      names.unshift(mainClean);
    }
  }
  return names;
}

export function formatNewsCaption(item, { isCredibilityUpgraded = false } = {}) {
  const category = item.category || 'سیاسی';
  const catMeta = CATEGORIES_META[category] || CATEGORIES_META['سیاسی'];
  const title = cleanHeadlineTitle(item.title);
  const summaryText = formatSummaryLine(item.summary, title);
  const score = Math.min(100, Math.max(0, Number(item.credibilityScore ?? 78)));

  const coveredNames = extractCoveredSourceNames(item);
  const sourceCount = Math.max(1, Number(item.sourceCount ?? 1), coveredNames.length);

  const numberedSourcesList = coveredNames
    .slice(0, 6)
    .map((src, idx) => `${toPersianDigits(idx + 1)}. ${src}`)
    .join('\n');

  const statusLabel = getScoreStatusText(score);
  const headerPrefix = item.breaking
    ? `🚨 #خبر_فوری | ${catMeta.emoji} ${catMeta.tag}`
    : `${catMeta.emoji} ${catMeta.tag}`;

  const upgradeBadge = isCredibilityUpgraded ? ' (ارتقا یافته 🔄)' : '';

  const lines = [
    `${headerPrefix} | ${title}`
  ];

  if (summaryText) {
    lines.push(
      ``,
      `📝 خلاصه خبر:`,
      `${summaryText}`
    );
  }

  lines.push(
    ``,
    `─────────────────`,
    `📊 ضریب اعتبار: ${toPersianDigits(score)}٪ (${statusLabel})${upgradeBadge}`,
    `📡 پوشش خبری (${toPersianDigits(sourceCount)} منبع مستقل):`,
    numberedSourcesList,
    `─────────────────`
  );

  if (item.shortUrl && String(item.shortUrl).trim()) {
    const displayLink = String(item.shortUrl)
      .trim()
      .replace(/^https?:\/\//i, '');

    lines.push(
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
