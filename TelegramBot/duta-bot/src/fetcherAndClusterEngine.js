import * as cheerio from 'cheerio';
import { XMLParser } from 'fast-xml-parser';
import { CONFIG } from './config.js';
import {
  getAllSources,
  touchSourceFetched,
  isUrlSeen,
  markUrlSeen,
  getRecentClusters,
  getClusterBySiteClusterId,
  createCluster,
  updateClusterData,
  createDraft,
  getBooleanSetting,
  getEligibleAdminsForDraft,
  updateClusterTelegramMetrics
} from './db.js';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true
});

const SIMILARITY_THRESHOLD = 0.25;

const STOP_WORDS = new Set([
  'و', 'در', 'به', 'از', 'که', 'این', 'را', 'با', 'است', 'آن',
  'یک', 'های', 'برای', 'یا', 'اما', 'تا', 'هم', 'می', 'شد', 'شده',
  'کرد', 'کرده', 'خود', 'ها', 'هر', 'بر', 'نیز', 'پس', 'اگر', 'بود',
  'روی', 'زیر', 'بین', 'چند', 'دارد', 'شود', 'کند', 'گفت'
]);

const AD_KEYWORDS = [
  'تبلیغات', 'رزرو تبلیغ', 'تعرفه تبلیغات', 'فروش ویژه', 'تخفیف ویژه', 'کد تخفیف',
  'ثبت نام رایگان', 'کسب درآمد', 'سیگنال رایگان', 'سیگنال vip', 'کانال vip',
  'فیلترشکن', 'خرید vpn', 'سرور اختصاصی', 'پکیج آموزشی', 'مشاوره رایگان',
  'ظرفیت محدود', 'همین حالا عضو شوید', 'لینک در بیو', 'جهت سفارش', 'پرداخت درب منزل',
  'ضمانت بازگشت وجه', 'ایردراپ معتبر', 'ربات استخراج', 'وام فوری بدون ضامن'
];

const BRAND_COLORS = ['#007AFF', '#10B981', '#F59E0B', '#6366F1', '#EC4899', '#0EA5E9', '#8B5CF6', '#14B8A6'];

export function normalizeText(text = '') {
  return String(text)
    .toLowerCase()
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\u200C/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeTitle(title = '') {
  const norm = normalizeText(title).replace(/(هایی|های|ها)(?=\s|$)/g, ' ');
  const tokens = norm
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length > 1 && !STOP_WORDS.has(w));
  return new Set(tokens);
}

export function jaccardSimilarity(setA, setB) {
  if (!setA.size || !setB.size) return 0;
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  if (intersection === 0) return 0;
  const union = setA.size + setB.size - intersection;
  return intersection / union;
}

export function mapRssCategoryTag(rawTag = '') {
  const t = String(rawTag || '').trim().toLowerCase().replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/\u200C/g, ' ');
  if (!t || t === 'اخبار' || t === 'خبر' || t === 'فوری' || t === 'خبر فوری') return null;
  if (t.includes('رمزارز') || t.includes('ارز دیجیتال') || t.includes('بلاکچین') || t.includes('کریپتو')) return 'رمزارز';
  if (t.includes('خودرو') || t.includes('ماشین')) return 'خودرو';
  if (t.includes('آموزش') || t.includes('دانشگاه') || t.includes('مدرسه') || t.includes('کنکور')) return 'آموزشی';
  if (t.includes('تکنولوژی') || t.includes('فناوری') || t.includes('دیجیتال') || t.includes('هوش مصنوعی') || t.includes('موبایل')) return 'تکنولوژی';
  if (t.includes('ورزش') || t.includes('فوتبال') || t.includes('المپیک')) return 'ورزشی';
  if (t.includes('اقتصاد') || t.includes('بازار') || t.includes('بورس') || t.includes('بانک') || t.includes('صنعت') || t.includes('تجارت') || t.includes('نفت')) return 'اقتصادی';
  if (t.includes('بین الملل') || t.includes('جهان') || t.includes('خاورمیانه') || t.includes('سیاست خارجی')) return 'جهانی';
  if (t.includes('سلامت') || t.includes('پزشکی') || t.includes('بهداشت') || t.includes('درمان')) return 'سلامت';
  if (t.includes('سرگرمی') || t.includes('سینما') || t.includes('تلویزیون') || t.includes('گیم') || t.includes('بازی')) return 'سرگرمی';
  if (t.includes('فرهنگ') || t.includes('هنر') || t.includes('کتاب') || t.includes('موسیقی') || t.includes('تئاتر') || t.includes('گردشگری')) return 'فرهنگ و هنر';
  if (t.includes('عمومی') || t.includes('گوناگون') || t.includes('چندرسانه') || t.includes('اجتماع') || t.includes('جامعه') || t.includes('حوادث') || t.includes('شهری') || t.includes('محیط زیست') || t.includes('انتظامی') || t.includes('قضایی') || t.includes('استان')) return 'اجتماعی';
  if (t.includes('سیاس') || t.includes('مجلس') || t.includes('دولت') || t.includes('دفاع') || t.includes('امنیت')) return 'سیاسی';
  return null;
}

