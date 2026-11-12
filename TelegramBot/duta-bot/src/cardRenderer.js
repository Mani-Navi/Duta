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

    const width = 920;
    const breakingBarHeight = isBreaking ? 62 : 0;
    const extraTitleHeight = Math.max(0, titleLines.length - 2) * 58;
    const cardHeight = 385 + breakingBarHeight + extraTitleHeight;
    const height = cardHeight + 48;

    const cardX = 24;
    const cardY = 24;
    const cardW = width - 48;
    const cardBorder = isBreaking ? 'rgba(244, 33, 46, 0.45)' : 'rgba(15, 20, 25, 0.10)';
    const bodyTop = cardY + breakingBarHeight;

    const dividerY = cardY + cardHeight - 88;
    const footerY = cardY + cardHeight - 36;

    const svg = `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="cardRoundClip">
      <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardHeight}" rx="30" ry="30"/>
    </clipPath>
  </defs>

  <rect width="${width}" height="${height}" fill="#F7F9F9"/>

  <g clip-path="url(#cardRoundClip)">
    <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardHeight}" rx="30" ry="30" fill="#FFFFFF"/>

    ${isBreaking ? `
    <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${breakingBarHeight}" fill="#F4212E"/>
    <circle cx="${cardX + cardW - 42}" cy="${cardY + 31}" r="6.5" fill="#FFFFFF" fill-opacity="0.9"/>
    <text x="${cardX + cardW - 64}" y="${cardY + 40}" font-family="Vazirmatn" font-size="23" font-weight="700" fill="#FFFFFF" text-anchor="end" direction="rtl">
      خبر فوری
    </text>
    ` : ''}
  </g>

  <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardHeight}" rx="30" ry="30" fill="none" stroke="${cardBorder}" stroke-width="2"/>

  <!-- 1. Blue Signal Line -->
  <text x="${cardX + cardW - 36}" y="${bodyTop + 50}" font-family="Vazirmatn" font-size="22" font-weight="700" fill="#007AFF" text-anchor="end" direction="rtl">
    منبع دنبال‌شده · ${escapeSvg(sourceName)}
  </text>

  <!-- 2. Card Header Row -->
  <rect x="${cardX + cardW - 90}" y="${bodyTop + 72}" width="54" height="54" rx="14" fill="${escapeSvg(sourceColor)}"/>
  <text x="${cardX + cardW - 63}" y="${bodyTop + 106}" font-family="Vazirmatn" font-size="19" font-weight="700" fill="#FFFFFF" text-anchor="middle">
    ${escapeSvg(sourceInitials)}
  </text>

  <text x="${cardX + cardW - 108}" y="${bodyTop + 109}" font-family="Vazirmatn" font-size="26" font-weight="700" fill="#0F1419" text-anchor="end" direction="rtl">
    ${escapeSvg(sourceName)}
  </text>

  <g transform="translate(${cardX + 36}, ${bodyTop + 76})">
    <circle cx="10" cy="23" r="3.2" fill="#6E767D"/>
    <circle cx="22" cy="23" r="3.2" fill="#6E767D"/>
    <circle cx="34" cy="23" r="3.2" fill="#6E767D"/>

    <rect x="54" y="2" width="92" height="42" rx="21" fill="${badgeTheme.bg}"/>
    <text x="100" y="30" font-family="Vazirmatn" font-size="22" font-weight="700" fill="${badgeTheme.text}" text-anchor="middle">
      ${score}%
    </text>

    ${sourceCount > 1 ? `
    <rect x="158" y="2" width="108" height="42" rx="21" fill="#EFF3F4"/>
    <text x="212" y="29" font-family="Vazirmatn" font-size="19" font-weight="700" fill="#536471" text-anchor="middle" direction="rtl">
      ${sourceCount} منبع
    </text>
    ` : ''}
  </g>

  <!-- 3. Card Headline Title -->
  <g transform="translate(0, ${bodyTop + 190})">
    ${titleLines.map((line, idx) => `
      <text x="${cardX + cardW - 36}" y="${idx * 58}" font-family="Vazirmatn" font-size="33" font-weight="700" fill="#0F1419" text-anchor="end" direction="rtl">
        ${escapeSvg(line)}
      </text>
    `).join('')}
  </g>

  <!-- 4. Divider -->
  <line x1="${cardX + 34}" y1="${dividerY}" x2="${cardX + cardW - 34}" y2="${dividerY}" stroke="#E5E9EC" stroke-width="1.6"/>

  <!-- 5. Footer -->
  <text x="${cardX + cardW - 36}" y="${footerY}" font-family="Vazirmatn" font-size="22" font-weight="400" fill="#6E767D" text-anchor="end" direction="rtl">
    ${escapeSvg(timeText)}
  </text>

  <g transform="translate(${cardX + 36}, ${footerY - 25})">
    <text x="0" y="24" font-family="Vazirmatn" font-size="22" font-weight="700" fill="#536471" text-anchor="start">
      ${doubt}
    </text>
    <g transform="translate(${String(doubt).length * 14 + 10}, 2) scale(1.2)" fill="none" stroke="#6E767D" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </g>

    <g transform="translate(110, 0)">
      <text x="0" y="24" font-family="Vazirmatn" font-size="22" font-weight="700" fill="#536471" text-anchor="start">
        ${hot}
      </text>
      <g transform="translate(${String(hot).length * 14 + 10}, 2) scale(1.2)" fill="none" stroke="#6E767D" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
        <polyline points="17 6 23 6 23 12"/>
      </g>
    </g>

    <g transform="translate(235, 0)">
      <text x="0" y="24" font-family="Vazirmatn" font-size="22" font-weight="700" fill="#536471" text-anchor="start">
        ${like}
      </text>
      <g transform="translate(${String(like).length * 14 + 10}, 1) scale(1.18)" fill="none" stroke="#6E767D" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
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
    // Ultra-fast 4:4:4 JPEG (~28KB instead of 250KB PNG) prevents upload timeouts through Cloudflare!
    return sharp(rawPng)
        .jpeg({ quality: 93, chromaSubsampling: '4:4:4', mozjpeg: true })
        .toBuffer();
}