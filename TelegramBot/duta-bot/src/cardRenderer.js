import fs from 'fs';
import path from 'path';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { CONFIG } from './config.js';
import { cleanHeadlineTitle, cleanSourceDisplayName } from './captionFormatter.js';

const FONTS_DIR = path.join(CONFIG.dataDir, 'fonts');
const REGULAR_FONT_PATH = path.join(FONTS_DIR, 'Vazirmatn-Regular.ttf');
const BOLD_FONT_PATH = path.join(FONTS_DIR, 'Vazirmatn-Bold.ttf');

const FONT_URLS = {
  regular: 'https://raw.githubusercontent.com/rastikerdar/vazirmatn/v33.003/fonts/ttf/Vazirmatn-Regular.ttf',
  bold: 'https://raw.githubusercontent.com/rastikerdar/vazirmatn/v33.003/fonts/ttf/Vazirmatn-Bold.ttf'
};

export function ensureFontsLoadedBackground() {
  (async () => {
    try {
      if (!fs.existsSync(FONTS_DIR)) {
        fs.mkdirSync(FONTS_DIR, { recursive: true });
      }
      if (!fs.existsSync(REGULAR_FONT_PATH)) {
        const res = await fetch(FONT_URLS.regular, { signal: AbortSignal.timeout(8000) });
        if (res.ok) fs.writeFileSync(REGULAR_FONT_PATH, Buffer.from(await res.arrayBuffer()));
      }
      if (!fs.existsSync(BOLD_FONT_PATH)) {
        const res = await fetch(FONT_URLS.bold, { signal: AbortSignal.timeout(8000) });
        if (res.ok) fs.writeFileSync(BOLD_FONT_PATH, Buffer.from(await res.arrayBuffer()));
      }
    } catch {}
  })();
}

function escapeSvg(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toPersianDigits(input) {
  const persian = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(input ?? '').replace(/\d/g, d => persian[Number(d)]);
}

function computeSeededReactions(title = '', score = 85, sourceCount = 1, breaking = false) {
  let seed = 0;
  const str = String(title || 'duta');
  for (let i = 0; i < str.length; i++) {
    seed = ((seed << 5) - seed + str.charCodeAt(i)) | 0;
  }
  let h = Math.imul(Math.abs(seed || 12345) ^ 0x9E3779B9, 0x85EBCA6B) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xC2B2AE35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;

  let like = 68 + (h % 175);
  let hot = 34 + ((h >>> 5) % 115);
  let doubt = score >= 80 ? (4 + ((h >>> 10) % 19)) : (26 + ((h >>> 10) % 64));

  if (breaking) {
    like += 115 + (h % 85);
    hot += 95 + ((h >>> 7) % 75);
  }
  if (sourceCount > 1) {
    like += Math.min(280, (sourceCount - 1) * 46);
    hot += Math.min(210, (sourceCount - 1) * 34);
  }
  return { like, hot, doubt };
}

function wrapTextLines(text, maxCharsPerLine = 38, maxLines = 3) {
  const cleaned = cleanHeadlineTitle(text).replace(/[\p{Extended_Pictographic}\uFE0F\u200D]+/gu, '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return [''];

  const words = cleaned.split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      currentLine = candidate;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
      if (lines.length >= maxLines - 1) {
        break;
      }
    }
  }

  const consumedWords = lines.join(' ').split(' ').filter(Boolean).length;
  const rest = words.slice(consumedWords).join(' ');
  if (rest) {
    lines.push(rest.length > maxCharsPerLine ? rest.slice(0, maxCharsPerLine - 1).trim() + '…' : rest);
  } else if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  return lines.slice(0, maxLines);
}

function getBadgeTheme(score) {
  const s = Number(score || 80);
  if (s >= 80) return { bg: '#E3F8F0', text: '#047857' };
  if (s >= 50) return { bg: '#FEF3C7', text: '#B45309' };
  return { bg: '#FFE4E6', text: '#BE123C' };
}