export function classifyCategory(rssCategories = [], fallbackCategory = 'سیاسی') {
  if (Array.isArray(rssCategories)) {
    for (const c of rssCategories) {
      const mapped = mapRssCategoryTag(c?.['#text'] || c || '');
      if (mapped) return mapped;
    }
  }
  return fallbackCategory || 'سیاسی';
}

/**
 * STRICT Source-Declared Breaking News Detection (No generic keywords!):
 * Returns true ONLY if the publisher tagged it in RSS <category> or started the title with "فوری:" / "خبر فوری"
 */
export function detectBreakingNews(title = '', rssCategories = []) {
  if (Array.isArray(rssCategories)) {
    for (const c of rssCategories) {
      const catStr = String(c?.['#text'] || c || '')
        .trim()
        .toLowerCase()
        .replace(/ي/g, 'ی')
        .replace(/ك/g, 'ک')
        .replace(/\u200C/g, ' ');
      if (
        catStr === 'فوری' ||
        catStr === 'خبر فوری' ||
        catStr === 'اخبار فوری' ||
        catStr === 'خبرفوری' ||
        catStr.includes('breaking') ||
        catStr.includes('urgent')
      ) {
        return true;
      }
    }
  }

  if (!title) return false;
  const norm = String(title)
    .trim()
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\u200C/g, ' ');

  if (/^[\s\[«(🚨🔴⚡️]*(خبر\s*فوری|اخبار\s*فوری|فوری)\s*([:/|؛\-—\]»)]|$)/u.test(norm)) {
    return true;
  }
  if (
    norm.includes('خبر فوری') ||
    norm.includes('خبرفوری') ||
    norm.includes('[فوری]') ||
    norm.includes('(فوری)')
  ) {
    return true;
  }
  return false;
}

export function calculateBayesianClusterScore(coveredSources = []) {
  if (!coveredSources || coveredSources.length === 0) return 75;

  let weightedSum = 0;
  let totalWeight = 0;
  const uniqueNames = new Set();
  let highCredCount = 0;

  for (const src of coveredSources) {
    const cred = Number(src.credibility || 75);
    const weight = cred * cred;
    weightedSum += cred * weight;
    totalWeight += weight;

    const key = src.name || String(cred);
    if (!uniqueNames.has(key)) {
      uniqueNames.add(key);
      if (cred >= 75) highCredCount++;
    }
  }

  const baseQuality = totalWeight > 0 ? weightedSum / totalWeight : 70;
  const uniqueCount = uniqueNames.size;
  if (uniqueCount <= 1) {
    return Math.min(100, Math.round(baseQuality));
  }

  let rawBoost = 14.0;
  if (uniqueCount === 2) rawBoost = 4.0;
  else if (uniqueCount === 3) rawBoost = 8.0;
  else if (uniqueCount === 4) rawBoost = 11.0;

  const trustMultiplier = highCredCount >= 2 ? 1.0 : (highCredCount === 1 ? 0.85 : 0.6);
  return Math.min(100, Math.round(baseQuality + rawBoost * trustMultiplier));
}

