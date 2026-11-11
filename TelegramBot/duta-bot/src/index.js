import { CONFIG, ALL_CATEGORIES } from './config.js';
import {
    getSetting,
    setSetting,
    getBooleanSetting,
    verifyAndSyncTelegramUser,
    isSuperAdmin,
    getAdmin,
    getAllAdmins,
    upsertAdmin,
    addPendingAdminByUsername,
    getPendingAdminUsernames,
    removePendingAdminUsername,
    updateAdminPersonalPrefs,
    removeAdmin,
    getEligibleAdminsForDraft,
    getAllSources,
    getSourceById,
    addSource,
    toggleSourceActive,
    deleteSource,
    markClusterPublished,
    getNextUnpublishedAutoCluster,
    updateClusterTelegramMetrics,
    getDraft,
    tryAcquireDraftLock,
    releaseDraftLock,
    updateDraftContent,
    finalizeDraftStatus,
    saveDraftAdminMessage,
    getDraftAdminMessages,
    getBotAnalyticsSummary,
    cleanupOldBotRecords
} from './db.js';
import { ensureFontsLoaded, renderNewsCardPng } from './cardRenderer.js';
import { formatNewsCaption } from './captionFormatter.js';
import { buildLiveTabloMessageText, getTehranDateTimeStrings } from './tabloService.js';
import {
    detectSourceInfoFromInput,
    runIngestionCycle,
    syncChannelPostMetrics
} from './fetcherAndClusterEngine.js';

// ─── Native Zero-Dependency Telegram Bot API Client (Supports Cloudflare Worker Bridge) ───
class TelegramClient {
    constructor(token, apiRoot, bridgeSecret = '') {
        this.baseUrl = `${apiRoot}/bot${token}`;
        this.bridgeSecret = bridgeSecret;
    }

    _headers(extra = {}) {
        const h = { ...extra };
        if (this.bridgeSecret) {
            h['X-Duta-Bridge-Key'] = this.bridgeSecret;
        }
        return h;
    }

    async call(method, payload = {}) {
        const res = await fetch(`${this.baseUrl}/${method}`, {
            method: 'POST',
            headers: this._headers({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(25000)
        });
        const data = await res.json();
        if (!data.ok) {
            throw new Error(data.description || `Telegram API error on ${method}`);
        }
        return data.result;
    }

    async sendPhotoBuffer(chatId, pngBuffer, { caption = '', replyMarkup = null, disableNotification = false } = {}) {
        const form = new FormData();
        form.append('chat_id', String(chatId));
        form.append('photo', new Blob([pngBuffer], { type: 'image/png' }), 'duta-newscard.png');
        if (caption) form.append('caption', caption);
        if (disableNotification) form.append('disable_notification', 'true');
        if (replyMarkup) form.append('reply_markup', JSON.stringify(replyMarkup));

        const res = await fetch(`${this.baseUrl}/sendPhoto`, {
            method: 'POST',
            headers: this._headers(),
            body: form,
            signal: AbortSignal.timeout(30000)
        });
        const data = await res.json();
        if (!data.ok) {
            throw new Error(data.description || 'sendPhoto failed');
        }
        return data.result;
    }

    async editMessagePhotoBuffer(chatId, messageId, pngBuffer, { caption = '', replyMarkup = null } = {}) {
        const form = new FormData();
        form.append('chat_id', String(chatId));
        form.append('message_id', String(messageId));
        form.append(
            'media',
            JSON.stringify({
                type: 'photo',
                media: 'attach://card_photo',
                caption
            })
        );
        form.append('card_photo', new Blob([pngBuffer], { type: 'image/png' }), 'duta-newscard.png');
        if (replyMarkup) {
            form.append('reply_markup', JSON.stringify(replyMarkup));
        }

        const res = await fetch(`${this.baseUrl}/editMessageMedia`, {
            method: 'POST',
            headers: this._headers(),
            body: form,
            signal: AbortSignal.timeout(30000)
        });
        const data = await res.json();
        if (!data.ok) {
            throw new Error(data.description || 'editMessageMedia failed');
        }
        return data.result;
    }
}

const tg = new TelegramClient(CONFIG.botToken, CONFIG.telegramApiRoot, CONFIG.bridgeSecret);

// In-memory wizard sessions per admin user_id
const adminSessions = new Map();

// ─── Smart Silent Night Helper (00:30 to 07:00 Tehran Time) ───
function isSilentNightWindow(isBreaking = false) {
    if (isBreaking) return false;
    if (!getBooleanSetting('silent_night_enabled', true)) return false;

    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Tehran',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
    }).formatToParts(now);

    const hour = Number(parts.find(p => p.type === 'hour')?.value || 12);
    const minute = Number(parts.find(p => p.type === 'minute')?.value || 0);
    const totalMins = hour * 60 + minute;

    return totalMins >= 30 && totalMins <= 7 * 60;
}

function buildChannelReplyMarkup(shortUrl) {
    if (!shortUrl || !getBooleanSetting('inline_url_btn_enabled', true)) {
        return undefined;
    }
    const fullUrl = /^https?:\/\//i.test(shortUrl) ? shortUrl : `https://${shortUrl}`;
    return {
        inline_keyboard: [
            [{ text: '🔍 مشاهده منابع و فکت‌چک در سامانه Duta', url: fullUrl }]
        ]
    };
}

// ─── Publish a Cluster or Draft to @Duta_News Channel ───
async function publishItemToChannel(item) {
    const pngBuffer = await renderNewsCardPng({
        title: item.title || item.representative_title,
        summary: item.summary,
        category: item.category,
        credibilityScore: item.credibilityScore ?? item.credibility_score,
        sourceCount: item.sourceCount ?? item.source_count,
        sourceName: item.sourceName ?? item.source_name,
        sourceColor: item.sourceColor ?? item.source_color,
        sourceInitials: item.sourceInitials ?? item.source_initials,
        breaking: Boolean(item.breaking)
    });

    const caption = formatNewsCaption({
        title: item.title || item.representative_title,
        summary: item.summary,
        category: item.category,
        credibilityScore: item.credibilityScore ?? item.credibility_score,
        sourceCount: item.sourceCount ?? item.source_count,
        shortUrl: item.shortUrl ?? item.short_url,
        breaking: Boolean(item.breaking)
    });

    const replyMarkup = buildChannelReplyMarkup(item.shortUrl ?? item.short_url);
    const disableNotification = isSilentNightWindow(Boolean(item.breaking));

    const sent = await tg.sendPhotoBuffer(CONFIG.channelId, pngBuffer, {
        caption,
        replyMarkup,
        disableNotification
    });

    const clusterId = item.cluster_id || item.id;
    if (clusterId) {
        markClusterPublished(
            clusterId,
            sent.message_id,
            item.credibilityScore ?? item.credibility_score ?? 78,
            item.sourceCount ?? item.source_count ?? 1
        );
    }

    return sent;
}

