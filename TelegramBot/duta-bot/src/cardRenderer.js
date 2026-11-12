import fs from 'fs';
import path from 'path';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { CONFIG, CATEGORIES_META } from './config.js';

const FONTS_DIR = path.join(CONFIG.dataDir, 'fonts');
const REGULAR_FONT_PATH = path.join(FONTS_DIR, 'Vazirmatn-Regular.ttf');
const BOLD_FONT_PATH = path.join(FONTS_DIR, 'Vazirmatn-Bold.ttf');

const FONT_URLS = {
    regular: 'https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/fonts/ttf/Vazirmatn-Regular.ttf',
    bold: 'https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/fonts/ttf/Vazirmatn-Bold.ttf'
};

let fontsReadyPromise = null;

/**
 * Ensures Vazirmatn TTF fonts are downloaded and cached locally on disk.
 */
export async function ensureFontsLoaded() {
    if (fontsReadyPromise) return fontsReadyPromise;

    fontsReadyPromise = (async () => {
        if (!fs.existsSync(FONTS_DIR)) {
            fs.mkdirSync(FONTS_DIR, { recursive: true });
        }

        if (!fs.existsSync(REGULAR_FONT_PATH)) {
            const res = await fetch(FONT_URLS.regular);
            if (res.ok) {
                const buf = Buffer.from(await res.arrayBuffer());
                fs.writeFileSync(REGULAR_FONT_PATH, buf);
            }
        }

        if (!fs.existsSync(BOLD_FONT_PATH)) {
            const res = await fetch(FONT_URLS.bold);
            if (res.ok) {
                const buf = Buffer.from(await res.arrayBuffer());
                fs.writeFileSync(BOLD_FONT_PATH, buf);
            }
        }
    })().catch(err => {
        console.warn('[CardRenderer] Font download warning:', err.message);
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

function toPersianDigits(input) {
    const persian = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(input ?? '').replace(/\d/g, d => persian[Number(d)]);
}

/**
 * Wraps Persian text into balanced lines for SVG <text> rendering.
 */
function wrapTextLines(text, maxCharsPerLine = 44, maxLines = 3) {
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

    const consumedWordsCount = lines.join(' ').split(' ').filter(Boolean).length;
    const remainingWords = words.slice(consumedWordsCount).join(' ');
    if (remainingWords) {
        if ( remainingWords.length > maxCharsPerLine ) {
            lines.push(remainingWords.slice(0, maxCharsPerLine - 1).trim() + '…');
        } else {
            lines.push(remainingWords);
        }
    } else if (currentLine && lines.length < maxLines) {
        lines.push(currentLine);
    }

    return lines.slice(0, maxLines);
}

function getCredibilityTheme(score) {
    const s = Number(score || 75);
    if (s >= 80) {
        return {
            label: 'تأیید شده',
            color: '#00BA7C',
            bg: 'rgba(0, 186, 124, 0.16)',
            border: 'rgba(0, 186, 124, 0.40)'
        };
    }
    if (s >= 50) {
        return {
            label: 'در حال بررسی',
            color: '#FFAD1F',
            bg: 'rgba(255, 173, 31, 0.16)',
            border: 'rgba(255, 173, 31, 0.40)'
        };
    }
    return {
        label: 'نامعتبر',
        color: '#F4212E',
        bg: 'rgba(244, 33, 46, 0.16)',
        border: 'rgba(244, 33, 46, 0.40)'
    };
}

/**
 * Generates a high-resolution PNG buffer of the Duta NewsCard matching https://duta.ir UI.
 *
 * @param {Object} item
 * @param {string} item.title
 * @param {string} [item.summary]
 * @param {string} [item.category]
 * @param {number} [item.credibilityScore]
 * @param {number} [item.sourceCount]
 * @param {string} [item.sourceName]
 * @param {string} [item.sourceColor]
 * @param {string} [item.sourceInitials]
 * @param {boolean} [item.breaking]
 * @param {string} [item.timeLabel]
 * @returns {Promise<Buffer>} PNG image buffer
 */
export async function renderNewsCardPng(item) {
    await ensureFontsLoaded();

    const width = 1080;
    const height = 620;

    const isBreaking = Boolean(item.breaking);
    const score = Math.min(100, Math.max(0, Number(item.credibilityScore ?? 78)));
    const sourceCount = Math.max(1, Number(item.sourceCount ?? 1));
    const category = item.category || 'سیاسی';
    const catMeta = CATEGORIES_META[category] || { color: '#1D9BF0' };
    const sourceName = item.sourceName || 'خبرگزاری رسمی';
    const sourceColor = item.sourceColor || catMeta.color || '#007AFF';
    const sourceInitials = (item.sourceInitials || sourceName.slice(0, 2)).toUpperCase().slice(0, 3);
    const credTheme = getCredibilityTheme(score);

    const nowTehran = new Intl.DateTimeFormat('fa-IR', {
        timeZone: 'Asia/Tehran',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(new Date());
    const timeText = item.timeLabel || `ساعت ${nowTehran}`;

    const titleLines = wrapTextLines(item.title, 42, 3);
    const rawSummary = (item.summary && item.summary.trim() !== item.title?.trim()) ? item.summary : '';
    const summaryLines = rawSummary ? wrapTextLines(rawSummary, 58, 2) : [];

    const cardBorderColor = isBreaking ? 'rgba(244, 33, 46, 0.55)' : '#26292E';
    const topOffset = isBreaking ? 58 : 0;

    // Credibility Ring math
    const ringR = 24;
    const ringCirc = 2 * Math.PI * ringR;
    const ringFill = ((score / 100) * ringCirc).toFixed(1);

    const svg = `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#050608"/>
      <stop offset="50%" stop-color="#0A0C10"/>
      <stop offset="100%" stop-color="#050608"/>
    </linearGradient>

    <linearGradient id="cardGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#111318"/>
      <stop offset="100%" stop-color="#0C0D10"/>
    </linearGradient>

    <radialGradient id="glowBlue" cx="85%" cy="15%" r="55%">
      <stop offset="0%" stop-color="${isBreaking ? '#F4212E' : '#1D9BF0'}" stop-opacity="0.14"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>

    <clipPath id="cardClip">
      <rect x="44" y="38" width="992" height="544" rx="28" ry="28"/>
    </clipPath>
  </defs>

  <!-- Outer Canvas Background -->
  <rect width="${width}" height="${height}" fill="url(#bgGrad)"/>
  <rect width="${width}" height="${height}" fill="url(#glowBlue)"/>

  <!-- Main NewsCard Container (Exact Apple/X Dark Card Style) -->
  <g clip-path="url(#cardClip)">
    <rect x="44" y="38" width="992" height="544" rx="28" ry="28" fill="url(#cardGrad)"/>

    ${isBreaking ? `
    <!-- Red Breaking Strip at Top of Card -->
    <rect x="44" y="38" width="992" height="54" fill="#F4212E"/>
    <circle cx="996" cy="65" r="7" fill="#FFFFFF"/>
    <circle cx="996" cy="65" r="13" fill="none" stroke="#FFFFFF" stroke-opacity="0.45" stroke-width="2.5"/>
    <text x="972" y="73" font-family="Vazirmatn" font-size="22" font-weight="700" fill="#FFFFFF" text-anchor="end" direction="rtl">
      خبر فوری · گزارش ویژه دوتا
    </text>
    ` : ''}
  </g>

  <!-- Card Border -->
  <rect x="44" y="38" width="992" height="544" rx="28" ry="28" fill="none" stroke="${cardBorderColor}" stroke-width="2"/>

  <!-- ─── Card Top Row: Source Avatar & Name (Right) + Credibility & Multi-Source (Left) ─── -->
  <g transform="translate(0, ${topOffset})">
    <!-- Source Avatar Box (Right side) -->
    <rect x="938" y="76" width="56" height="56" rx="14" fill="${escapeSvg(sourceColor)}"/>
    <text x="966" y="111" font-family="Vazirmatn" font-size="21" font-weight="700" fill="#FFFFFF" text-anchor="middle">
      ${escapeSvg(sourceInitials)}
    </text>

    <!-- Source Name & Category Pill -->
    <text x="920" y="101" font-family="Vazirmatn" font-size="25" font-weight="700" fill="#E7E9EA" text-anchor="end" direction="rtl">
      ${escapeSvg(sourceName)}
    </text>
    <text x="920" y="129" font-family="Vazirmatn" font-size="18" font-weight="400" fill="#1D9BF0" text-anchor="end" direction="rtl">
      دسته‌بندی: ${escapeSvg(category)} · ${escapeSvg(toPersianDigits(timeText))}
    </text>

    <!-- Left Side: Credibility Ring + Score Badge + Multi-Source Pill -->
    <g transform="translate(86, 72)">
      <!-- Credibility Pill -->
      <rect x="0" y="4" width="230" height="54" rx="27" fill="${credTheme.bg}" stroke="${credTheme.border}" stroke-width="1.5"/>

      <!-- Mini Circular Progress Ring -->
      <g transform="translate(32, 31) rotate(-90)">
        <circle cx="0" cy="0" r="${ringR}" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="4.5"/>
        <circle cx="0" cy="0" r="${ringR}" fill="none" stroke="${credTheme.color}" stroke-width="4.5" stroke-dasharray="${ringFill} ${ringCirc}" stroke-linecap="round"/>
      </g>
      <text x="32" y="37" font-family="Vazirmatn" font-size="15" font-weight="700" fill="${credTheme.color}" text-anchor="middle" direction="rtl">
        ${toPersianDigits(score)}٪
      </text>

      <text x="208" y="28" font-family="Vazirmatn" font-size="14" font-weight="400" fill="#8B98A5" text-anchor="end" direction="rtl">
        ضریب اعتبار دوتا
      </text>
      <text x="208" y="49" font-family="Vazirmatn" font-size="18" font-weight="700" fill="${credTheme.color}" text-anchor="end" direction="rtl">
        ${escapeSvg(credTheme.label)}
      </text>

      <!-- Multi-Source Badge -->
      <rect x="244" y="10" width="150" height="42" rx="21" fill="#16181C" stroke="#26292E" stroke-width="1.5"/>
      <text x="319" y="37" font-family="Vazirmatn" font-size="18" font-weight="700" fill="#E7E9EA" text-anchor="middle" direction="rtl">
        ${toPersianDigits(sourceCount)} منبع مستقل
      </text>
    </g>

    <!-- ─── Headline Title Block (RTL) ─── -->
    <g transform="translate(0, 198)">
      ${titleLines.map((line, idx) => `
        <text x="990" y="${idx * 58}" font-family="Vazirmatn" font-size="36" font-weight="700" fill="#F7F9F9" text-anchor="end" direction="rtl">
          ${escapeSvg(line)}
        </text>
      `).join('')}
    </g>

    <!-- ─── Optional Summary Box (With Blue Right Accent Line like ArticleDetail) ─── -->
    ${summaryLines.length > 0 && !isBreaking ? `
    <g transform="translate(0, ${198 + titleLines.length * 56 + 6})">
      <line x1="988" y1="-22" x2="988" y2="${summaryLines.length * 36 - 8}" stroke="#1D9BF0" stroke-width="4" stroke-linecap="round"/>
      ${summaryLines.map((sLine, sIdx) => `
        <text x="972" y="${sIdx * 36}" font-family="Vazirmatn" font-size="22" font-weight="400" fill="#8B98A5" text-anchor="end" direction="rtl">
          ${escapeSvg(sLine)}
        </text>
      `).join('')}
    </g>
    ` : ''}
  </g>

  <!-- ─── Card Footer Divider ─── -->
  <line x1="84" y1="492" x2="996" y2="492" stroke="#26292E" stroke-width="1.5"/>

  <!-- ─── Card Footer: Duta Eye Brand (Right) + Reaction Pills & Watermark (Left) ─── -->
  <g transform="translate(0, 510)">
    <!-- Duta Eye Logo (Right Side) -->
    <g transform="translate(952, 2) scale(1.3)">
      <path d="M 3 16 C 9 6, 23 6, 29 16" stroke="#1D9BF0" stroke-width="3.2" stroke-linecap="round" fill="none"/>
      <path d="M 3 16 C 9 26, 23 26, 29 16" stroke="#1D9BF0" stroke-width="3.2" stroke-linecap="round" fill="none"/>
      <circle cx="16" cy="16" r="6" fill="${isBreaking ? '#F4212E' : '#68A7B4'}"/>
    </g>

    <text x="940" y="29" font-family="Vazirmatn" font-size="26" font-weight="700" fill="#FFFFFF" text-anchor="end">
      Duta
    </text>
    <line x1="868" y1="10" x2="868" y2="34" stroke="#26292E" stroke-width="2"/>
    <text x="854" y="28" font-family="Vazirmatn" font-size="19" font-weight="700" fill="#8B98A5" text-anchor="end" direction="rtl">
      دو نگاه، یک حقیقت
    </text>

    <!-- Left Side Watermark & Reaction Indicators -->
    <g transform="translate(86, 4)">
      <rect x="0" y="0" width="236" height="38" rx="19" fill="#16181C" stroke="#26292E" stroke-width="1.2"/>
      <text x="118" y="25" font-family="Vazirmatn" font-size="17" font-weight="700" fill="#1D9BF0" text-anchor="middle">
        @Duta_News · duta.ir
      </text>

      <!-- Card Reaction Badges (مفید / مهم / تردید) -->
      <rect x="250" y="0" width="230" height="38" rx="19" fill="rgba(255,255,255,0.03)" stroke="#26292E" stroke-width="1"/>
      <text x="365" y="25" font-family="Vazirmatn" font-size="16" font-weight="400" fill="#8B98A5" text-anchor="middle" direction="rtl">
        مفید  ·  مهم  ·  تردید در اعتبار
      </text>
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
        .png({ quality: 92, compressionLevel: 8 })
        .toBuffer();
}