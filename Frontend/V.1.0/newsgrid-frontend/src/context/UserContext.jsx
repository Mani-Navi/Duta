import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import { getSeededReactionBoost } from '../utils/articleHelpers';

const UserContext = createContext(null);
const MAX_STORED_CLUSTER_REACTIONS = 200;

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

    const [user, setUser] = useState(() => {
        try {
            const saved = localStorage.getItem('duta_user');
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    });

    // استور مشترک شمارنده‌های واقعی سرور + وضعیت ری‌اکشن کاربر
    const [clusterReactions, setClusterReactions] = useState(() => {
        try {
            const saved = localStorage.getItem('duta_cluster_reactions');
            return saved ? pruneReactionsMap(JSON.parse(saved)) : {};
        } catch {
            return {};
        }
    });

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

    // محاسبه شمارنده واقعی (Real DB Count) بدون بوست نمایشی
    const getRawReactionData = useCallback((article) => {
        const cid = article?.cluster?.id;
        const synced = cid ? clusterReactions[cid] : null;

        const serverLike = article?.cluster?.likeCount ?? 0;
        const serverHot = article?.cluster?.hotCount ?? 0;
        const serverDoubt = article?.cluster?.doubtCount ?? 0;

        // اگر کاربر در ۱۵ ثانیه اخیر خودش روی این کلستر کلیک کرده، مقدار Optimistic/Confirmed او اولویت دارد؛
        // در غیر این صورت، بیشترین مقدار بین سرور و کش محلی نمایش داده می‌شود تا لایک سایر کاربران همیشه دیده شود.
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

    // خواندن وضعیت نهایی ری‌اکشن برای نمایش در UI (شمارنده واقعی + بوست نمایشی)
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