// ─── Live Fact-Check Upgrade on Existing Channel Post ───
async function upgradePublishedChannelCluster(cluster) {
    if (!cluster?.channel_message_id) return;
    try {
        const pngBuffer = await renderNewsCardPng({
            title: cluster.representative_title,
            summary: cluster.summary,
            category: cluster.category,
            credibilityScore: cluster.credibility_score,
            sourceCount: cluster.source_count,
            sourceName: cluster.source_name,
            sourceColor: cluster.source_color,
            sourceInitials: cluster.source_initials,
            breaking: Boolean(cluster.breaking)
        });

        const caption = formatNewsCaption(
            {
                title: cluster.representative_title,
                summary: cluster.summary,
                category: cluster.category,
                credibilityScore: cluster.credibility_score,
                sourceCount: cluster.source_count,
                shortUrl: cluster.short_url,
                breaking: Boolean(cluster.breaking)
            },
            { isCredibilityUpgraded: true }
        );

        const replyMarkup = buildChannelReplyMarkup(cluster.short_url);
        await tg.editMessagePhotoBuffer(CONFIG.channelId, cluster.channel_message_id, pngBuffer, {
            caption,
            replyMarkup
        });

        markClusterPublished(
            cluster.id,
            cluster.channel_message_id,
            cluster.credibility_score,
            cluster.source_count
        );
    } catch (err) {
        console.warn('[LiveUpgrade] Warning updating channel post:', err.message);
    }
}

// ─── Multi-Admin Draft Keyboard & Broadcast Sync ───
function buildDraftAdminCaption(draft) {
    const baseCaption = formatNewsCaption({
        title: draft.title,
        summary: draft.summary,
        category: draft.category,
        credibilityScore: draft.credibility_score,
        sourceCount: draft.source_count,
        shortUrl: draft.short_url,
        breaking: draft.breaking
    });

    const metaLines = ['───────────────────'];
    if (draft.isAdSuspect) {
        metaLines.push(`⚠️ هشدار سیستم Ad-Guard: مشکوک به تبلیغ (${draft.ad_reason || 'الگوی تبلیغاتی'})`);
    } else {
        metaLines.push(`🚨 پیش‌نویس آماده بررسی ادمین (نسخه ${draft.version})`);
    }
    if (draft.last_edited_by) {
        metaLines.push(`✏️ آخرین ویرایش توسط: ${draft.last_edited_by}`);
    }
    if (draft.locked_by_name && draft.locked_until > Date.now()) {
        metaLines.push(`🔒 در حال ویرایش توسط: ${draft.locked_by_name}`);
    }

    return `${metaLines.join('\n')}\n\n${baseCaption}`;
}

function buildDraftInlineKeyboard(draft) {
    return {
        inline_keyboard: [
            [
                { text: '✅ انتشار در کانال', callback_data: `dr_pub:${draft.id}` },
                { text: '❌ رد و حذف', callback_data: `dr_rej:${draft.id}` }
            ],
            [
                {
                    text: draft.breaking ? '🚨 تگ فوری: روشن 🟢' : '🚨 تگ فوری: خاموش ⚪️',
                    callback_data: `dr_brk:${draft.id}`
                },
                { text: `🏷 دسته: ${draft.category}`, callback_data: `dr_catmenu:${draft.id}` }
            ],
            [
                { text: '✏️ ویرایش تیتر', callback_data: `dr_edtitle:${draft.id}` },
                { text: '📝 ویرایش خلاصه', callback_data: `dr_edsum:${draft.id}` }
            ]
        ]
    };
}

/**
 * Sends a newly created breaking/ad draft to all eligible admins' PVs and records their message_ids.
 */
async function dispatchDraftToAdmins(draft, autoPublishCluster = null) {
    if (autoPublishCluster) {
        await publishItemToChannel(autoPublishCluster);
        return;
    }
    if (!draft) return;

    const eligibleAdmins = getEligibleAdminsForDraft({
        isBreaking: draft.breaking,
        isAdSuspect: draft.isAdSuspect,
        category: draft.category
    });

    if (eligibleAdmins.length === 0) return;

    const pngBuffer = await renderNewsCardPng({
        title: draft.title,
        summary: draft.summary,
        category: draft.category,
        credibilityScore: draft.credibility_score,
        sourceCount: draft.source_count,
        sourceName: draft.source_name,
        sourceColor: draft.source_color,
        sourceInitials: draft.source_initials,
        breaking: draft.breaking
    });

    const caption = buildDraftAdminCaption(draft);
    const replyMarkup = buildDraftInlineKeyboard(draft);

    for (const adm of eligibleAdmins) {
        try {
            const sent = await tg.sendPhotoBuffer(adm.user_id, pngBuffer, {
                caption,
                replyMarkup
            });
            saveDraftAdminMessage(draft.id, adm.user_id, sent.message_id);
        } catch (err) {
            console.warn(`[DraftDispatch] Could not send to admin ${adm.user_id}:`, err.message);
        }
    }
}

/**
 * Broadcasts an updated draft card & caption to ALL admins' PVs simultaneously so no admin sees stale state.
 */
async function broadcastDraftUpdateToAllAdmins(draftId) {
    const draft = getDraft(draftId);
    if (!draft) return;

    const adminMsgs = getDraftAdminMessages(draftId);
    if (!adminMsgs.length) return;

    if (draft.status !== 'PENDING') {
        const statusBadge = draft.status === 'PUBLISHED'
            ? `✅ منتشر شده در ${CONFIG.channelId} توسط «${draft.action_by_name}»`
            : `🗑 رد و حذف شده توسط «${draft.action_by_name}»`;

        const closedCaption = `${statusBadge}\n───────────────────\n📌 ${draft.title}`;

        for (const row of adminMsgs) {
            try {
                await tg.call('editMessageCaption', {
                    chat_id: row.admin_chat_id,
                    message_id: row.message_id,
                    caption: closedCaption,
                    reply_markup: { inline_keyboard: [] }
                });
            } catch {}
        }
        return;
    }

    const pngBuffer = await renderNewsCardPng({
        title: draft.title,
        summary: draft.summary,
        category: draft.category,
        credibilityScore: draft.credibility_score,
        sourceCount: draft.source_count,
        sourceName: draft.source_name,
        sourceColor: draft.source_color,
        sourceInitials: draft.source_initials,
        breaking: draft.breaking
    });

    const caption = buildDraftAdminCaption(draft);
    const replyMarkup = buildDraftInlineKeyboard(draft);

    for (const row of adminMsgs) {
        try {
            await tg.editMessagePhotoBuffer(row.admin_chat_id, row.message_id, pngBuffer, {
                caption,
                replyMarkup
            });
        } catch {}
    }
}

