import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import { getSeededReactionBoost, getArticleScore } from '../utils/articleHelpers';

const UserContext = createContext(null);
const MAX_STORED_CLUSTER_REACTIONS = 200;
const BREAKING_CHECK_INTERVAL_MS = 2 * 60 * 1000; // بررسی اخبار فوری جدید هر ۲ دقیقه

function pruneReactionsMap(mapObj) {
    const keys = Object.keys(mapObj);
    if (keys.length <= MAX_STORED_CLUSTER_REACTIONS) {
        return mapObj;
    }
    const keysToKeep = keys.slice(keys.length - MAX_STORED_CLUSTER_REACTIONS);
    const pruned = {};
    for (const k of keysToKeep) {
        pruned[k] = mapObj[k];
    }
    return pruned;
}

export function UserProvider({ children }) {
    const navigate = useNavigate();
    const swRegistrationRef = useRef(null);

    const [user, setUser] = useState(() => {
        try {
            const saved = localStorage.getItem('duta_user');
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    });

    const [clusterReactions, setClusterReactions] = useState(() => {
        try {
            const saved = localStorage.getItem('duta_cluster_reactions');
            return saved ? pruneReactionsMap(JSON.parse(saved)) : {};
        } catch {
            return {};
        }
    });

    // وضعیت روشن یا خاموش بودن نوتیفیکیشن خبر فوری (UCS-012)
    const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
        if (typeof window === 'undefined' || !('Notification' in window)) return false;
        return localStorage.getItem('duta_notifications_enabled') === 'true'
            && Notification.permission === 'granted';
    });

    // ثبت Service Worker در مرورگر
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => {
                    swRegistrationRef.current = reg;
                })
                .catch(() => {});
        }
    }, []);

    useEffect(() => {
        const token = localStorage.getItem('duta_token');
        if (!token) return;

        api.get('/user/me')
            .then(res => {
                if (res.data && res.data.id) {
                    setUser(res.data);
                    localStorage.setItem('duta_user', JSON.stringify(res.data));
                }
            })
            .catch((err) => {
                if (err.response?.status === 401) {
                    localStorage.removeItem('duta_token');
                    localStorage.removeItem('duta_user');
                    setUser(null);
                }
            });
    }, []);

    // نمایش اعلان بومی در مرورگر/سیستم‌عامل (از طریق Service Worker یا Notification API)
    const showBrowserNotification = useCallback(async (title, body, targetUrl = '/') => {
        if (typeof window === 'undefined' || !('Notification' in window)) return;
        if (Notification.permission !== 'granted') return;

        const options = {
            body,
            icon: '/duta-logo.svg',
            badge: '/duta-logo.svg',
            dir: 'rtl',
            lang: 'fa-IR',
            tag: 'duta-breaking-' + Date.now(),
            data: { url: targetUrl }
        };

        try {
            if (swRegistrationRef.current && swRegistrationRef.current.showNotification) {
                await swRegistrationRef.current.showNotification(title, options);
                return;
            }
        } catch {}

        try {
            const notif = new Notification(title, options);
            notif.onclick = () => {
                window.focus();
                navigate(targetUrl);
                notif.close();
            };
        } catch {}
    }, [navigate]);

    // کلید روشن / خاموش کردن دریافت اعلان اخبار فوری (UCS-012)
    const toggleNotifications = useCallback(async () => {
        if (typeof window === 'undefined' || !('Notification' in window)) {
            alert('مرورگر شما از اعلان‌های وب پشتیبانی نمی‌کند.');
            return false;
        }

        // اگر الان روشن است -> خاموش شود
        if (notificationsEnabled) {
            setNotificationsEnabled(false);
            localStorage.setItem('duta_notifications_enabled', 'false');
            if (user) {
                api.delete('/notifications/unsubscribe').catch(() => {});
            }
            return false;
        }

        // اگر خاموش است -> درخواست مجوز از مرورگر و روشن کردن
        let perm = Notification.permission;
        if (perm === 'default') {
            perm = await Notification.requestPermission();
        }

        if (perm !== 'granted') {
            alert('برای دریافت اعلان خبر فوری، لطفاً دسترسی Notification را در نوار آدرس مرورگر خود روی Allow قرار دهید.');
            return false;
        }

        // ثبت آخرین شناسه خبر فوری فعلی به عنوان مبدا تا فقط اخبار جدیدتر نوتیف بدهند
        try {
            const res = await api.get('/articles/breaking?page=0&size=1');
            const latest = res.data?.content?.[0];
            if (latest?.id) {
                localStorage.setItem('duta_last_breaking_id', String(latest.id));
            }
        } catch {}

        setNotificationsEnabled(true);
        localStorage.setItem('duta_notifications_enabled', 'true');

        // ثبت اشتراک در جدول push_subscriptions بک‌اند (در صورت لاگین بودن)
        if (user) {
            api.post('/notifications/subscribe', {
                endpoint: `https://duta.ir/local-push/user-${user.id}`,
                p256dh: 'native-browser-notification',
                auth: 'duta-web-push'
            }).catch(() => {});
        }

        await showBrowserNotification(
            'اعلان خبر فوری Duta فعال شد',
            'به محض انتشار خبر فوری جدید، اعلان آن روی مرورگر شما نمایش داده می‌شود.',
            '/'
        );
        return true;
    }, [notificationsEnabled, user, showBrowserNotification]);

    // پایش خودکار اخبار فوری جدید در پس‌زمینه (UCS-012)
    useEffect(() => {
        if (!notificationsEnabled) return;

        const checkNewBreakingNews = async () => {
            if (typeof window === 'undefined' || Notification.permission !== 'granted') return;
            try {
                const res = await api.get('/articles/breaking?page=0&size=5');
                const items = res.data?.content || [];
                if (items.length === 0) return;

                const mutedSources = Array.isArray(user?.mutedSources) ? user.mutedSources : [];
                const interestScores = user?.interestScores || {};

                // فیلتر کردن منابع مسدودشده یا دسته‌هایی که کاربر «عدم علاقه» زده است
                const eligible = items.filter(a => {
                    const srcName = a.source?.name || '';
                    const cat = a.category || '';
                    if (mutedSources.includes(srcName)) return false;
                    if ((interestScores['cat:' + cat] || 0) <= -20) return false;
                    return true;
                });

                if (eligible.length === 0) return;

                const newest = eligible[0];
                const lastSeenId = Number(localStorage.getItem('duta_last_breaking_id') || 0);

                if (!lastSeenId) {
                    localStorage.setItem('duta_last_breaking_id', String(newest.id));
                    return;
                }

                if (newest.id > lastSeenId) {
                    localStorage.setItem('duta_last_breaking_id', String(newest.id));
                    const score = getArticleScore(newest);
                    const srcName = newest.source?.name || 'Duta';
                    const targetPath = `/article/${newest.slug || newest.id}`;

                    await showBrowserNotification(
                        `خبر فوری · ${srcName} (اعتبار ${score}٪)`,
                        newest.title,
                        targetPath
                    );
                }
            } catch {}
        };

        checkNewBreakingNews();
        const interval = setInterval(checkNewBreakingNews, BREAKING_CHECK_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [notificationsEnabled, user, showBrowserNotification]);

    const openModal = useCallback(() => {
        window.scrollTo(0, 0);
        navigate('/auth');
    }, [navigate]);

    const loginSuccess = useCallback((token, userData) => {
        localStorage.setItem('duta_token', token);
        localStorage.setItem('duta_user', JSON.stringify(userData));
        setUser(userData);
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem('duta_token');
        localStorage.removeItem('duta_user');
        localStorage.removeItem('duta_cluster_reactions');
        setUser(null);
        setClusterReactions({});
    }, []);

    const savePreferences = useCallback(async (prefsPayload) => {
        const res = await api.put('/user/preferences', prefsPayload);
        setUser(res.data);
        localStorage.setItem('duta_user', JSON.stringify(res.data));
        return res.data;
    }, []);

    const togglePinTicker = useCallback(async (assetId) => {
        if (!user) {
            navigate('/auth');
            return;
        }
        const current = Array.isArray(user.pinnedTickers) && user.pinnedTickers.length > 0
            ? [...user.pinnedTickers]
            : ['usd', 'gold18'];

        const idx = current.indexOf(assetId);
        if (idx > -1) {
            if (current.length <= 1) return;
            current.splice(idx, 1);
        } else {
            if (current.length >= 4) current.shift();
            current.push(assetId);
        }

        const optimistic = { ...user, pinnedTickers: current };
        setUser(optimistic);
        localStorage.setItem('duta_user', JSON.stringify(optimistic));

        try {
            await savePreferences({ pinnedTickers: current });
        } catch {}
    }, [user, navigate, savePreferences]);

    const sendFeedback = useCallback(async (actionType, category, sourceName, clusterId) => {
        if (!user) return null;
        try {
            const res = await api.post('/user/feedback', {
                actionType,
                category,
                sourceName,
                clusterId
            });
            if (res.data && res.data.id) {
                setUser(res.data);
                localStorage.setItem('duta_user', JSON.stringify(res.data));
            }
            return res.data;
        } catch {
            return null;
        }
    }, [user]);

    const getRawReactionData = useCallback((article) => {
        const cid = article?.cluster?.id;
        const synced = cid ? clusterReactions[cid] : null;

        const serverLike = article?.cluster?.likeCount ?? 0;
        const serverHot = article?.cluster?.hotCount ?? 0;
        const serverDoubt = article?.cluster?.doubtCount ?? 0;

        const isRecentlyClicked = synced?.updatedAt && (Date.now() - synced.updatedAt < 15000);

        const rawLike = isRecentlyClicked
            ? synced.likeCount
            : Math.max(synced?.likeCount ?? 0, serverLike);
        const rawHot = isRecentlyClicked
            ? synced.hotCount
            : Math.max(synced?.hotCount ?? 0, serverHot);
        const rawDoubt = isRecentlyClicked
            ? synced.doubtCount
            : Math.max(synced?.doubtCount ?? 0, serverDoubt);

        const userReaction = synced !== undefined && 'userReaction' in synced
            ? synced.userReaction
            : (article?.userReaction ?? null);

        return { rawLike, rawHot, rawDoubt, userReaction };
    }, [clusterReactions]);

    const getReactionData = useCallback((article) => {
        const { rawLike, rawHot, rawDoubt, userReaction } = getRawReactionData(article);
        const boost = getSeededReactionBoost(article);

        return {
            likeCount: rawLike + boost.like,
            hotCount: rawHot + boost.hot,
            doubtCount: rawDoubt + boost.doubt,
            userReaction
        };
    }, [getRawReactionData]);

    const syncServerArticleReaction = useCallback((article) => {
        const cid = article?.cluster?.id;
        if (!cid) return;
        if (article.userReaction === undefined && !article.cluster) return;

        setClusterReactions(prev => {
            const existing = prev[cid];
            const entry = {
                likeCount: article.cluster?.likeCount ?? existing?.likeCount ?? 0,
                hotCount: article.cluster?.hotCount ?? existing?.hotCount ?? 0,
                doubtCount: article.cluster?.doubtCount ?? existing?.doubtCount ?? 0,
                userReaction: article.userReaction !== undefined
                    ? article.userReaction
                    : (existing?.userReaction ?? null),
                updatedAt: Date.now()
            };
            const next = pruneReactionsMap({ ...prev, [cid]: entry });
            localStorage.setItem('duta_cluster_reactions', JSON.stringify(next));
            return next;
        });
    }, []);

    const reactToCluster = useCallback(async (article, type) => {
        if (!user) {
            navigate('/auth');
            return null;
        }
        const cid = article?.cluster?.id;
        if (!cid) return null;

        const { rawLike, rawHot, rawDoubt, userReaction: currentReaction } = getRawReactionData(article);
        let likeCount = rawLike;
        let hotCount = rawHot;
        let doubtCount = rawDoubt;
        let userReaction = currentReaction;

        if (userReaction === type) {
            if (type === 'LIKE') likeCount = Math.max(0, likeCount - 1);
            if (type === 'HOT') hotCount = Math.max(0, hotCount - 1);
            if (type === 'DOUBT') doubtCount = Math.max(0, doubtCount - 1);
            userReaction = null;
        } else {
            if (userReaction === 'LIKE') likeCount = Math.max(0, likeCount - 1);
            if (userReaction === 'HOT') hotCount = Math.max(0, hotCount - 1);
            if (userReaction === 'DOUBT') doubtCount = Math.max(0, doubtCount - 1);

            if (type === 'LIKE') likeCount++;
            if (type === 'HOT') hotCount++;
            if (type === 'DOUBT') doubtCount++;
            userReaction = type;
        }

        const optimisticEntry = { likeCount, hotCount, doubtCount, userReaction, updatedAt: Date.now() };
        setClusterReactions(prev => {
            const next = pruneReactionsMap({ ...prev, [cid]: optimisticEntry });
            localStorage.setItem('duta_cluster_reactions', JSON.stringify(next));
            return next;
        });

        try {
            const res = await api.post(`/clusters/${cid}/reactions`, { type });
            if (res.data) {
                const confirmed = {
                    likeCount: res.data.likeCount ?? likeCount,
                    hotCount: res.data.hotCount ?? hotCount,
                    doubtCount: res.data.doubtCount ?? doubtCount,
                    userReaction: res.data.userReaction ?? null,
                    updatedAt: Date.now()
                };
                setClusterReactions(prev => {
                    const next = pruneReactionsMap({ ...prev, [cid]: confirmed });
                    localStorage.setItem('duta_cluster_reactions', JSON.stringify(next));
                    return next;
                });
                return confirmed;
            }
        } catch {}
        return optimisticEntry;
    }, [user, navigate, getRawReactionData]);

    return (
        <UserContext.Provider value={{
            user,
            isLoggedIn: !!user,
            notificationsEnabled,
            toggleNotifications,
            openModal,
            loginSuccess,
            logout,
            savePreferences,
            togglePinTicker,
            sendFeedback,
            getReactionData,
            syncServerArticleReaction,
            reactToCluster
        }}>
            {children}
        </UserContext.Provider>
    );
}

export function useUser() {
    return useContext(UserContext);
}