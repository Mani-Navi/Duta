import fs from 'fs';
import path from 'path';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { CONFIG } from './config.js';

const FONTS_DIR = path.join(CONFIG.dataDir, 'fonts');
const REGULAR_FONT_PATH = path.join(FONTS_DIR, 'Vazirmatn-Regular.ttf');
const BOLD_FONT_PATH = path.join(FONTS_DIR, 'Vazirmatn-Bold.ttf');

const FONT_URLS = {
    regular: 'https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/fonts/ttf/Vazirmatn-Regular.ttf',
    bold: 'https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/fonts/ttf/Vazirmatn-Bold.ttf'
};

let fontsReadyPromise = null;

export async function ensureFontsLoaded() {
    if (fontsReadyPromise) return fontsReadyPromise;

    fontsReadyPromise = (async () => {
        if (!fs.existsSync(FONTS_DIR)) {
            fs.mkdirSync(FONTS_DIR, { recursive: true });
        }

        if (!fs.existsSync(REGULAR_FONT_PATH)) {
            const res = await fetch(FONT_URLS.regular, { signal: AbortSignal.timeout(12000) });
            if (res.ok) {
                fs.writeFileSync(REGULAR_FONT_PATH, Buffer.from(await res.arrayBuffer()));
            }
        }

        if (!fs.existsSync(BOLD_FONT_PATH)) {
            const res = await fetch(FONT_URLS.bold, { signal: AbortSignal.timeout(12000) });
            if (res.ok) {
                fs.writeFileSync(BOLD_FONT_PATH, Buffer.from(await res.arrayBuffer()));
            }
        }
    })().catch(err => {
        console.warn('[CardRenderer] Font load warning:', err.message);
    });

    return fontsReadyPromise;
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

/**
 * Deterministic reaction numbers matching src/utils/articleHelpers.js on duta.ir
 */
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
    const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
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
    if (s >= 80) {
        return { bg: '#E3F8F0', text: '#047857' };
    }
    if (s >= 50) {
        return { bg: '#FEF3C7', text: '#B45309' };
    }
    return { bg: '#FFE4E6', text: '#BE123C' };
}

/**
 * Renders the exact Light-Mode NewsCard from https://duta.ir (matching user screenshot 1:1).
 */