// ─── Main Admin Glass Control Panel ───
function buildMainPanelView(userId) {
    const isSuper = isSuperAdmin(userId);
    const breakingAuto = getBooleanSetting('breaking_auto_publish', false);
    const autoRegular = getBooleanSetting('auto_publish_regular', true);
    const silentNight = getBooleanSetting('silent_night_enabled', true);
    const inlineBtn = getBooleanSetting('inline_url_btn_enabled', true);
    const sourcesCount = getAllSources(false).length;
    const adminsCount = getAllAdmins().length;

    const text = [
        `🎛 <b>پنل مدیریت هوشمند کانال ${CONFIG.channelId}</b>`,
        `🌐 متصل به پلتفرم: <code>${CONFIG.dutaSiteUrl}</code>`,
        ``,
        `• وضعیت اخبار فوری: <b>${breakingAuto ? '⚡️ انتشار ۱۰۰٪ خودکار (بدون تایید)' : '✋ ارسال برای تایید و ویرایش ادمین'}</b>`,
        `• انتشار خودکار اخبار عادی: <b>${autoRegular ? '🟢 روشن' : '🔴 خاموش'}</b>`,
        `• حالت سکوت شبانه (۰۰:۳۰ تا ۰۷:۰۰): <b>${silentNight ? '🔕 فعال' : '🔔 غیرفعال'}</b>`,
        `• منابع اختصاصی ثبت‌شده در بات: <b>${sourcesCount} منبع</b>`,
        ``,
        `💡 <i>نکته سریع: هر زمان لینک یک کانال تلگرام (@id)، فید RSS یا آدرس سایت را مستقیماً در همین چت پیست کنی، بات خودکار آن را شناسایی و اضافه می‌کند!</i>`
    ].join('\n');

    const keyboard = [
        [
            {
                text: breakingAuto
                    ? '🚨 اخبار فوری: ۱۰۰٪ خودکار ⚡️ (تغییر به دستی)'
                    : '🚨 اخبار فوری: تایید ادمین ✋ (تغییر به خودکار)',
                callback_data: 'panel:toggle_breaking_mode'
            }
        ],
        [
            { text: `➕ افزودن منبع جدید`, callback_data: 'panel:add_source_prompt' },
            { text: `📡 مدیریت منابع (${sourcesCount})`, callback_data: 'panel:list_sources' }
        ],
        [
            { text: '📰 انتشار فوری ۱ خبر از صف', callback_data: 'panel:publish_one_now' },
            { text: '🔄 واکشی فوری منابع', callback_data: 'panel:fetch_now' }
        ],
        [
            { text: '📊 ارسال/آپدیت پیام پین تابلو بازار', callback_data: 'panel:sync_tablo' }
        ],
        [
            { text: '📈 گزارش آمار زنده (امروز و هفته)', callback_data: 'panel:analytics' },
            { text: '⚙️ تنظیمات شخصی من', callback_data: 'panel:my_prefs' }
        ],
        [
            {
                text: `🔕 سکوت شبانه: ${silentNight ? 'روشن' : 'خاموش'}`,
                callback_data: 'panel:toggle_silent_night'
            },
            {
                text: `🔗 دکمه شیشه‌ای پست: ${inlineBtn ? 'روشن' : 'خاموش'}`,
                callback_data: 'panel:toggle_inline_btn'
            }
        ]
    ];

    if (isSuper) {
        keyboard.push([
            { text: `👥 مدیریت ادمین‌ها (${adminsCount} نفر)`, callback_data: 'panel:manage_admins' }
        ]);
    }

    return { text, reply_markup: { inline_keyboard: keyboard } };
}

// ─── Personal Admin Settings Menu (Independent per Admin) ───
function buildPersonalPrefsView(userId) {
    const adm = getAdmin(userId);
    const text = [
        `⚙️ <b>تنظیمات شخصی ادمین: ${adm.display_name}</b>`,
        `<i>این تنظیمات فقط روی اکانت شما اعمال می‌شود و تغییری در پنل سایر ادمین‌ها ایجاد نمی‌کند:</i>`,
        ``,
        `• دریافت پیش‌نویس اخبار فوری برای ویرایش: <b>${adm.receiveBreakingDrafts ? '🟢 روشن' : '🔴 خاموش'}</b>`,
        `• دریافت پست‌های مشکوک به تبلیغ جهت بررسی: <b>${adm.receiveAdSuspects ? '🟢 روشن' : '🔴 خاموش (حذف خودکار)'}</b>`,
        `• دریافت گزارش آمار شبانه/هفتگی: <b>${adm.receiveDailyReport ? '🟢 روشن' : '🔴 خاموش'}</b>`,
        `• فیلتر دسته‌بندی‌ها: <b>${adm.allowedCategories.length === 0 ? 'همه ۱۲ دسته‌بندی' : adm.allowedCategories.join('، ')}</b>`
    ].join('\n');

    const keyboard = [
        [
            {
                text: `🚨 دریافت پیش‌نویس خبر فوری: ${adm.receiveBreakingDrafts ? 'روشن 🟢' : 'خاموش 🔴'}`,
                callback_data: 'myprefs:toggle_breaking'
            }
        ],
        [
            {
                text: `🚫 دریافت مشکوک به تبلیغ: ${adm.receiveAdSuspects ? 'روشن 🟢' : 'خاموش 🔴'}`,
                callback_data: 'myprefs:toggle_ads'
            }
        ],
        [
            {
                text: `📊 دریافت گزارش شبانه آمار: ${adm.receiveDailyReport ? 'روشن 🟢' : 'خاموش 🔴'}`,
                callback_data: 'myprefs:toggle_report'
            }
        ],
        [
            { text: '🔙 بازگشت به پنل اصلی', callback_data: 'panel:home' }
        ]
    ];

    return { text, reply_markup: { inline_keyboard: keyboard } };
}

