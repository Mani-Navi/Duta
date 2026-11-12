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
    addSource,
    toggleSourceActive,
    deleteSource,
    getClusterById,
    updateClusterData,
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
    fetchSiteClusterSourcesList,
    runIngestionCycle,
    syncChannelPostMetrics
} from './fetcherAndClusterEngine.js';

function escapeHtml(str = '') {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

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

    async sendPhotoBuffer(chatId, imgBuffer, { caption = '', replyMarkup = null, disableNotification = false } = {}) {
        let lastErr = null;
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                const form = new FormData();
                form.append('chat_id', String(chatId));
                form.append('photo', new Blob([imgBuffer], { type: 'image/jpeg' }), 'duta-newscard.jpg');
                if (caption) form.append('caption', caption);
                if (disableNotification) form.append('disable_notification', 'true');
                if (replyMarkup) form.append('reply_markup', JSON.stringify(replyMarkup));

                const res = await fetch(`${this.baseUrl}/sendPhoto`, {
                    method: 'POST',
                    headers: this._headers(),
                    body: form,
                    signal: AbortSignal.timeout(45000)
                });
                const data = await res.json();
                if (!data.ok) {
                    throw new Error(data.description || 'sendPhoto failed');
                }
                return data.result;
            } catch (err) {
                lastErr = err;
                if (attempt < 2) {
                    await new Promise(r => setTimeout(r, 1500));
                }
            }
        }
        throw lastErr;
    }

    async editMessagePhotoBuffer(chatId, messageId, imgBuffer, { caption = '', replyMarkup = null } = {}) {
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
        form.append('card_photo', new Blob([imgBuffer], { type: 'image/jpeg' }), 'duta-newscard.jpg');
        if (replyMarkup) {
            form.append('reply_markup', JSON.stringify(replyMarkup));
        }

        const res = await fetch(`${this.baseUrl}/editMessageMedia`, {
            method: 'POST',
            headers: this._headers(),
            body: form,
            signal: AbortSignal.timeout(40000)
        });
        const data = await res.json();
        if (!data.ok) {
            throw new Error(data.description || 'editMessageMedia failed');
        }
        return data.result;
    }
}

const tg = new TelegramClient(CONFIG.botToken, CONFIG.telegramApiRoot, CONFIG.bridgeSecret);
const adminSessions = new Map();

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

async function resolveCompleteCoveredSources(item) {
    let list = [];
    if (Array.isArray(item.coveredSourcesList) && item.coveredSourcesList.length > 0) {
        list = item.coveredSourcesList;
    }

    const clusterId = item.cluster_id || item.id;
    const cluster = clusterId ? getClusterById(clusterId) : null;
    if (cluster && Array.isArray(cluster.coveredSourcesList) && cluster.coveredSourcesList.length > list.length) {
        list = cluster.coveredSourcesList;
    }

    const expectedCount = Number(item.sourceCount ?? item.source_count ?? cluster?.source_count ?? 1);
    const siteClusterId = cluster?.site_cluster_id || item.site_cluster_id;

    if (expectedCount > list.length && siteClusterId > 0) {
        const fetched = await fetchSiteClusterSourcesList(
            siteClusterId,
            item.sourceName || item.source_name || 'Duta',
            item.credibilityScore || item.credibility_score || 80
        );
        if (fetched.length > list.length) {
            list = fetched;
            if (cluster) {
                updateClusterData(cluster.id, { coveredSources: list, sourceCount: Math.max(expectedCount, list.length) });
            }
        }
    }

    return list;
}

async function publishItemToChannel(item) {
    const coveredSourcesList = await resolveCompleteCoveredSources(item);
    const imgBuffer = await renderNewsCardPng({
        title: item.title || item.representative_title,
        summary: item.summary,
        category: item.category,
        credibilityScore: item.credibilityScore ?? item.credibility_score,
        sourceCount: Math.max(Number(item.sourceCount ?? item.source_count ?? 1), coveredSourcesList.length),
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
        sourceCount: Math.max(Number(item.sourceCount ?? item.source_count ?? 1), coveredSourcesList.length),
        sourceName: item.sourceName ?? item.source_name,
        coveredSourcesList,
        shortUrl: item.shortUrl ?? item.short_url,
        breaking: Boolean(item.breaking)
    });

    const replyMarkup = buildChannelReplyMarkup(item.shortUrl ?? item.short_url);
    const disableNotification = isSilentNightWindow(Boolean(item.breaking));

    const sent = await tg.sendPhotoBuffer(CONFIG.channelId, imgBuffer, {
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
            Math.max(Number(item.sourceCount ?? item.source_count ?? 1), coveredSourcesList.length)
        );
    }

    return sent;
}

