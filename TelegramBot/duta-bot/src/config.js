import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const CONFIG = {
    botToken: (process.env.BOT_TOKEN || '').trim(),
    superAdminId: Number(process.env.SUPER_ADMIN_ID || 0),
    channelId: (process.env.CHANNEL_ID || '@Duta_News').trim(),
    channelHandle: (process.env.CHANNEL_HANDLE || 'Duta_News').replace('@', '').trim(),

    // Cloudflare Worker Bridge or direct Telegram API root
    telegramApiRoot: (process.env.TELEGRAM_API_ROOT || 'https://api.telegram.org').replace(/\/+$/, ''),
    bridgeSecret: (process.env.BRIDGE_SECRET || '').trim(),

    // Duta Main Platform URLs
    dutaBackendUrl: (process.env.DUTA_BACKEND_URL || 'https://duta.ir').replace(/\/+$/, ''),
    dutaSiteUrl: (process.env.DUTA_SITE_URL || 'https://duta.ir').replace(/\/+$/, ''),

    // Timers
    fetchIntervalMs: Number(process.env.FETCH_INTERVAL_SEC || 180) * 1000,
    autoPublishIntervalMs: Number(process.env.AUTO_PUBLISH_INTERVAL_SEC || 420) * 1000,
    tabloUpdateIntervalMs: Number(process.env.TABLO_UPDATE_INTERVAL_SEC || 600) * 1000,

    // Paths
    rootDir: path.resolve(__dirname, '..'),
    dataDir: path.resolve(__dirname, '../data'),
    dbPath: path.resolve(__dirname, '../data/duta-bot.db')
};

export const CATEGORIES_META = {
    'اقتصادی': {
        emoji: '💰',
        tag: '#اقتصادی',
        defaultHashtags: ['#اقتصادی', '#بازار', '#تورم', '#فکت_چک'],
        color: '#10B981'
    },
    'سیاسی': {
        emoji: '🏛',
        tag: '#سیاسی',
        defaultHashtags: ['#سیاسی', '#ایران', '#دیپلماسی', '#فکت_چک'],
        color: '#3B82F6'
    },
    'تکنولوژی': {
        emoji: '💻',
        tag: '#تکنولوژی',
        defaultHashtags: ['#تکنولوژی', '#فناوری', '#هوش_مصنوعی', '#فکت_چک'],
        color: '#6366F1'
    },
    'آموزشی': {
        emoji: '🎓',
        tag: '#آموزشی',
        defaultHashtags: ['#آموزشی', '#کنکور', '#دانشگاه', '#فکت_چک'],
        color: '#8B5CF6'
    },
    'رمزارز': {
        emoji: '🪙',
        tag: '#رمزارز',
        defaultHashtags: ['#رمزارز', '#بیت_کوین', '#ارز_دیجیتال', '#فکت_چک'],
        color: '#F59E0B'
    },
    'اجتماعی': {
        emoji: '👥',
        tag: '#اجتماعی',
        defaultHashtags: ['#اجتماعی', '#حوادث', '#جامعه', '#فکت_چک'],
        color: '#EC4899'
    },
    'خودرو': {
        emoji: '🚗',
        tag: '#خودرو',
        defaultHashtags: ['#خودرو', '#قیمت_خودرو', '#ایران_خودرو', '#فکت_چک'],
        color: '#0EA5E9'
    },
    'ورزشی': {
        emoji: '⚽️',
        tag: '#ورزشی',
        defaultHashtags: ['#ورزشی', '#فوتبال', '#لیگ_برتر', '#فکت_چک'],
        color: '#22C55E'
    },
    'جهانی': {
        emoji: '🌍',
        tag: '#جهانی',
        defaultHashtags: ['#جهانی', '#بین_الملل', '#اخبار_جهان', '#فکت_چک'],
        color: '#14B8A6'
    },
    'سلامت': {
        emoji: '🩺',
        tag: '#سلامت',
        defaultHashtags: ['#سلامت', '#پزشکی', '#بهداشت', '#فکت_چک'],
        color: '#06B6D4'
    },
    'سرگرمی': {
        emoji: '🎬',
        tag: '#سرگرمی',
        defaultHashtags: ['#سرگرمی', '#سینما', '#فرهنگ', '#فکت_چک'],
        color: '#F97316'
    },
    'فرهنگ و هنر': {
        emoji: '🎨',
        tag: '#فرهنگ_و_هنر',
        defaultHashtags: ['#فرهنگ_و_هنر', '#موسیقی', '#کتاب', '#فکت_چک'],
        color: '#A855F7'
    }
};

export const ALL_CATEGORIES = Object.keys(CATEGORIES_META);