// ─── Analytics Digest Generator (Daily 24h & Weekly 7d) ───
async function buildAnalyticsReportText(hours = 24) {
    await syncChannelPostMetrics();
    const botStats = getBotAnalyticsSummary(hours);

    let siteStats = { totalShortLinkClicks: 0, topArticles24h: [] };
    try {
        const res = await fetch(`${CONFIG.dutaBackendUrl}/api/articles/telegram-stats`, {
            signal: AbortSignal.timeout(5000)
        });
        if (res.ok) siteStats = await res.json();
    } catch {}

    const { dateStr, timeStr } = getTehranDateTimeStrings(new Date());
    const titleLabel = hours > 24 ? 'گزارش تحلیلی هفتگی (۷ روز اخیر)' : 'گزارش عملکرد روزانه (۲۴ ساعت اخیر)';

    const lines = [
        `📊 <b>${titleLabel} — ${CONFIG.channelId}</b>`,
        `📅 ${dateStr} | ساعت ${timeStr}`,
        `━━━━━━━━━━━━━━━`,
        `📡 <b>خلاصه فعالیت و بازخورد کانال:</b>`,
        `• اخبار منتشرشده در کانال: <b>${botStats.publishedCount} خبر</b> (${botStats.breakingCount} فوری)`,
        `• تبلیغات شناسایی و مسدودشده (Ad-Guard): <b>${botStats.adsBlockedCount} مورد 🚫</b>`,
        `• مجموع بازدید پست‌ها در تلگرام: <b>${botStats.totalTelegramViews.toLocaleString('en-US')} بازدید 👁</b>`,
        `• مجموع ری‌اکشن‌های پست‌ها در تلگرام: <b>${botStats.totalTelegramReactions.toLocaleString('en-US')} ری‌اکشن ❤️</b>`,
        `• کل کلیک ورودی به سایت (duta.ir/c): <b>${Number(siteStats.totalShortLinkClicks || 0).toLocaleString('en-US')} کلیک 🔗</b>`,
        `• محبوب‌ترین حوزه خبری: <b>#${botStats.topCategory.replace(/\s+/g, '_')}</b>`
    ];

    if (botStats.mostViewedPost) {
        lines.push(
            ``,
            `🔥 <b>پربازدیدترین پست در کانال تلگرام:</b>`,
            `«${botStats.mostViewedPost.representative_title}»`,
            `👁 ${(botStats.mostViewedPost.telegram_views || 0).toLocaleString('en-US')} بازدید در تلگرام | ❤️ ${botStats.mostViewedPost.telegram_reactions || 0} ری‌اکشن`
        );
    }

    if (botStats.mostReactedPost && botStats.mostReactedPost.telegram_reactions > 0) {
        lines.push(
            ``,
            `💬 <b>بیشترین ری‌اکشن مخاطبان در تلگرام:</b>`,
            `«${botStats.mostReactedPost.representative_title}»`,
            `❤️ ${botStats.mostReactedPost.telegram_reactions} ری‌اکشن در تلگرام | 👁 ${botStats.mostReactedPost.telegram_views || 0} بازدید`
        );
    }

    if (Array.isArray(siteStats.topArticles24h) && siteStats.topArticles24h.length > 0) {
        const topClick = siteStats.topArticles24h[0];
        lines.push(
            ``,
            `🌐 <b>بیشترین ورودی کلیک به سایت (duta.ir/c):</b>`,
            `«${topClick.title}»`,
            `🔗 ${topClick.shortLinkClicks} کلیک مستقیم | 👁 ${topClick.siteViews} بازدید کلستر در سایت`
        );
    }

    lines.push(`━━━━━━━━━━━━━━━`);
    return lines.join('\n');
}

// ─── Sync / Pin Live Market Tablo Message in @Duta_News ───
async function syncOrPinTabloMessage(forceNewPin = false) {
    const text = await buildLiveTabloMessageText();
    const pinnedMsgId = Number(getSetting('tablo_pinned_msg_id', '0'));

    if (!forceNewPin && pinnedMsgId > 0) {
        try {
            await tg.call('editMessageText', {
                chat_id: CONFIG.channelId,
                message_id: pinnedMsgId,
                text
            });
            return { action: 'edited', messageId: pinnedMsgId };
        } catch (err) {
            if (String(err.message).includes('message is not modified')) {
                return { action: 'unchanged', messageId: pinnedMsgId };
            }
        }
    }

    const sent = await tg.call('sendMessage', {
        chat_id: CONFIG.channelId,
        text,
        disable_notification: true
    });

    setSetting('tablo_pinned_msg_id', String(sent.message_id));
    try {
        await tg.call('pinChatMessage', {
            chat_id: CONFIG.channelId,
            message_id: sent.message_id,
            disable_notification: true
        });
    } catch {}

    return { action: 'pinned_new', messageId: sent.message_id };
}