async function upgradePublishedChannelCluster(cluster) {
    if (!cluster?.channel_message_id) return;
    try {
        const coveredSourcesList = await resolveCompleteCoveredSources(cluster);
        const imgBuffer = await renderNewsCardPng({
            title: cluster.representative_title,
            summary: cluster.summary,
            category: cluster.category,
            credibilityScore: cluster.credibility_score,
            sourceCount: Math.max(cluster.source_count, coveredSourcesList.length),
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
                sourceCount: Math.max(cluster.source_count, coveredSourcesList.length),
                sourceName: cluster.source_name,
                coveredSourcesList,
                shortUrl: cluster.short_url,
                breaking: Boolean(cluster.breaking)
            },
            { isCredibilityUpgraded: true }
        );

        const replyMarkup = buildChannelReplyMarkup(cluster.short_url);
        await tg.editMessagePhotoBuffer(CONFIG.channelId, cluster.channel_message_id, imgBuffer, {
            caption,
            replyMarkup
        });

        markClusterPublished(
            cluster.id,
            cluster.channel_message_id,
            cluster.credibility_score,
            Math.max(cluster.source_count, coveredSourcesList.length)
        );
    } catch (err) {
        console.warn('[LiveUpgrade] Warning updating channel post:', err.message);
    }
}