export function detectAdvertisement(text = '', channelHandle = '', externalLinks = [], isSponsoredHtml = false) {
  if (isSponsoredHtml) {
    return { isAd: true, reason: 'پست تبلیغاتی رسمی تلگرام (Sponsored)' };
  }

  const raw = String(text || '').trim();
  const norm = normalizeText(raw);
  const cleanChannel = String(channelHandle || '').replace(/^@/, '').toLowerCase();

  if (/t\.me\/(\+|joinchat\/)/i.test(raw) || /\?start=/i.test(raw)) {
    return { isAd: true, reason: 'حاوی لینک عضویت تبلیغاتی یا رفرال ربات' };
  }

  for (const link of externalLinks) {
    if (/t\.me\/(\+|joinchat\/)/i.test(link) || /\?start=/i.test(link)) {
      return { isAd: true, reason: 'لینک مخفی عضویت کانال/ربات تبلیغاتی' };
    }
  }

  const mentions = [...raw.matchAll(/@([a-zA-Z0-9_]{4,})/g)].map(m => m[1].toLowerCase());
  const foreignMentions = mentions.filter(
    m => m !== cleanChannel && m !== 'duta_news' && m !== 'duta_ir'
  );
  if (foreignMentions.length >= 2) {
    return { isAd: true, reason: `تبلیغ آیدی تلگرام دیگر (@${foreignMentions[0]})` };
  }

  for (const kw of AD_KEYWORDS) {
    if (norm.includes(kw)) {
      return { isAd: true, reason: `واژه تبلیغاتی شناسایی‌شده («${kw}»)` };
    }
  }

  if (foreignMentions.length === 1 && (/(خرید|فروش|قیمت|تومان|کانال|پیج|عضو|لینک)/.test(norm) || /[👇👈🔥💰🎁]{2,}/u.test(raw))) {
    return { isAd: true, reason: `ارجاع تبلیغاتی به @${foreignMentions[0]}` };
  }

  return { isAd: false, reason: null };
}

export async function fetchTelegramChannelHtml(handle, timeoutMs = 5000) {
  const cleanHandle = String(handle || '').replace(/^@/, '').replace(/^https?:\/\/t\.me\/(s\/)?/i, '').split('/')[0].trim();
  if (!cleanHandle) return null;

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml'
  };
  if (CONFIG.bridgeSecret) {
    headers['X-Duta-Bridge-Key'] = CONFIG.bridgeSecret;
  }

  if (CONFIG.telegramApiRoot && !CONFIG.telegramApiRoot.includes('api.telegram.org')) {
    try {
      const bridgeUrl = `${CONFIG.telegramApiRoot}/tg-scrape/${cleanHandle}`;
      const res = await fetch(bridgeUrl, { headers, signal: AbortSignal.timeout(timeoutMs) });
      if (res.ok) return await res.text();
    } catch {}
    return null;
  }

  try {
    const directUrl = `https://t.me/s/${cleanHandle}`;
    const res = await fetch(directUrl, { headers, signal: AbortSignal.timeout(timeoutMs) });
    if (res.ok) return await res.text();
  } catch {}

  return null;
}