// ─── Handle Incoming Admin Text Messages & Wizards ───
async function handleAdminMessage(msg) {
    const adminUser = verifyAndSyncTelegramUser(msg.from);
    if (!adminUser) {
        await tg.call('sendMessage', {
            chat_id: msg.chat.id,
            text: `🤖 این ربات اختصاصی تحریریه کانال رسمی ${CONFIG.channelId} (${CONFIG.dutaSiteUrl}) است.`
        });
        return;
    }

    const userId = adminUser.user_id;
    const text = (msg.text || '').trim();

    if (text === '/start' || text === '/panel' || text === 'پنل') {
        adminSessions.delete(userId);
        const view = buildMainPanelView(userId);
        await tg.call('sendMessage', {
            chat_id: msg.chat.id,
            text: view.text,
            parse_mode: 'HTML',
            reply_markup: view.reply_markup
        });
        return;
    }

    if (text === '/cancel') {
        const session = adminSessions.get(userId);
        if (session?.draftId) {
            releaseDraftLock(session.draftId, userId);
        }
        adminSessions.delete(userId);
        await tg.call('sendMessage', { chat_id: msg.chat.id, text: '✅ عملیات لغو شد.' });
        return;
    }

    // Check active wizard session
    const session = adminSessions.get(userId);
    if (session) {
        // 1. Editing Draft Title
        if (session.mode === 'EDIT_DRAFT_TITLE') {
            adminSessions.delete(userId);
            const updated = updateDraftContent(session.draftId, { title: text }, adminUser.display_name);
            if (updated) {
                await broadcastDraftUpdateToAllAdmins(session.draftId);
                await tg.call('sendMessage', {
                    chat_id: msg.chat.id,
                    text: `✅ تیتر خبر به‌روزرسانی شد و کارت جدید برای همه ادمین‌ها همگام‌سازی گردید.`
                });
            }
            return;
        }

        // 2. Editing Draft Summary
        if (session.mode === 'EDIT_DRAFT_SUMMARY') {
            adminSessions.delete(userId);
            const updated = updateDraftContent(session.draftId, { summary: text }, adminUser.display_name);
            if (updated) {
                await broadcastDraftUpdateToAllAdmins(session.draftId);
                await tg.call('sendMessage', {
                    chat_id: msg.chat.id,
                    text: `✅ خلاصه خبر به‌روزرسانی شد و در پی‌وی همه ادمین‌ها همگام‌سازی گردید.`
                });
            }
            return;
        }

        // 3. Adding New Admin (SuperAdmin only)
        if (session.mode === 'ADD_ADMIN' && isSuperAdmin(userId)) {
            adminSessions.delete(userId);
            if (msg.forward_from?.id) {
                const f = msg.forward_from;
                const name = [f.first_name, f.last_name].filter(Boolean).join(' ') || f.username || 'ادمین';
                upsertAdmin({ userId: f.id, username: f.username || '', displayName: name, role: 'ADMIN' });
                await tg.call('sendMessage', {
                    chat_id: msg.chat.id,
                    text: `✅ کاربر «${name}» (${f.id}) با موفقیت به لیست ادمین‌های ربات اضافه شد.`
                });
                return;
            }

            if (/^\d+$/.test(text)) {
                upsertAdmin({ userId: Number(text), displayName: `ادمین (${text})`, role: 'ADMIN' });
                await tg.call('sendMessage', {
                    chat_id: msg.chat.id,
                    text: `✅ آیدی عددی ${text} به لیست ادمین‌ها اضافه شد.`
                });
                return;
            }

            if (text.startsWith('@') || /^[a-zA-Z0-9_]{4,}$/.test(text)) {
                const cleanUname = text.replace(/^@/, '');
                addPendingAdminByUsername(cleanUname);
                await tg.call('sendMessage', {
                    chat_id: msg.chat.id,
                    text: `✅ یوزرنیم @${cleanUname} ثبت شد. به محض اینکه ایشان به ربات /start بزند، پنل ادمین برایش باز می‌شود.`
                });
                return;
            }
        }
    }

    // Smart Auto-Detection when Admin pastes a @channel, t.me link, RSS feed, or Website URL!
    if (
        text.startsWith('@') ||
        /^https?:\/\//i.test(text) ||
        /^(www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/i.test(text)
    ) {
        const waitMsg = await tg.call('sendMessage', {
            chat_id: msg.chat.id,
            text: '🔍 در حال شناسایی هوشمند منبع...'
        });

        const detected = await detectSourceInfoFromInput(text);
        adminSessions.set(userId, {
            mode: 'CONFIRM_NEW_SOURCE',
            sourceDraft: {
                ...detected,
                category: 'سیاسی',
                credibility: 80
            }
        });

        const catButtons = [];
        for (let i = 0; i < ALL_CATEGORIES.length; i += 3) {
            catButtons.push(
                ALL_CATEGORIES.slice(i, i + 3).map(cat => ({
                    text: cat,
                    callback_data: `srcwiz_cat:${cat}`
                }))
            );
        }
        catButtons.push([{ text: '❌ انصراف', callback_data: 'srcwiz_cancel' }]);

        await tg.call('editMessageText', {
            chat_id: msg.chat.id,
            message_id: waitMsg.message_id,
            parse_mode: 'HTML',
            text: [
                `✅ <b>منبع جدید شناسایی شد:</b>`,
                `• نام رسانه: <b>${detected.name}</b>`,
                `• نوع منبع: <b>${detected.type === 'TELEGRAM' ? 'کانال تلگرام' : detected.type === 'RSS' ? 'فید RSS' : 'وب‌سایت خبری'}</b>`,
                `• آدرس/شناسه: <code>${detected.urlOrHandle}</code>`,
                ``,
                `👇 <b>گام ۱: دسته‌بندی اصلی این منبع را انتخاب کنید:</b>`
            ].join('\n'),
            reply_markup: { inline_keyboard: catButtons }
        });
    }
}

// ─── Handle Inline Keyboard Callback Queries ───
async function handleCallbackQuery(cb) {
    const adminUser = verifyAndSyncTelegramUser(cb.from);
    if (!adminUser) {
        await tg.call('answerCallbackQuery', {
            callback_query_id: cb.id,
            text: '⛔️ شما دسترسی ادمین ندارید.',
            show_alert: true
        });
        return;
    }

    const userId = adminUser.user_id;
    const chatId = cb.message?.chat?.id || userId;
    const messageId = cb.message?.message_id;
    const data = cb.data || '';

    // 1. Main Panel Actions
    if (data === 'panel:home') {
        const view = buildMainPanelView(userId);
        await tg.call('editMessageText', {
            chat_id: chatId,
            message_id: messageId,
            text: view.text,
            parse_mode: 'HTML',
            reply_markup: view.reply_markup
        });
        await tg.call('answerCallbackQuery', { callback_query_id: cb.id });
        return;
    }

    if (data === 'panel:toggle_breaking_mode') {
        const current = getBooleanSetting('breaking_auto_publish', false);
        setSetting('breaking_auto_publish', current ? '0' : '1');
        const view = buildMainPanelView(userId);
        await tg.call('editMessageText', {
            chat_id: chatId,
            message_id: messageId,
            text: view.text,
            parse_mode: 'HTML',
            reply_markup: view.reply_markup
        });
        await tg.call('answerCallbackQuery', {
            callback_query_id: cb.id,
            text: !current
                ? '⚡️ حالت انتشار ۱۰۰٪ خودکار (بدون نیاز به تایید ادمین) فعال شد.'
                : '✋ حالت ارسال اخبار فوری به پی‌وی ادمین جهت تایید فعال شد.'
        });
        return;
    }

    if (data === 'panel:toggle_silent_night') {
        const current = getBooleanSetting('silent_night_enabled', true);
        setSetting('silent_night_enabled', current ? '0' : '1');
        const view = buildMainPanelView(userId);
        await tg.call('editMessageText', {
            chat_id: chatId,
            message_id: messageId,
            text: view.text,
            parse_mode: 'HTML',
            reply_markup: view.reply_markup
        });
        await tg.call('answerCallbackQuery', { callback_query_id: cb.id, text: 'تنظیم سکوت شبانه تغییر کرد.' });
        return;
    }

    if (data === 'panel:toggle_inline_btn') {
        const current = getBooleanSetting('inline_url_btn_enabled', true);
        setSetting('inline_url_btn_enabled', current ? '0' : '1');
        const view = buildMainPanelView(userId);
        await tg.call('editMessageText', {
            chat_id: chatId,
            message_id: messageId,
            text: view.text,
            parse_mode: 'HTML',
            reply_markup: view.reply_markup
        });
        await tg.call('answerCallbackQuery', { callback_query_id: cb.id, text: 'وضعیت دکمه شیشه‌ای زیر پست تغییر کرد.' });
        return;
    }

    if (data === 'panel:add_source_prompt') {
        await tg.call('answerCallbackQuery', { callback_query_id: cb.id });
        await tg.call('sendMessage', {
            chat_id: chatId,
            parse_mode: 'HTML',
            text: [
                `➕ <b>افزودن منبع خبری جدید</b>`,
                ``,
                `کافی است یکی از موارد زیر را کپی کرده و در همین چت ارسال کنید:`,
                `۱. آیدی یا لینک کانال تلگرام (مثلاً <code>@Farsna</code> یا <code>https://t.me/Tasnimnews</code>)`,
                `۲. لینک فید RSS خبرگزاری`,
                `۳. آدرس صفحه اخبار هر وب‌سایت`
            ].join('\n')
        });
        return;
    }

    if (data === 'panel:list_sources' || data.startsWith('src_toggle:') || data.startsWith('src_del:')) {
        if (data.startsWith('src_toggle:')) {
            toggleSourceActive(Number(data.split(':')[1]));
        } else if (data.startsWith('src_del:')) {
            deleteSource(Number(data.split(':')[1]));
        }

        const sources = getAllSources(false);
        const rows = sources.slice(0, 15).map(s => [
            {
                text: `${s.active ? '🟢' : '🔴'} ${s.name} (${s.type} · ${s.credibility}%)`,
                callback_data: `src_toggle:${s.id}`
            },
            { text: '🗑 حذف', callback_data: `src_del:${s.id}` }
        ]);
        rows.push([
            { text: '➕ افزودن منبع جدید', callback_data: 'panel:add_source_prompt' },
            { text: '🔙 بازگشت', callback_data: 'panel:home' }
        ]);

        await tg.call('editMessageText', {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'HTML',
            text: sources.length
                ? `📡 <b>لیست منابع اختصاصی بات (${sources.length} منبع):</b>\n<i>برای روشن/خاموش کردن هر منبع روی نام آن بزنید:</i>`
                : `📡 هنوز منبع دستی به بات اضافه نشده است (بات هم‌اکنون از فید رسمی سایت Duta تغذیه می‌شود).`,
            reply_markup: { inline_keyboard: rows }
        });
        await tg.call('answerCallbackQuery', { callback_query_id: cb.id });
        return;
    }

    if (data === 'panel:fetch_now') {
        await tg.call('answerCallbackQuery', { callback_query_id: cb.id, text: '🔄 واکشی منابع آغاز شد...' });
        const count = await runIngestionCycle({
            onNewDraftCreated: dispatchDraftToAdmins,
            onClusterUpgraded: upgradePublishedChannelCluster
        });
        await tg.call('sendMessage', {
            chat_id: chatId,
            text: `✅ واکشی منابع کامل شد (${count} رویداد جدید پردازش شد).`
        });
        return;
    }

    if (data === 'panel:publish_one_now') {
        const nextCluster = getNextUnpublishedAutoCluster();
        if (!nextCluster) {
            await tg.call('answerCallbackQuery', {
                callback_query_id: cb.id,
                text: 'در حال حاضر خبر جدید منتشرنشده‌ای در صف نیست (ابتدا واکشی منابع را بزنید).',
                show_alert: true
            });
            return;
        }
        await tg.call('answerCallbackQuery', { callback_query_id: cb.id, text: 'در حال ساخت NewsCard و انتشار...' });
        await publishItemToChannel(nextCluster);
        await tg.call('sendMessage', {
            chat_id: chatId,
            text: `✅ خبر «${nextCluster.representative_title}» با موفقیت در ${CONFIG.channelId} منتشر شد.`
        });
        return;
    }

    if (data === 'panel:sync_tablo') {
        await tg.call('answerCallbackQuery', { callback_query_id: cb.id, text: '📊 در حال دریافت ۲۸ نرخ بازار و بروزرسانی تابلو...' });
        const res = await syncOrPinTabloMessage(false);
        await tg.call('sendMessage', {
            chat_id: chatId,
            text: `✅ پیام پین‌شده تابلو بازار در ${CONFIG.channelId} با موفقیت بروزرسانی شد (${res.action}).`
        });
        return;
    }

    if (data === 'panel:analytics' || data === 'panel:analytics_7d') {
        await tg.call('answerCallbackQuery', { callback_query_id: cb.id, text: 'در حال استخراج آمار زنده...' });
        const hours = data === 'panel:analytics_7d' ? 168 : 24;
        const reportHtml = await buildAnalyticsReportText(hours);
        await tg.call('editMessageText', {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'HTML',
            text: reportHtml,
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '📊 آمار ۲۴ ساعت اخیر', callback_data: 'panel:analytics' },
                        { text: '📅 آمار ۷ روز اخیر (هفتگی)', callback_data: 'panel:analytics_7d' }
                    ],
                    [{ text: '🔙 بازگشت به پنل اصلی', callback_data: 'panel:home' }]
                ]
            }
        });
        return;
    }

    // 2. Personal Admin Settings Actions
    if (data === 'panel:my_prefs' || data.startsWith('myprefs:')) {
        const adm = getAdmin(userId);
        if (data === 'myprefs:toggle_breaking') {
            updateAdminPersonalPrefs(userId, { receiveBreakingDrafts: !adm.receiveBreakingDrafts });
        } else if (data === 'myprefs:toggle_ads') {
            updateAdminPersonalPrefs(userId, { receiveAdSuspects: !adm.receiveAdSuspects });
        } else if (data === 'myprefs:toggle_report') {
            updateAdminPersonalPrefs(userId, { receiveDailyReport: !adm.receiveDailyReport });
        }
        const view = buildPersonalPrefsView(userId);
        await tg.call('editMessageText', {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'HTML',
            text: view.text,
            reply_markup: view.reply_markup
        });
        await tg.call('answerCallbackQuery', { callback_query_id: cb.id, text: 'تنظیمات شخصی شما ذخیره شد.' });
        return;
    }

    // 3. SuperAdmin Multi-Admin Management
    if (data === 'panel:manage_admins' || data.startsWith('adm_del:') || data.startsWith('adm_pdel:') || data === 'adm_add_prompt') {
        if (!isSuperAdmin(userId)) {
            await tg.call('answerCallbackQuery', { callback_query_id: cb.id, text: 'فقط سوپرادمین دسترسی دارد.', show_alert: true });
            return;
        }

        if (data === 'adm_add_prompt') {
            adminSessions.set(userId, { mode: 'ADD_ADMIN' });
            await tg.call('answerCallbackQuery', { callback_query_id: cb.id });
            await tg.call('sendMessage', {
                chat_id: chatId,
                parse_mode: 'HTML',
                text: [
                    `👤 <b>افزودن ادمین جدید به ربات</b>`,
                    ``,
                    `یکی از ۳ کار زیر را انجام دهید:`,
                    `۱. یک پیام از شخص مورد نظر به اینجا <b>Forward</b> کنید.`,
                    `۲. یوزرنیم تلگرام او را بفرستید (مثلاً <code>@username</code>).`,
                    `۳. یا آیدی عددی تلگرام او را ارسال کنید.`,
                    ``,
                    `<i>برای لغو /cancel را بزنید.</i>`
                ].join('\n')
            });
            return;
        }

        if (data.startsWith('adm_del:')) {
            removeAdmin(Number(data.split(':')[1]));
        } else if (data.startsWith('adm_pdel:')) {
            removePendingAdminUsername(data.split(':')[1]);
        }

        const admins = getAllAdmins();
        const pending = getPendingAdminUsernames();
        const rows = admins.map(a => {
            if (a.role === 'SUPER_ADMIN') {
                return [{ text: `👑 ${a.display_name} (@${a.username || a.user_id}) — سوپرادمین`, callback_data: 'noop' }];
            }
            return [
                { text: `👤 ${a.display_name} (@${a.username || a.user_id})`, callback_data: 'noop' },
                { text: '🗑 حذف دسترسی', callback_data: `adm_del:${a.user_id}` }
            ];
        });

        for (const p of pending) {
            rows.push([
                { text: `⏳ @${p.username} (در انتظار /start)`, callback_data: 'noop' },
                { text: '🗑 لغو', callback_data: `adm_pdel:${p.username}` }
            ]);
        }

        rows.push([
            { text: '➕ افزودن ادمین جدید', callback_data: 'adm_add_prompt' },
            { text: '🔙 بازگشت', callback_data: 'panel:home' }
        ]);

        await tg.call('editMessageText', {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'HTML',
            text: `👥 <b>مدیریت ادمین‌های ربات (${admins.length} فعال):</b>`,
            reply_markup: { inline_keyboard: rows }
        });
        await tg.call('answerCallbackQuery', { callback_query_id: cb.id });
        return;
    }

    // 4. Add-Source Wizard Callbacks
    if (data === 'srcwiz_cancel') {
        adminSessions.delete(userId);
        await tg.call('editMessageText', {
            chat_id: chatId,
            message_id: messageId,
            text: '❌ افزودن منبع لغو شد.'
        });
        await tg.call('answerCallbackQuery', { callback_query_id: cb.id });
        return;
    }

    if (data.startsWith('srcwiz_cat:')) {
        const cat = data.split(':')[1];
        const session = adminSessions.get(userId);
        if (!session?.sourceDraft) return;
        session.sourceDraft.category = cat;

        await tg.call('editMessageText', {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'HTML',
            text: [
                `✅ منبع: <b>${session.sourceDraft.name}</b>`,
                `🏷 دسته‌بندی انتخابی: <b>${cat}</b>`,
                ``,
                `👇 <b>گام ۲: ضریب اعتبار پایه این منبع را انتخاب کنید:</b>`
            ].join('\n'),
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '🟢 بسیار معتبر (90%)', callback_data: 'srcwiz_cred:90' },
                        { text: '🟢 معتبر (82%)', callback_data: 'srcwiz_cred:82' }
                    ],
                    [
                        { text: '🟠 متوسط (72%)', callback_data: 'srcwiz_cred:72' },
                        { text: '🟠 کانال خبری (65%)', callback_data: 'srcwiz_cred:65' }
                    ],
                    [{ text: '❌ انصراف', callback_data: 'srcwiz_cancel' }]
                ]
            }
        });
        await tg.call('answerCallbackQuery', { callback_query_id: cb.id });
        return;
    }

    if (data.startsWith('srcwiz_cred:')) {
        const cred = Number(data.split(':')[1] || 78);
        const session = adminSessions.get(userId);
        if (!session?.sourceDraft) return;

        const saved = addSource({
            ...session.sourceDraft,
            credibility: cred
        });
        adminSessions.delete(userId);

        await tg.call('editMessageText', {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'HTML',
            text: [
                `🎉 <b>منبع جدید با موفقیت فعال شد!</b>`,
                `• نام: <b>${saved.name}</b>`,
                `• نوع: <b>${saved.type}</b>`,
                `• دسته‌بندی: <b>${saved.category}</b>`,
                `• ضریب اعتبار پایه: <b>${saved.credibility}%</b>`
            ].join('\n')
        });
        await tg.call('answerCallbackQuery', { callback_query_id: cb.id, text: 'منبع جدید اضافه شد!' });
        return;
    }

    // 5. Multi-Admin Breaking / Ad Draft Editorial Actions (Claim-Lock + Broadcast Sync)
    if (data.startsWith('dr_')) {
        const [action, rawId, extraParam] = data.split(':');
        const draftId = Number(rawId);
        const draft = getDraft(draftId);

        if (!draft || draft.status !== 'PENDING') {
            await tg.call('answerCallbackQuery', {
                callback_query_id: cb.id,
                text: 'این خبر قبلاً توسط یکی از ادمین‌ها تعیین تکلیف شده است.',
                show_alert: true
            });
            return;
        }

        // Acquire atomic lock before any state change
        const lockRes = tryAcquireDraftLock(draftId, userId, adminUser.display_name);
        if (!lockRes.ok) {
            await tg.call('answerCallbackQuery', {
                callback_query_id: cb.id,
                text: lockRes.reason,
                show_alert: true
            });
            return;
        }

        if (action === 'dr_pub') {
            const finalized = finalizeDraftStatus(draftId, 'PUBLISHED', adminUser.display_name);
            if (!finalized) {
                await tg.call('answerCallbackQuery', { callback_query_id: cb.id, text: 'قبلاً منتشر شده است.' });
                return;
            }
            await tg.call('answerCallbackQuery', { callback_query_id: cb.id, text: '🚀 در حال انتشار در کانال...' });
            await publishItemToChannel(finalized);
            await broadcastDraftUpdateToAllAdmins(draftId);
            return;
        }

        if (action === 'dr_rej') {
            finalizeDraftStatus(draftId, 'REJECTED', adminUser.display_name);
            await tg.call('answerCallbackQuery', { callback_query_id: cb.id, text: '🗑 خبر رد و حذف شد.' });
            await broadcastDraftUpdateToAllAdmins(draftId);
            return;
        }

        if (action === 'dr_brk') {
            updateDraftContent(draftId, { breaking: !draft.breaking }, adminUser.display_name);
            await tg.call('answerCallbackQuery', {
                callback_query_id: cb.id,
                text: !draft.breaking ? '🚨 تگ خبر فوری روشن شد' : '⚪️ تگ خبر فوری خاموش شد'
            });
            await broadcastDraftUpdateToAllAdmins(draftId);
            return;
        }

        if (action === 'dr_catmenu') {
            const catRows = [];
            for (let i = 0; i < ALL_CATEGORIES.length; i += 3) {
                catRows.push(
                    ALL_CATEGORIES.slice(i, i + 3).map(c => ({
                        text: c === draft.category ? `✓ ${c}` : c,
                        callback_data: `dr_setcat:${draft.id}:${c}`
                    }))
                );
            }
            await tg.call('editMessageReplyMarkup', {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: { inline_keyboard: catRows }
            });
            await tg.call('answerCallbackQuery', { callback_query_id: cb.id });
            return;
        }

        if (action === 'dr_setcat') {
            updateDraftContent(draftId, { category: extraParam }, adminUser.display_name);
            await tg.call('answerCallbackQuery', { callback_query_id: cb.id, text: `دسته‌بندی به ${extraParam} تغییر کرد.` });
            await broadcastDraftUpdateToAllAdmins(draftId);
            return;
        }

        if (action === 'dr_edtitle') {
            adminSessions.set(userId, { mode: 'EDIT_DRAFT_TITLE', draftId });
            await broadcastDraftUpdateToAllAdmins(draftId); // Shows lock indicator to other admins
            await tg.call('answerCallbackQuery', { callback_query_id: cb.id });
            await tg.call('sendMessage', {
                chat_id: chatId,
                parse_mode: 'HTML',
                text: `✏️ <b>تیتر جدید را تایپ و ارسال کنید:</b>\n\nتیتر فعلی:\n<code>${draft.title}</code>\n\n<i>(این خبر به مدت ۲ دقیقه برای ویرایش به نام شما قفل شد — لغو با /cancel)</i>`
            });
            return;
        }

        if (action === 'dr_edsum') {
            adminSessions.set(userId, { mode: 'EDIT_DRAFT_SUMMARY', draftId });
            await broadcastDraftUpdateToAllAdmins(draftId);
            await tg.call('answerCallbackQuery', { callback_query_id: cb.id });
            await tg.call('sendMessage', {
                chat_id: chatId,
                parse_mode: 'HTML',
                text: `📝 <b>متن خلاصه خبر جدید را تایپ و ارسال کنید:</b>\n\n<i>(لغو با /cancel)</i>`
            });
            return;
        }
    }

    await tg.call('answerCallbackQuery', { callback_query_id: cb.id });
}