export async function renderNewsCardPng(item) {
  const isBreaking = Boolean(item.breaking);
  const score = Math.min(100, Math.max(0, Number(item.credibilityScore ?? 85)));
  const sourceCount = Math.max(1, Number(item.sourceCount ?? 1));
  const cleanedSourceFull = cleanSourceDisplayName(item.sourceName || 'زومیت');
  const sourceColor = item.sourceColor || '#B48327';
  const rawInitials = String(item.sourceInitials || cleanedSourceFull.slice(0, 2)).trim();

  const isTelegramCard =
    rawInitials.startsWith('@') ||
    cleanedSourceFull.includes('@') ||
    sourceColor === '#2AABEE';

  let telegramHandle = rawInitials.startsWith('@') ? rawInitials : '';
  const matchHandle = cleanedSourceFull.match(/@([a-zA-Z0-9_]+)/);
  if (matchHandle) {
    telegramHandle = `@${matchHandle[1]}`;
  }
  const displaySourceName = cleanedSourceFull.replace(/\s*[\(|]?\s*@[a-zA-Z0-9_]+\s*\)?/g, '').replace(/[\s|]+$/g, '').trim() || telegramHandle || 'کانال تلگرام';

  const sourceInitials = rawInitials.replace(/^@/, '').toUpperCase().slice(0, 3);
  const badgeTheme = getBadgeTheme(score);

  let effectiveTitle = cleanHeadlineTitle(item.title);
  // If title is very short (e.g. "اظهارات ترامپ درباره کوبا") and summary has the quote, combine them on the card!
  if (effectiveTitle.length < 28 && item.summary) {
    const cleanSum = cleanHeadlineTitle(item.summary);
    if (cleanSum && cleanSum !== effectiveTitle) {
      effectiveTitle = `${effectiveTitle}؛ ${cleanSum}`;
    }
  }

  const titleLines = wrapTextLines(effectiveTitle, 37, 3);
  const { like, hot, doubt } = computeSeededReactions(effectiveTitle, score, sourceCount, isBreaking);
  const minsAgo = toPersianDigits(12 + (like % 35));
  const timeText = item.timeLabel ? toPersianDigits(item.timeLabel) : `\u200F${minsAgo} دقیقه پیش`;
  const multiSourceText = `\u200F${toPersianDigits(sourceCount)} منبع`;

  const width = 840;
  const breakingBarHeight = isBreaking ? 56 : 0;
  const extraTitleHeight = Math.max(0, titleLines.length - 2) * 52;
  const cardHeight = 350 + breakingBarHeight + extraTitleHeight;
  const height = cardHeight + 40;

  const cardX = 20;
  const cardY = 20;
  const cardW = width - 40;
  const cardBorder = isBreaking
    ? 'rgba(244, 33, 46, 0.45)'
    : (isTelegramCard ? 'rgba(42, 171, 238, 0.48)' : 'rgba(15, 20, 25, 0.10)');
  const bodyTop = cardY + breakingBarHeight;

  const dividerY = cardY + cardHeight - 80;
  const footerY = cardY + cardHeight - 32;

  const hasVazir = fs.existsSync(REGULAR_FONT_PATH) || fs.existsSync(BOLD_FONT_PATH);
  const fontFamily = hasVazir ? 'Vazirmatn' : 'DejaVu Sans';

  const topSignalText = isTelegramCard
    ? `\u200Fمنبع تلگرامی · ${telegramHandle || displaySourceName}`
    : `\u200Fمنبع دنبال‌شده · ${displaySourceName}`;
  const topSignalColor = isTelegramCard ? '#2AABEE' : '#007AFF';

  const svg = `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="cardRoundClip">
      <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardHeight}" rx="28" ry="28"/>
    </clipPath>
    <linearGradient id="tgCardTint" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#F0F9FF"/>
      <stop offset="100%" stop-color="#FFFFFF"/>
    </linearGradient>
  </defs>

  <rect width="${width}" height="${height}" fill="#F7F9F9"/>

  <g clip-path="url(#cardRoundClip)">
    <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardHeight}" rx="28" ry="28" fill="${isTelegramCard ? 'url(#tgCardTint)' : '#FFFFFF'}"/>

    ${isBreaking ? `
    <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${breakingBarHeight}" fill="#F4212E"/>
    <circle cx="${cardX + cardW - 38}" cy="${cardY + 28}" r="6" fill="#FFFFFF" fill-opacity="0.9"/>
    <text x="${cardX + cardW - 58}" y="${cardY + 36}" font-family="${fontFamily}" font-size="21" font-weight="700" fill="#FFFFFF" text-anchor="end" direction="rtl">
      خبر فوری
    </text>
    ` : (isTelegramCard ? `
    <rect x="${cardX}" y="${cardY}" width="${cardW}" height="6" fill="#2AABEE"/>
    ` : '')}
  </g>

  <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardHeight}" rx="28" ry="28" fill="none" stroke="${cardBorder}" stroke-width="2.2"/>

  <!-- Top Signal Line -->
  <text x="${cardX + cardW - 32}" y="${bodyTop + 44}" font-family="${fontFamily}" font-size="20" font-weight="700" fill="${topSignalColor}" text-anchor="end" direction="rtl">
    ${escapeSvg(topSignalText)}
  </text>

  <!-- Right Side Avatar: Official Telegram Paper-Plane Icon OR Agency Initials Box -->
  ${isTelegramCard ? `
  <g transform="translate(${cardX + cardW - 82}, ${bodyTop + 64})">
    <rect x="0" y="0" width="50" height="50" rx="25" fill="#2AABEE"/>
    <g transform="translate(9, 10) scale(1.3)" fill="#FFFFFF">
      <path d="M20.665 3.717l-17.73 6.837c-1.21.486-1.203 1.161-.222 1.462l4.552 1.42 10.532-6.645c.498-.303.953-.14.579.192l-8.533 7.701h-.002l.002.001-.314 4.692c.46 0 .663-.211.921-.46l2.211-2.15 4.599 3.397c.848.467 1.457.227 1.668-.785l3.019-14.228c.309-1.239-.473-1.8-1.282-1.434z"/>
    </g>
  </g>
  ` : `
  <rect x="${cardX + cardW - 82}" y="${bodyTop + 64}" width="50" height="50" rx="12" fill="${escapeSvg(sourceColor)}"/>
  <text x="${cardX + cardW - 57}" y="${bodyTop + 96}" font-family="${fontFamily}" font-size="18" font-weight="700" fill="#FFFFFF" text-anchor="middle">
    ${escapeSvg(sourceInitials)}
  </text>
  `}

  <text x="${cardX + cardW - 98}" y="${bodyTop + 96}" font-family="${fontFamily}" font-size="24" font-weight="700" fill="#0F1419" text-anchor="end" direction="rtl">
    ${escapeSvg('\u200F' + displaySourceName)}
  </text>

  <g transform="translate(${cardX + 32}, ${bodyTop + 68})">
    <circle cx="8" cy="21" r="3" fill="#6E767D"/>
    <circle cx="19" cy="21" r="3" fill="#6E767D"/>
    <circle cx="30" cy="21" r="3" fill="#6E767D"/>

    <rect x="48" y="2" width="86" height="38" rx="19" fill="${badgeTheme.bg}"/>
    <text x="91" y="28" font-family="${fontFamily}" font-size="20" font-weight="700" fill="${badgeTheme.text}" text-anchor="middle">
      ${score}%
    </text>

    ${sourceCount > 1 ? `
    <rect x="144" y="2" width="98" height="38" rx="19" fill="#EFF3F4"/>
    <text x="193" y="27" font-family="${fontFamily}" font-size="18" font-weight="700" fill="#536471" text-anchor="middle" direction="rtl">
      ${multiSourceText}
    </text>
    ` : (isTelegramCard ? `
    <rect x="144" y="2" width="138" height="38" rx="19" fill="#E0F2FE"/>
    <text x="213" y="27" font-family="${fontFamily}" font-size="16" font-weight="700" fill="#0284C7" text-anchor="middle">
      ${escapeSvg(telegramHandle || 'تلگرام')}
    </text>
    ` : '')}
  </g>

  <g transform="translate(0, ${bodyTop + 172})">
    ${titleLines.map((line, idx) => `
      <text x="${cardX + cardW - 32}" y="${idx * 52}" font-family="${fontFamily}" font-size="30" font-weight="700" fill="#0F1419" text-anchor="end" direction="rtl">
        ${escapeSvg('\u200F' + line + '\u200F')}
      </text>
    `).join('')}
  </g>

  <line x1="${cardX + 30}" y1="${dividerY}" x2="${cardX + cardW - 30}" y2="${dividerY}" stroke="#E5E9EC" stroke-width="1.5"/>

  <text x="${cardX + cardW - 32}" y="${footerY}" font-family="${fontFamily}" font-size="20" font-weight="400" fill="${isTelegramCard ? '#0284C7' : '#6E767D'}" text-anchor="end" direction="rtl">
    ${escapeSvg(isTelegramCard ? `\u200F${timeText} · کانال تلگرام` : timeText)}
  </text>

  <g transform="translate(${cardX + 32}, ${footerY - 23})">
    <text x="0" y="22" font-family="${fontFamily}" font-size="20" font-weight="700" fill="#536471" text-anchor="start">
      ${doubt}
    </text>
    <g transform="translate(${String(doubt).length * 13 + 8}, 2) scale(1.1)" fill="none" stroke="#6E767D" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </g>

    <g transform="translate(100, 0)">
      <text x="0" y="22" font-family="${fontFamily}" font-size="20" font-weight="700" fill="#536471" text-anchor="start">
        ${hot}
      </text>
      <g transform="translate(${String(hot).length * 13 + 8}, 2) scale(1.1)" fill="none" stroke="#6E767D" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
        <polyline points="17 6 23 6 23 12"/>
      </g>
    </g>

    <g transform="translate(215, 0)">
      <text x="0" y="22" font-family="${fontFamily}" font-size="20" font-weight="700" fill="#536471" text-anchor="start">
        ${like}
      </text>
      <g transform="translate(${String(like).length * 13 + 8}, 1) scale(1.1)" fill="none" stroke="#6E767D" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
      </g>
    </g>
  </g>
</svg>
  `.trim();

  const fontFiles = [];
  if (fs.existsSync(REGULAR_FONT_PATH)) fontFiles.push(REGULAR_FONT_PATH);
  if (fs.existsSync(BOLD_FONT_PATH)) fontFiles.push(BOLD_FONT_PATH);

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    font: {
      fontFiles,
      loadSystemFonts: !hasVazir,
      defaultFontFamily: fontFamily
    }
  });

  const rawPng = resvg.render().asPng();
  return sharp(rawPng)
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}