export async function detectSourceInfoFromInput(rawInput) {
  const input = String(rawInput || '').trim();
  const randomColor = BRAND_COLORS[Math.floor(Math.random() * BRAND_COLORS.length)];

  if (input.startsWith('@') || /^(https?:\/\/)?(www\.)?(t\.me|telegram\.me)\//i.test(input)) {
    const handle = input
      .replace(/^@/, '')
      .replace(/^(https?:\/\/)?(www\.)?(t\.me|telegram\.me)\/(s\/)?/i, '')
      .split(/[/?#\s]/)[0]
      .trim();

    let name = handle;
    try {
      const html = await fetchTelegramChannelHtml(handle, 4000);
      if (html) {
        const $ = cheerio.load(html);
        const pageTitle = (
          $('.tgme_channel_info_header_title').text().trim() ||
          $('meta[property="og:title"]').attr('content') ||
          ''
        ).trim();
        if (pageTitle && !pageTitle.toLowerCase().includes('telegram:')) {
          name = pageTitle.slice(0, 35);
        }
      }
    } catch {}

    return {
      type: 'TELEGRAM',
      urlOrHandle: handle,
      name: name || handle,
      color: '#2AABEE',
      initials: `@${handle}`
    };
  }

  const fullUrl = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  let defaultName = 'منبع خبری';
  try {
    const hostname = new URL(fullUrl).hostname.replace(/^www\./i, '');
    defaultName = hostname.split('.')[0].toUpperCase();
  } catch {}

  try {
    const res = await fetch(fullUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, text/html, */*'
      },
      signal: AbortSignal.timeout(6000)
    });

    if (res.ok) {
      const text = await res.text();
      if (text.includes('<rss') || text.includes('<feed') || text.includes('<?xml')) {
        const parsed = xmlParser.parse(text);
        const channelTitle = parsed?.rss?.channel?.title || parsed?.feed?.title;
        if (channelTitle && typeof channelTitle === 'string') {
          defaultName = channelTitle.split('|')[0].split('-')[0].trim().slice(0, 30);
        }
        return {
          type: 'RSS',
          urlOrHandle: fullUrl,
          name: defaultName,
          color: randomColor,
          initials: defaultName.slice(0, 2).toUpperCase()
        };
      } else {
        const $ = cheerio.load(text);
        const siteTitle = ($('meta[property="og:site_name"]').attr('content') || $('title').text() || '').trim();
        if (siteTitle) {
          defaultName = siteTitle.split('|')[0].split('-')[0].trim().slice(0, 25);
        }
        return {
          type: 'WEB',
          urlOrHandle: fullUrl,
          name: defaultName,
          color: randomColor,
          initials: defaultName.slice(0, 2).toUpperCase()
        };
      }
    }
  } catch {}

  const isLikelyRss = /rss|feed|xml/i.test(fullUrl);
  return {
    type: isLikelyRss ? 'RSS' : 'WEB',
    urlOrHandle: fullUrl,
    name: defaultName,
    color: randomColor,
    initials: defaultName.slice(0, 2).toUpperCase()
  };
}

export async function fetchSiteClusterSourcesList(siteClusterId, fallbackSourceName = 'Duta', fallbackScore = 80) {
  if (!siteClusterId) return [{ name: fallbackSourceName, credibility: fallbackScore }];
  try {
    const res = await fetch(`${CONFIG.dutaBackendUrl}/api/clusters/${siteClusterId}/articles`, {
      signal: AbortSignal.timeout(3500)
    });
    if (res.ok) {
      const articles = await res.json();
      if (Array.isArray(articles) && articles.length > 0) {
        const seen = new Set();
        const list = [];
        for (const a of articles) {
          const sName = a?.source?.name;
          const sCred = a?.source?.credibility || fallbackScore;
          if (sName && !seen.has(sName)) {
            seen.add(sName);
            list.push({ name: sName, credibility: sCred });
          }
        }
        if (list.length > 0) return list;
      }
    }
  } catch {}
  return [{ name: fallbackSourceName, credibility: fallbackScore }];
}

async function findMatchingSiteArticleByKeywords(title, newTokens) {
  try {
    const candidates = Array.from(newTokens).filter(w => w.length >= 4).sort((a, b) => b.length - a.length).slice(0, 2);
    for (const kw of candidates) {
      const url = `${CONFIG.dutaBackendUrl}/api/articles/search?keyword=${encodeURIComponent(kw)}&page=0&size=8`;
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) continue;
      const data = await res.json();
      const items = Array.isArray(data) ? data : (data?.content || []);
      for (const art of items) {
        const artTokens = tokenizeTitle(art.title || '');
        const sim = jaccardSimilarity(newTokens, artTokens);
        let sharedCount = 0;
        for (const t of newTokens) {
          if (t.length >= 4 && artTokens.has(t)) sharedCount++;
        }
        if (sim >= 0.18 || sharedCount >= 3) {
          return art;
        }
      }
    }
  } catch {}
  return null;
}

async function fetchDutaSiteRss({ onNewDraftCreated, onClusterUpgraded }) {
  const urlsToTry = [
    `${CONFIG.dutaBackendUrl}/api/articles/rss.xml`,
    `${CONFIG.dutaSiteUrl}/api/articles/rss.xml`
  ];

  let xmlText = null;
  for (const url of urlsToTry) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        xmlText = await res.text();
        if (xmlText && xmlText.includes('<rss')) break;
      }
    } catch {}
  }

  if (!xmlText) return 0;

  const parsed = xmlParser.parse(xmlText);
  const rawItems = parsed?.rss?.channel?.item;
  if (!rawItems) return 0;

  const items = Array.isArray(rawItems) ? rawItems : [rawItems];
  let processed = 0;

  for (const item of items.slice(0, 35)) {
    const title = String(item.title || '').trim();
    const link = String(item.link || item.guid || '').trim();
    if (!title || !link) continue;

    const siteClusterId = Number(item['duta:clusterId'] || item['duta:articleId'] || 0);
    const siteArticleId = Number(item['duta:articleId'] || 0);
    const score = Number(item['duta:credibilityScore'] || 78);
    const sourceCount = Number(item['duta:sourceCount'] || 1);
    const breaking = String(item['duta:breaking']) === 'true' || detectBreakingNews(title);

    const summary = String(item.description || '').trim();
    const category = String(item.category || 'سیاسی').trim();

    const shortUrl = String(item['duta:shortUrl'] || link).trim();
    const sourceName = String(item['duta:sourceName'] || 'Duta').trim();
    const sourceColor = String(item['duta:sourceColor'] || '#007AFF').trim();
    const sourceInitials = String(item['duta:sourceInitials'] || 'DT').trim();

    const rawCoveredStr = String(item['duta:coveredSources'] || '');
    let coveredList = rawCoveredStr
      .split(/،|,/)
      .map(s => s.trim())
      .filter(Boolean)
      .map(name => ({ name, credibility: score }));

    if (sourceCount > coveredList.length && siteClusterId > 0) {
      coveredList = await fetchSiteClusterSourcesList(siteClusterId, sourceName, score);
    }
    if (coveredList.length === 0) {
      coveredList = [{ name: sourceName, credibility: score }];
    }

    const existingCluster = getClusterBySiteClusterId(siteClusterId);
    if (existingCluster) {
      const prevScore = existingCluster.last_published_score || existingCluster.credibility_score;
      const prevSources = existingCluster.last_published_sources || existingCluster.source_count;

      const updated = updateClusterData(existingCluster.id, {
        title,
        summary,
        credibilityScore: Math.max(score, existingCluster.credibility_score),
        sourceCount: Math.max(sourceCount, existingCluster.source_count, coveredList.length),
        coveredSources: coveredList.length >= existingCluster.coveredSourcesList.length ? coveredList : undefined,
        shortUrl,
        breaking
      });

      if (
        updated.publishedToChannel &&
        updated.channel_message_id &&
        (updated.source_count > prevSources || (updated.credibility_score - prevScore >= 5))
      ) {
        if (onClusterUpgraded) {
          await onClusterUpgraded(updated);
        }
      }
      continue;
    }

    if (isUrlSeen(link)) continue;
    markUrlSeen(link, null, false, null);

    const newCluster = createCluster({
      siteClusterId,
      siteArticleId,
      title,
      summary,
      category,
      credibilityScore: score,
      sourceCount: Math.max(sourceCount, coveredList.length),
      coveredSources: coveredList,
      sourceName,
      sourceColor,
      sourceInitials,
      shortUrl,
      breaking
    });

    processed++;

    if (breaking) {
      await handleBreakingOrAdItem(newCluster, { isAdSuspect: false, adReason: null }, onNewDraftCreated);
    }
  }

  return processed;
}

async function fetchManualBotSource(source, { onNewDraftCreated, onClusterUpgraded }) {
  const rawItems = [];

  if (source.type === 'TELEGRAM') {
    const html = await fetchTelegramChannelHtml(source.url_or_handle, 8000);
    if (!html) return 0;

    const $ = cheerio.load(html);
    $('.tgme_widget_message').slice(-15).each((_, el) => {
      const msgEl = $(el);
      const textEl = msgEl.find('.tgme_widget_message_text').first();
      const dateLink = msgEl.find('a.tgme_widget_message_date').attr('href');
      if (!textEl.length || !dateLink) return;

      const isSponsored = msgEl.find('.tgme_widget_message_sponsored').length > 0;
      const externalLinks = [];
      textEl.find('a[href]').each((__, a) => {
        const h = $(a).attr('href');
        if (h) externalLinks.push(h);
      });

      textEl.find('br').replaceWith('\n');
      const fullText = textEl.text().trim();
      if (!fullText || fullText.length < 12) return;

      const lines = fullText
        .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')
        .replace(/https?:\/\/\S+/g, '')
        .replace(/#\S+/g, '')
        .split('\n')
        .map(l => l.replace(/^[📌🔴⚪️⚡️🔻🔥▪️▫️🔹🔸◀️▶️🚨📢✅❌⚠️👇👈\s]+/u, '').trim())
        .filter(l => l.length > 2 && !/^@[a-zA-Z0-9_]+$/.test(l) && !/^(کانال|عضویت|لینک|تبلیغات)/i.test(l));

      if (!lines.length) return;
      const headline = lines[0].length > 110 ? lines[0].slice(0, 107).toWellFormed() + '…' : lines[0];
      const summary = lines.slice(1, 3).join(' ').slice(0, 240).toWellFormed();

      rawItems.push({
        url: dateLink,
        title: headline,
        summary,
        categories: [],
        fullText,
        externalLinks,
        isSponsored
      });
    });
  } else if (source.type === 'RSS') {
    const res = await fetch(source.url_or_handle, {
      headers: { 'User-Agent': 'Mozilla/5.0 Chrome/125.0.0.0' },
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) return 0;
    const xml = await res.text();
    const parsed = xmlParser.parse(xml);
    const entries = parsed?.rss?.channel?.item || parsed?.feed?.entry || [];
    const list = Array.isArray(entries) ? entries : [entries];

    for (const entry of list.slice(0, 15)) {
      const title = String(entry.title?.['#text'] || entry.title || '').trim();
      const link = String(entry.link?.['@_href'] || entry.link || entry.guid || '').trim();
      const descHtml = String(entry.description || entry.summary || '');
      const summary = cheerio.load(descHtml).text().replace(/\s+/g, ' ').trim().slice(0, 240).toWellFormed();
      const cats = Array.isArray(entry.category) ? entry.category : (entry.category ? [entry.category] : []);
      if (title && link) {
        rawItems.push({ url: link, title, summary, categories: cats, fullText: `${title} ${summary}`, externalLinks: [], isSponsored: false });
      }
    }
  } else if (source.type === 'WEB') {
    const res = await fetch(source.url_or_handle, {
      headers: { 'User-Agent': 'Mozilla/5.0 Chrome/125.0.0.0' },
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) return 0;
    const html = await res.text();
    const $ = cheerio.load(html);

    $('article h2 a, article h3 a, .entry-title a, .post-title a, h2 a[href], h3 a[href]').slice(0, 15).each((_, a) => {
      const title = $(a).text().replace(/\s+/g, ' ').trim();
      const href = $(a).attr('href');
      if (!title || title.length < 15 || !href) return;
      const absUrl = new URL(href, source.url_or_handle).toString();
      const parent = $(a).closest('article, .post, .item');
      const summary = parent.find('p, .excerpt, .entry-summary').first().text().replace(/\s+/g, ' ').trim().slice(0, 240).toWellFormed();
      rawItems.push({ url: absUrl, title, summary, categories: [], fullText: `${title} ${summary}`, externalLinks: [], isSponsored: false });
    });
  }

  let savedCount = 0;
  for (const raw of rawItems) {
    if (isUrlSeen(raw.url)) continue;

    const adCheck = detectAdvertisement(
      raw.fullText || raw.title,
      source.type === 'TELEGRAM' ? source.url_or_handle : '',
      raw.externalLinks,
      raw.isSponsored
    );

    markUrlSeen(raw.url, source.id, adCheck.isAd, adCheck.reason);

    const category = classifyCategory(raw.categories || [], source.category || 'سیاسی');
    const isBreaking = detectBreakingNews(raw.title, raw.categories || []);

    const displaySrcLabel = source.type === 'TELEGRAM'
      ? `${source.name} (@${source.url_or_handle.replace(/^@/, '')})`
      : source.name;
    const displayInitials = source.type === 'TELEGRAM'
      ? `@${source.url_or_handle.replace(/^@/, '')}`
      : source.initials;
    const displayColor = source.type === 'TELEGRAM' ? '#2AABEE' : source.color;

    if (adCheck.isAd) {
      const isFullAuto = getBooleanSetting('breaking_auto_publish', false);
      const eligibleAdAdmins = getEligibleAdminsForDraft({ isBreaking: false, isAdSuspect: true, category });
      if (!isFullAuto && eligibleAdAdmins.length > 0 && onNewDraftCreated) {
        const draft = createDraft({
          clusterId: null,
          title: raw.title,
          summary: raw.summary,
          category,
          credibilityScore: source.credibility,
          sourceCount: 1,
          coveredSources: [{ name: displaySrcLabel, credibility: source.credibility }],
          sourceName: displaySrcLabel,
          sourceColor: displayColor,
          sourceInitials: displayInitials,
          shortUrl: null,
          breaking: false,
          isAdSuspect: true,
          adReason: adCheck.reason
        });
        await onNewDraftCreated(draft);
      }
      continue;
    }

    const newTokens = tokenizeTitle(raw.title);
    const recentClusters = getRecentClusters(24);
    let bestCluster = null;
    let bestSim = 0;

    for (const c of recentClusters) {
      const cTokens = tokenizeTitle(c.representative_title);
      const sim = jaccardSimilarity(newTokens, cTokens);
      let shared = 0;
      for (const t of newTokens) {
        if (t.length >= 4 && cTokens.has(t)) shared++;
      }
      if ((sim > bestSim && sim >= SIMILARITY_THRESHOLD) || shared >= 3) {
        bestSim = Math.max(sim, 0.25);
        bestCluster = c;
      }
    }

    if (bestCluster) {
      const covered = Array.isArray(bestCluster.coveredSourcesList) ? [...bestCluster.coveredSourcesList] : [];
      if (!covered.some(s => s.name === displaySrcLabel || s.name === source.name)) {
        covered.push({ name: displaySrcLabel, credibility: source.credibility });
      }
      const newSourceCount = Math.max(bestCluster.source_count, covered.length);
      const newCredibility = calculateBayesianClusterScore(covered);

      const prevSources = bestCluster.last_published_sources || bestCluster.source_count;
      const updated = updateClusterData(bestCluster.id, {
        credibilityScore: newCredibility,
        sourceCount: newSourceCount,
        coveredSources: covered,
        breaking: bestCluster.breaking || isBreaking
      });

      if (updated.publishedToChannel && updated.channel_message_id && updated.source_count > prevSources && onClusterUpgraded) {
        await onClusterUpgraded(updated);
      }
    } else {
      let matchedSiteArt = await findMatchingSiteArticleByKeywords(raw.title, newTokens);
      let shortUrl = null;
      let siteClusterId = null;
      let siteArticleId = null;
      let coveredList = [{ name: displaySrcLabel, credibility: source.credibility }];
      let finalCred = source.credibility;

      if (matchedSiteArt && matchedSiteArt.id) {
        siteArticleId = matchedSiteArt.id;
        siteClusterId = matchedSiteArt.cluster?.id || matchedSiteArt.id;
        shortUrl = `${CONFIG.dutaSiteUrl}/c/${matchedSiteArt.id}`;
        const siteSources = await fetchSiteClusterSourcesList(siteClusterId, matchedSiteArt.source?.name || 'Duta', matchedSiteArt.cluster?.credibilityScore || 85);
        for (const ss of siteSources) {
          if (!coveredList.some(c => c.name === ss.name)) coveredList.unshift(ss);
        }
        finalCred = calculateBayesianClusterScore(coveredList);
      }

      const created = createCluster({
        siteClusterId,
        siteArticleId,
        title: raw.title,
        summary: raw.summary,
        category,
        credibilityScore: finalCred,
        sourceCount: coveredList.length,
        coveredSources: coveredList,
        sourceName: displaySrcLabel,
        sourceColor: displayColor,
        sourceInitials: displayInitials,
        shortUrl,
        breaking: isBreaking
      });
      savedCount++;

      if (isBreaking) {
        await handleBreakingOrAdItem(created, { isAdSuspect: false, adReason: null }, onNewDraftCreated);
      }
    }
  }

  touchSourceFetched(source.id);
  return savedCount;
}

async function handleBreakingOrAdItem(cluster, { isAdSuspect = false, adReason = null }, onNewDraftCreated) {
  const isBreakingAuto = getBooleanSetting('breaking_auto_publish', false);
  if (isBreakingAuto && !isAdSuspect) {
    if (onNewDraftCreated) {
      await onNewDraftCreated(null, cluster);
    }
    return;
  }

  const draft = createDraft({
    clusterId: cluster.id,
    title: cluster.representative_title,
    summary: cluster.summary,
    category: cluster.category,
    credibilityScore: cluster.credibility_score,
    sourceCount: cluster.source_count,
    coveredSources: cluster.coveredSourcesList,
    sourceName: cluster.source_name,
    sourceColor: cluster.source_color,
    sourceInitials: cluster.source_initials,
    shortUrl: cluster.short_url,
    breaking: cluster.breaking,
    isAdSuspect,
    adReason
  });

  if (onNewDraftCreated) {
    await onNewDraftCreated(draft, null);
  }
}

export async function runIngestionCycle(callbacks = {}) {
  let totalNew = 0;
  try {
    totalNew += await fetchDutaSiteRss(callbacks);
  } catch (err) {
    console.warn('[Ingestion] Duta RSS fetch warning:', err.message);
  }

  const manualSources = getAllSources(true);
  for (const src of manualSources) {
    try {
      totalNew += await fetchManualBotSource(src, callbacks);
    } catch (err) {
      console.warn(`[Ingestion] Source ${src.name} warning:`, err.message);
    }
  }

  return totalNew;
}

export async function syncChannelPostMetrics() {
  try {
    const html = await fetchTelegramChannelHtml(CONFIG.channelHandle, 6000);
    if (!html) return;

    const $ = cheerio.load(html);
    $('.tgme_widget_message').each((_, el) => {
      const msgEl = $(el);
      const dataPost = msgEl.attr('data-post') || '';
      const msgId = Number(dataPost.split('/')[1] || 0);
      if (!msgId) return;

      const viewsRaw = msgEl.find('.tgme_widget_message_views').text().trim();
      let views = 0;
      if (viewsRaw.toLowerCase().endsWith('k')) {
        views = Math.round(parseFloat(viewsRaw) * 1000);
      } else if (viewsRaw.toLowerCase().endsWith('m')) {
        views = Math.round(parseFloat(viewsRaw) * 1000000);
      } else {
        views = parseInt(viewsRaw.replace(/[^0-9]/g, ''), 10) || 0;
      }

      let reactions = 0;
      msgEl.find('.tgme_reaction').each((__, rEl) => {
        const countText = $(rEl).text().replace(/[^0-9.kmKM]/g, '').trim();
        if (countText.toLowerCase().endsWith('k')) {
          reactions += Math.round(parseFloat(countText) * 1000);
        } else {
          reactions += parseInt(countText, 10) || 1;
        }
      });

      if (views > 0 || reactions > 0) {
        updateClusterTelegramMetrics(msgId, { views, reactions });
      }
    });
  } catch {}
}