// ─── Handle Native Telegram Channel Reaction Count Updates (Bot API 7.0+) ───
function handleMessageReactionCount(update) {
    try {
        const msgId = update.message_id;
        const reactions = Array.isArray(update.reactions) ? update.reactions : [];
        const totalCount = reactions.reduce((sum, r) => sum + Number(r.total_count || 0), 0);
        if (msgId && totalCount >= 0) {
            updateClusterTelegramMetrics(msgId, { reactions: totalCount });
        }
    } catch {}
}

// ─── Long-Polling Loop & Scheduled Background Jobs ───
let lastUpdateOffset = 0;
let lastNightlyReportDate = '';

async function startPollingLoop() {
    console.log(`🚀 [DutaBot] Connected to Telegram API Root: ${CONFIG.telegramApiRoot}`);
    console.log(`📢 [DutaBot] Target Channel: ${CONFIG.channelId} | SuperAdmin: ${CONFIG.superAdminUsername || CONFIG.superAdminId}`);

    while (true) {
        try {
            const updates = await tg.call('getUpdates', {
                offset: lastUpdateOffset,
                timeout: 20,
                allowed_updates: ['message', 'callback_query', 'message_reaction', 'message_reaction_count']
            });

            for (const u of updates) {
                lastUpdateOffset = u.update_id + 1;
                if (u.message && u.message.chat?.type === 'private') {
                    await handleAdminMessage(u.message).catch(e => console.warn('[MsgError]:', e.message));
                } else if (u.callback_query) {
                    await handleCallbackQuery(u.callback_query).catch(e => console.warn('[CbError]:', e.message));
                } else if (u.message_reaction_count) {
                    handleMessageReactionCount(u.message_reaction_count);
                }
            }
        } catch (err) {
            await new Promise(r => setTimeout(r, 4000));
        }
    }
}