async function buildDraftAdminCaption(draft) {
    const coveredSourcesList = await resolveCompleteCoveredSources(draft);
    const baseCaption = formatNewsCaption({
        title: draft.title,
        summary: draft.summary,
        category: draft.category,
        credibilityScore: draft.credibility_score,
        sourceCount: Math.max(draft.source_count, coveredSourcesList.length),
        sourceName: draft.source_name,
        coveredSourcesList,
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

async function dispatchDraftToAdmins(draft, autoPublishCluster = null) {
    if (autoPublishCluster) {
        try {
            await publishItemToChannel(autoPublishCluster);
        } catch (e) {
            console.warn('[AutoBreaking] Failed:', e.message);
        }
        return;
    }
    if (!draft) return;

    const eligibleAdmins = getEligibleAdminsForDraft({
        isBreaking: draft.breaking,
        isAdSuspect: draft.isAdSuspect,
        category: draft.category
    });

    if (eligibleAdmins.length === 0) return;

    const imgBuffer = await renderNewsCardPng({
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

    const caption = await buildDraftAdminCaption(draft);
    const replyMarkup = buildDraftInlineKeyboard(draft);

    for (const adm of eligibleAdmins) {
        try {
            const sent = await tg.sendPhotoBuffer(adm.user_id, imgBuffer, {
                caption,
                replyMarkup
            });
            saveDraftAdminMessage(draft.id, adm.user_id, sent.message_id);
        } catch (err) {
            console.warn(`[DraftDispatch] Could not send to admin ${adm.user_id}:`, err.message);
        }
    }
}

async function broadcastDraftUpdateToAllAdmins(draftId, { regenerateImage = true } = {}) {
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

    const caption = await buildDraftAdminCaption(draft);
    const replyMarkup = buildDraftInlineKeyboard(draft);

    if (!regenerateImage) {
        for (const row of adminMsgs) {
            try {
                await tg.call('editMessageCaption', {
                    chat_id: row.admin_chat_id,
                    message_id: row.message_id,
                    caption,
                    reply_markup: replyMarkup
                });
            } catch {}
        }
        return;
    }

    const imgBuffer = await renderNewsCardPng({
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

    for (const row of adminMsgs) {
        try {
            await tg.editMessagePhotoBuffer(row.admin_chat_id, row.message_id, imgBuffer, {
                caption,
                replyMarkup
            });
        } catch {
            try {
                await tg.call('editMessageCaption', {
                    chat_id: row.admin_chat_id,
                    message_id: row.message_id,
                    caption,
                    reply_markup: replyMarkup
                });
            } catch {}
        }
    }
}

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
        `🌐 متصل به فید رسمی سایت: <code>${CONFIG.dutaSiteUrl}/api/articles/rss.xml</code> ✅`,
        ``,
        `• انتشار خودکار اخبار عادی در کانال: <b>${autoRegular ? '🟢 روشن (فعال)' : '🔴 خاموش'}</b>`,
        `• وضعیت اخبار فوری: <b>${breakingAuto ? '⚡️ انتشار ۱۰۰٪ خودکار (بدون تایید)' : '✋ ارسال به پی‌وی برای تایید ادمین'}</b>`,
        `• حالت سکوت شبانه (۰۰:۳۰ تا ۰۷:۰۰): <b>${silentNight ? '🔕 فعال' : '🔔 غیرفعال'}</b>`,
        `• منابع اضافی ثبت‌شده در بات: <b>${sourcesCount} منبع</b>`,
        ``,
        `💡 <i>هر زمان لینک کانال تلگرام (@id)، فید RSS یا آدرس سایتی را در همین چت پیست کنی، خودکار اضافه می‌شود!</i>`
    ].join('\n');

    const keyboard = [
        [
            {
                text: autoRegular
                    ? '🟢 انتشار خودکار اخبار عادی: روشن (کلیک برای توقف)'
                    : '🔴 انتشار خودکار اخبار عادی: متوقف (کلیک برای شروع)',
                callback_data: 'panel:toggle_regular_auto'
            }
        ],
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
            { text: '📰 انتشار فوری ۱ خبر در کانال', callback_data: 'panel:publish_one_now' },
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

function buildPersonalPrefsView(userId) {
    const adm = getAdmin(userId);
    const text = [
        `⚙️ <b>تنظیمات شخصی ادمین: ${escapeHtml(adm.display_name)}</b>`,
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
            `«${escapeHtml(botStats.mostViewedPost.representative_title)}»`,
            `👁 ${(botStats.mostViewedPost.telegram_views || 0).toLocaleString('en-US')} بازدید در تلگرام | ❤️ ${botStats.mostViewedPost.telegram_reactions || 0} ری‌اکشن`
        );
    }

    if (botStats.mostReactedPost && botStats.mostReactedPost.telegram_reactions > 0) {
        lines.push(
            ``,
            `💬 <b>بیشترین ری‌اکشن مخاطبان در تلگرام:</b>`,
            `«${escapeHtml(botStats.mostReactedPost.representative_title)}»`,
            `❤️ ${botStats.mostReactedPost.telegram_reactions} ری‌اکشن در تلگرام | 👁 ${botStats.mostReactedPost.telegram_views || 0} بازدید`
        );
    }

    if (Array.isArray(siteStats.topArticles24h) && siteStats.topArticles24h.length > 0) {
        const topClick = siteStats.topArticles24h[0];
        lines.push(
            ``,
            `🌐 <b>بیشترین ورودی کلیک به سایت (duta.ir/c):</b>`,
            `«${escapeHtml(topClick.title)}»`,
            `🔗 ${topClick.shortLinkClicks} کلیک مستقیم | 👁 ${topClick.siteViews} بازدید کلستر در سایت`
        );
    }

    lines.push(`━━━━━━━━━━━━━━━`);
    return lines.join('\n');
}

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

async function autoPublishNextRegularCluster() {
    if (!getBooleanSetting('auto_publish_regular', true)) return false;
    const cluster = getNextUnpublishedAutoCluster();
    if (!cluster) return false;

    try {
        await publishItemToChannel(cluster);
        console.log(`✅ [AutoPublish] Published cluster #${cluster.id}: ${cluster.representative_title}`);
        return true;
    } catch (err) {
        console.error('[AutoPublish] Error publishing to channel:', err.message);
        return false;
    }
}

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

    const session = adminSessions.get(userId);
    if (session) {
        if (session.mode === 'EDIT_DRAFT_TITLE') {
            adminSessions.delete(userId);
            const updated = updateDraftContent(session.draftId, { title: text }, adminUser.display_name);
            if (updated) {
                await tg.call('sendMessage', {
                    chat_id: msg.chat.id,
                    text: `✅ تیتر خبر تغییر کرد. در حال به‌روزرسانی کارت...`
                });
                await broadcastDraftUpdateToAllAdmins(session.draftId, { regenerateImage: true });
            }
            return;
        }

        if (session.mode === 'EDIT_DRAFT_SUMMARY') {
            adminSessions.delete(userId);
            const updated = updateDraftContent(session.draftId, { summary: text }, adminUser.display_name);
            if (updated) {
                await broadcastDraftUpdateToAllAdmins(session.draftId, { regenerateImage: false });
                await tg.call('sendMessage', {
                    chat_id: msg.chat.id,
                    text: `✅ خلاصه خبر در کپشن به‌روزرسانی شد.`
                });
            }
            return;
        }

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

    if (
        text.startsWith('@') ||
        /^https?:\/\//i.test(text) ||
        /^(www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/i.test(text)
    ) {
        const waitMsg = await tg.call('sendMessage', {
            chat_id: msg.chat.id,
            text: '🔍 در حال شناسایی هوشمند منبع...'
        });

        try {
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
                    `• نام رسانه: <b>${escapeHtml(detected.name)}</b>`,
                    `• نوع منبع: <b>${detected.type === 'TELEGRAM' ? 'کانال تلگرام' : detected.type === 'RSS' ? 'فید RSS' : 'وب‌سایت خبری'}</b>`,
                    `• آدرس/شناسه: <code>${escapeHtml(detected.urlOrHandle)}</code>`,
                    ``,
                    `👇 <b>گام ۱: دسته‌بندی اصلی این منبع را انتخاب کنید:</b>`
                ].join('\n'),
                reply_markup: { inline_keyboard: catButtons }
            });
        } catch (err) {
            await tg.call('editMessageText', {
                chat_id: msg.chat.id,
                message_id: waitMsg.message_id,
                text: `❌ خطا در شناسایی منبع: ${err.message}`
            });
        }
    }
}

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

    if (data === 'panel:toggle_regular_auto') {
        const current = getBooleanSetting('auto_publish_regular', true);
        setSetting('auto_publish_regular', current ? '0' : '1');
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
            text: !current ? '🟢 انتشار خودکار اخبار عادی روشن شد.' : '🔴 انتشار خودکار اخبار عادی متوقف شد.'
        });
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
                : `📡 هنوز منبع دستی به بات اضافه نشده است (بات هم‌اکنون به صورت خودکار از فید رسمی سایت Duta تغذیه می‌شود).`,
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
                text: 'در حال حاضر خبر جدید منتشرنشده‌ای در صف نیست.',
                show_alert: true
            });
            return;
        }
        await tg.call('answerCallbackQuery', { callback_query_id: cb.id, text: 'در حال ساخت NewsCard و انتشار...' });
        try {
            await publishItemToChannel(nextCluster);
            await tg.call('sendMessage', {
                chat_id: chatId,
                text: `✅ خبر «${nextCluster.representative_title}» با موفقیت در ${CONFIG.channelId} منتشر شد.`
            });
        } catch (err) {
            await tg.call('sendMessage', {
                chat_id: chatId,
                text: `❌ خطا در ارسال به کانال ${CONFIG.channelId}:\n${err.message}`
            });
        }
        return;
    }

    if (data === 'panel:sync_tablo') {
        await tg.call('answerCallbackQuery', { callback_query_id: cb.id, text: '📊 در حال دریافت ۲۸ نرخ بازار و بروزرسانی تابلو...' });
        try {
            const res = await syncOrPinTabloMessage(false);
            await tg.call('sendMessage', {
                chat_id: chatId,
                text: `✅ پیام پین‌شده تابلو بازار در ${CONFIG.channelId} با موفقیت بروزرسانی شد (${res.action}).`
            });
        } catch (err) {
            await tg.call('sendMessage', {
                chat_id: chatId,
                text: `❌ خطا در ارسال تابلو به کانال ${CONFIG.channelId}:\n${err.message}`
            });
        }
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
                `✅ منبع: <b>${escapeHtml(session.sourceDraft.name)}</b>`,
                `🏷 دسته‌بندی انتخابی: <b>${escapeHtml(cat)}</b>`,
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
                `• نام: <b>${escapeHtml(saved.name)}</b>`,
                `• نوع: <b>${saved.type}</b>`,
                `• دسته‌بندی: <b>${escapeHtml(saved.category)}</b>`,
                `• ضریب اعتبار پایه: <b>${saved.credibility}%</b>`
            ].join('\n')
        });
        await tg.call('answerCallbackQuery', { callback_query_id: cb.id, text: 'منبع جدید اضافه شد!' });
        return;
    }

    // Multi-Admin Breaking / Ad Draft Actions (Instant Response + Safe Publish)
    if (data.startsWith('dr_')) {
        const [action, rawId, extraParam] = data.split(':');
        const draftId = Number(rawId);
        const draft = getDraft(draftId);

        if (!draft || draft.status !== 'PENDING') {
            await tg.call('answerCallbackQuery', {
                callback_query_id: cb.id,
                text: 'این خبر قبلاً منتشر یا حذف شده است.',
                show_alert: true
            });
            return;
        }

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
            await tg.call('answerCallbackQuery', { callback_query_id: cb.id, text: '🚀 در حال انتشار در کانال...' });
            try {
                await publishItemToChannel(draft);
                finalizeDraftStatus(draftId, 'PUBLISHED', adminUser.display_name);
                await broadcastDraftUpdateToAllAdmins(draftId, { regenerateImage: false });
            } catch (err) {
                releaseDraftLock(draftId, userId);
                await tg.call('sendMessage', {
                    chat_id: chatId,
                    text: `❌ خطا در انتشار خبر در کانال ${CONFIG.channelId}:\n${err.message}`
                });
            }
            return;
        }

        if (action === 'dr_rej') {
            finalizeDraftStatus(draftId, 'REJECTED', adminUser.display_name);
            await tg.call('answerCallbackQuery', { callback_query_id: cb.id, text: '🗑 خبر رد و حذف شد.' });
            await broadcastDraftUpdateToAllAdmins(draftId, { regenerateImage: false });
            return;
        }

        if (action === 'dr_brk') {
            await tg.call('answerCallbackQuery', {
                callback_query_id: cb.id,
                text: !draft.breaking ? '🚨 تگ خبر فوری روشن شد' : '⚪️ تگ خبر فوری خاموش شد'
            });
            updateDraftContent(draftId, { breaking: !draft.breaking }, adminUser.display_name);
            await broadcastDraftUpdateToAllAdmins(draftId, { regenerateImage: true });
            return;
        }

        if (action === 'dr_catmenu') {
            await tg.call('answerCallbackQuery', { callback_query_id: cb.id });
            const catRows = [];
            for (let i = 0; i < ALL_CATEGORIES.length; i += 3) {
                catRows.push(
                    ALL_CATEGORIES.slice(i, i + 3).map(c => ({
                        text: c === draft.category ? `✓ ${c}` : c,
                        callback_data: `dr_setcat:${draft.id}:${c}`
                    }))
                );
            }
            catRows.push([{ text: '🔙 بازگشت به دکمه‌های خبر', callback_data: `dr_backmenu:${draft.id}` }]);

            await tg.call('editMessageReplyMarkup', {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: { inline_keyboard: catRows }
            });
            return;
        }

        if (action === 'dr_backmenu') {
            releaseDraftLock(draftId, userId);
            await tg.call('answerCallbackQuery', { callback_query_id: cb.id });
            await tg.call('editMessageReplyMarkup', {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: buildDraftInlineKeyboard(draft)
            });
            return;
        }

        if (action === 'dr_setcat') {
            await tg.call('answerCallbackQuery', { callback_query_id: cb.id, text: `دسته‌بندی به ${extraParam} تغییر کرد.` });
            updateDraftContent(draftId, { category: extraParam }, adminUser.display_name);
            await broadcastDraftUpdateToAllAdmins(draftId, { regenerateImage: false });
            return;
        }

        if (action === 'dr_edtitle') {
            adminSessions.set(userId, { mode: 'EDIT_DRAFT_TITLE', draftId });
            await tg.call('answerCallbackQuery', { callback_query_id: cb.id });
            await tg.call('sendMessage', {
                chat_id: chatId,
                parse_mode: 'HTML',
                text: `✏️ <b>تیتر جدید را تایپ و ارسال کنید:</b>\n\nتیتر فعلی:\n<code>${escapeHtml(draft.title)}</code>\n\n<i>(لغو با /cancel)</i>`
            });
            return;
        }

        if (action === 'dr_edsum') {
            adminSessions.set(userId, { mode: 'EDIT_DRAFT_SUMMARY', draftId });
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

    setInterval(async () => {
        await autoPublishNextRegularCluster();
    }, CONFIG.autoPublishIntervalMs);

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

(async () => {
    if (!CONFIG.botToken || CONFIG.botToken === 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
        console.error('❌ [DutaBot] Please set your real BOT_TOKEN in TelegramBot/duta-bot/.env');
        process.exit(1);
    }

    await ensureFontsLoaded();
    startBackgroundSchedulers();

    setTimeout(async () => {
        try {
            await runIngestionCycle({
                onNewDraftCreated: dispatchDraftToAdmins,
                onClusterUpgraded: upgradePublishedChannelCluster
            });
            await autoPublishNextRegularCluster();
        } catch {}
    }, 6000);

    await startPollingLoop();
})();