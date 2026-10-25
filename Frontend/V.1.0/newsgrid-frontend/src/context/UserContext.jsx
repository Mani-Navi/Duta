import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';

const UserContext = createContext(null);

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

    // استور مشترک ری‌اکشن‌های کلستر برای سینک آنی بین کارت خبر و صفحه جزئیات خبر
    const [clusterReactions, setClusterReactions] = useState(() => {
        try {
            const saved = localStorage.getItem('duta_cluster_reactions');
            return saved ? JSON.parse(saved) : {};
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

    // خواندن وضعیت لحظه‌ای ری‌اکشن یک خبر (مشترک بین NewsCard و ArticleDetail)
    const getReactionData = useCallback((article) => {
        const cid = article?.cluster?.id;
        const synced = cid ? clusterReactions[cid] : null;

        return {
            likeCount: synced?.likeCount ?? article?.cluster?.likeCount ?? 0,
            hotCount: synced?.hotCount ?? article?.cluster?.hotCount ?? 0,
            doubtCount: synced?.doubtCount ?? article?.cluster?.doubtCount ?? 0,
            userReaction: synced !== undefined && 'userReaction' in synced
                ? synced.userReaction
                : (article?.userReaction ?? null)
        };
    }, [clusterReactions]);

    // ثبت و همگام‌سازی آنی ری‌اکشن در کل سایت
    const reactToCluster = useCallback(async (article, type) => {
        if (!user) {
            navigate('/auth');
            return null;
        }
        const cid = article?.cluster?.id;
        if (!cid) return null;

        // ۱. آپدیت Optimistic فوری در ۰ میلی‌ثانیه
        const current = getReactionData(article);
        let { likeCount, hotCount, doubtCount, userReaction } = current;

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

        const optimisticEntry = { likeCount, hotCount, doubtCount, userReaction };
        setClusterReactions(prev => {
            const next = { ...prev, [cid]: optimisticEntry };
            localStorage.setItem('duta_cluster_reactions', JSON.stringify(next));
            return next;
        });

        // ۲. همگام‌سازی با سرور
        try {
            const res = await api.post(`/clusters/${cid}/reactions`, { type });
            if (res.data) {
                const confirmed = {
                    likeCount: res.data.likeCount ?? likeCount,
                    hotCount: res.data.hotCount ?? hotCount,
                    doubtCount: res.data.doubtCount ?? doubtCount,
                    userReaction: res.data.userReaction ?? null
                };
                setClusterReactions(prev => {
                    const next = { ...prev, [cid]: confirmed };
                    localStorage.setItem('duta_cluster_reactions', JSON.stringify(next));
                    return next;
                });
                return confirmed;
            }
        } catch {}
        return optimisticEntry;
    }, [user, navigate, getReactionData]);

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
            reactToCluster
        }}>
            {children}
        </UserContext.Provider>
    );
}

export function useUser() {
    return useContext(UserContext);
}