function startBackgroundSchedulers() {
    // 1. Ingestion & Cross-Clustering Cycle (Every 3 minutes)
    setInterval(async () => {
        try {
            await runIngestionCycle({
                onNewDraftCreated: dispatchDraftToAdmins,
                onClusterUpgraded: upgradePublishedChannelCluster
            });
            await syncChannelPostMetrics();
        } catch (e) {
            console.warn('[Scheduler:Ingestion]', e.message);
        }
    }, CONFIG.fetchIntervalMs);

    // 2. Paced Auto-Publisher for Verified Regular News (Every 7 minutes)
    setInterval(async () => {
        try {
            if (!getBooleanSetting('auto_publish_regular', true)) return;
            const cluster = getNextUnpublishedAutoCluster();
            if (!cluster) return;

            // If it's breaking news and breaking_auto_publish is OFF, skip (since it's handled via Admin Draft)
            if (cluster.breaking && !getBooleanSetting('breaking_auto_publish', false)) {
                return;
            }
            await publishItemToChannel(cluster);
        } catch (e) {
            console.warn('[Scheduler:AutoPublish]', e.message);
        }
    }, CONFIG.autoPublishIntervalMs);

    // 3. Live Market Tablo Pinned Message Updater (Every 10 minutes)
    setInterval(async () => {
        try {
            const pinnedId = Number(getSetting('tablo_pinned_msg_id', '0'));
            if (pinnedId > 0) {
                await syncOrPinTabloMessage(false);
            }
        } catch (e) {
            console.warn('[Scheduler:Tablo]', e.message);
        }
    }, CONFIG.tabloUpdateIntervalMs);

    // 4. Nightly (23:00) & Weekly Friday (22:00) Analytics Digest + DB Cleanup
    setInterval(async () => {
        try {
            const now = new Date();
            const tehranHour = Number(
                new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tehran', hour: 'numeric', hour12: false }).format(now)
            );
            const tehranDateKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(now);
            const weekdayEn = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tehran', weekday: 'short' }).format(now);

            if (tehranHour === 23 && lastNightlyReportDate !== tehranDateKey) {
                lastNightlyReportDate = tehranDateKey;
                const isFriday = weekdayEn === 'Fri';
                const reportHtml = await buildAnalyticsReportText(isFriday ? 168 : 24);

                for (const adm of getAllAdmins()) {
                    if (!adm.receiveDailyReport) continue;
                    await tg.call('sendMessage', {
                        chat_id: adm.user_id,
                        parse_mode: 'HTML',
                        text: reportHtml
                    }).catch(() => {});
                }
                cleanupOldBotRecords(14);
            }
        } catch {}
    }, 60_000);
}

// ─── Bootstrap ───
(async () => {
    if (!CONFIG.botToken || CONFIG.botToken === 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
        console.error('❌ [DutaBot] Please set your real BOT_TOKEN in TelegramBot/duta-bot/.env');
        process.exit(1);
    }

    await ensureFontsLoaded();
    startBackgroundSchedulers();

    // Initial ingestion after 5 seconds
    setTimeout(() => {
        runIngestionCycle({
            onNewDraftCreated: dispatchDraftToAdmins,
            onClusterUpgraded: upgradePublishedChannelCluster
        }).catch(() => {});
    }, 5000);

    await startPollingLoop();
})();