export async function renderNewsCardPng(item) {
    await ensureFontsLoaded();

    const isBreaking = Boolean(item.breaking);
    const score = Math.min(100, Math.max(0, Number(item.credibilityScore ?? 85)));
    const sourceCount = Math.max(1, Number(item.sourceCount ?? 1));
    const sourceName = item.sourceName || 'زومیت';
    const sourceColor = item.sourceColor || '#B48327';
    const sourceInitials = (item.sourceInitials || sourceName.slice(0, 2)).toUpperCase().slice(0, 3);
    const badgeTheme = getBadgeTheme(score);

    const titleLines = wrapTextLines(item.title, 37, 3);
    const { like, hot, doubt } = computeSeededReactions(item.title, score, sourceCount, isBreaking);

    const timeText = item.timeLabel || `${12 + (like % 35)} دقیقه پیش`;

    const width = 960;
    const breakingBarHeight = isBreaking ? 64 : 0;
    const extraTitleHeight = Math.max(0, titleLines.length - 2) * 60;
    const cardHeight = 400 + breakingBarHeight + extraTitleHeight;
    const height = cardHeight + 56;

    const cardX = 28;
    const cardY = 28;
    const cardW = width - 56;
    const cardBorder = isBreaking ? 'rgba(244, 33, 46, 0.45)' : 'rgba(15, 20, 25, 0.10)';
    const bodyTop = cardY + breakingBarHeight;

    const dividerY = cardY + cardHeight - 92;
    const footerY = cardY + cardHeight - 40;

    const svg = `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="cardRoundClip">
      <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardHeight}" rx="32" ry="32"/>
    </clipPath>
  </defs>

  <!-- Outer Page Canvas (#F7F9F9 exact match with duta.ir) -->
  <rect width="${width}" height="${height}" fill="#F7F9F9"/>

  <!-- White NewsCard Container -->
  <g clip-path="url(#cardRoundClip)">
    <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardHeight}" rx="32" ry="32" fill="#FFFFFF"/>

    ${isBreaking ? `
    <!-- Red Breaking Strip at Top of Card -->
    <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${breakingBarHeight}" fill="#F4212E"/>
    <circle cx="${cardX + cardW - 44}" cy="${cardY + 32}" r="6.5" fill="#FFFFFF" fill-opacity="0.9"/>
    <text x="${cardX + cardW - 66}" y="${cardY + 41}" font-family="Vazirmatn" font-size="24" font-weight="700" fill="#FFFFFF" text-anchor="end" direction="rtl">
      خبر فوری
    </text>
    ` : ''}
  </g>

  <!-- Card Border -->
  <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardHeight}" rx="32" ry="32" fill="none" stroke="${cardBorder}" stroke-width="2"/>

  <!-- 1. Blue Signal Line (منبع دنبال‌شده · نام منبع) -->
  <text x="${cardX + cardW - 38}" y="${bodyTop + 52}" font-family="Vazirmatn" font-size="23" font-weight="700" fill="#007AFF" text-anchor="end" direction="rtl">
    منبع دنبال‌شده · ${escapeSvg(sourceName)}
  </text>

  <!-- 2. Card Header Row: Source Avatar & Name (Right) + Score Pill & Dots (Left) -->
  <!-- Right: Colored Source Initials Box -->
  <rect x="${cardX + cardW - 94}" y="${bodyTop + 76}" width="56" height="56" rx="14" fill="${escapeSvg(sourceColor)}"/>
  <text x="${cardX + cardW - 66}" y="${bodyTop + 111}" font-family="Vazirmatn" font-size="20" font-weight="700" fill="#FFFFFF" text-anchor="middle">
    ${escapeSvg(sourceInitials)}
  </text>

  <!-- Source Name next to Avatar -->
  <text x="${cardX + cardW - 112}" y="${bodyTop + 114}" font-family="Vazirmatn" font-size="27" font-weight="700" fill="#0F1419" text-anchor="end" direction="rtl">
    ${escapeSvg(sourceName)}
  </text>

  <!-- Left: Three Dots (...) + Score Badge (95%) + Optional Multi-Source Pill -->
  <g transform="translate(${cardX + 38}, ${bodyTop + 80})">
    <!-- Three Dots Icon -->
    <circle cx="10" cy="24" r="3.2" fill="#6E767D"/>
    <circle cx="22" cy="24" r="3.2" fill="#6E767D"/>
    <circle cx="34" cy="24" r="3.2" fill="#6E767D"/>

    <!-- Score Badge Pill (e.g. 95%) -->
    <rect x="56" y="2" width="96" height="44" rx="22" fill="${badgeTheme.bg}"/>
    <text x="104" y="32" font-family="Vazirmatn" font-size="23" font-weight="700" fill="${badgeTheme.text}" text-anchor="middle">
      ${score}%
    </text>

    ${sourceCount > 1 ? `
    <!-- Multi-source Badge Pill -->
    <rect x="164" y="2" width="112" height="44" rx="22" fill="#EFF3F4"/>
    <text x="220" y="31" font-family="Vazirmatn" font-size="20" font-weight="700" fill="#536471" text-anchor="middle" direction="rtl">
      ${sourceCount} منبع
    </text>
    ` : ''}
  </g>

  <!-- 3. Card Headline Title (Bold Black #0F1419, RTL) -->
  <g transform="translate(0, ${bodyTop + 196})">
    ${titleLines.map((line, idx) => `
      <text x="${cardX + cardW - 38}" y="${idx * 62}" font-family="Vazirmatn" font-size="35" font-weight="700" fill="#0F1419" text-anchor="end" direction="rtl">
        ${escapeSvg(line)}
      </text>
    `).join('')}
  </g>

  <!-- 4. Horizontal Divider Line -->
  <line x1="${cardX + 36}" y1="${dividerY}" x2="${cardX + cardW - 36}" y2="${dividerY}" stroke="#E5E9EC" stroke-width="1.8"/>

  <!-- 5. Card Footer Row: Relative Time (Right) + 3 Reaction Icons & Counts (Left) -->
  <!-- Right: Time Label -->
  <text x="${cardX + cardW - 38}" y="${footerY}" font-family="Vazirmatn" font-size="23" font-weight="400" fill="#6E767D" text-anchor="end" direction="rtl">
    ${escapeSvg(timeText)}
  </text>

  <!-- Left: Doubt (?) + Hot (Trending Arrow) + Like (Thumbs Up) -->
  <g transform="translate(${cardX + 38}, ${footerY - 26})">
    <!-- Doubt Icon & Count -->
    <text x="0" y="25" font-family="Vazirmatn" font-size="23" font-weight="700" fill="#536471" text-anchor="start">
      ${doubt}
    </text>
    <g transform="translate(${String(doubt).length * 14 + 10}, 2) scale(1.25)" fill="none" stroke="#6E767D" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </g>

    <!-- Hot (Trending Up) Icon & Count -->
    <g transform="translate(115, 0)">
      <text x="0" y="25" font-family="Vazirmatn" font-size="23" font-weight="700" fill="#536471" text-anchor="start">
        ${hot}
      </text>
      <g transform="translate(${String(hot).length * 14 + 10}, 2) scale(1.25)" fill="none" stroke="#6E767D" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
        <polyline points="17 6 23 6 23 12"/>
      </g>
    </g>

    <!-- Like (Thumbs Up) Icon & Count -->
    <g transform="translate(245, 0)">
      <text x="0" y="25" font-family="Vazirmatn" font-size="23" font-weight="700" fill="#536471" text-anchor="start">
        ${like}
      </text>
      <g transform="translate(${String(like).length * 14 + 10}, 1) scale(1.22)" fill="none" stroke="#6E767D" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
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
            loadSystemFonts: true,
            defaultFontFamily: 'Vazirmatn'
        }
    });

    const rawPng = resvg.render().asPng();
    return sharp(rawPng)
        .png({ quality: 95, compressionLevel: 8 })
        .toBuffer();
}