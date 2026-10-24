import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/axiosConfig';

const UserContext = createContext(null);

export function UserProvider({ children }) {
    const [user, setUser] = useState(() => {
        try {
            const saved = localStorage.getItem('duta_user');
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    });

    const [modalState, setModalState] = useState({ open: false, mode: 'auth', title: '' });

    // همگام‌سازی پروفایل کاربر با سرور در بدو ورود
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

    const openModal = useCallback((mode = 'prefs', title = '') => {
        setModalState({
            open: true,
            mode: user ? mode : 'auth',
            title
        });
    }, [user]);

    const closeModal = useCallback(() => {
        setModalState(prev => ({ ...prev, open: false }));
    }, []);

    const loginSuccess = useCallback((token, userData, openOnboarding = false) => {
        localStorage.setItem('duta_token', token);
        localStorage.setItem('duta_user', JSON.stringify(userData));
        setUser(userData);
        if (openOnboarding) {
            setModalState({ open: true, mode: 'prefs', title: 'شخصی‌سازی فید خبری شما' });
        } else {
            setModalState({ open: false, mode: 'prefs', title: '' });
        }
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem('duta_token');
        localStorage.removeItem('duta_user');
        setUser(null);
        setModalState({ open: false, mode: 'auth', title: '' });
    }, []);

    const savePreferences = useCallback(async (prefsPayload) => {
        const res = await api.put('/user/preferences', prefsPayload);
        setUser(res.data);
        localStorage.setItem('duta_user', JSON.stringify(res.data));
        return res.data;
    }, []);

    const togglePinTicker = useCallback(async (assetId) => {
        if (!user) {
            openModal('auth', 'ورود به حساب برای شخصی‌سازی نوار قیمت');
            return;
        }
        const current = Array.isArray(user.pinnedTickers) && user.pinnedTickers.length > 0
            ? [...user.pinnedTickers]
            : ['usd', 'gold18'];

        const idx = current.indexOf(assetId);
        if (idx > -1) {
            if (current.length <= 1) return; // حداقل ۱ دارایی در هدر باقی بماند
            current.splice(idx, 1);
        } else {
            if (current.length >= 4) current.shift(); // حداکثر ۴ کپسول در هدر
            current.push(assetId);
        }

        const optimistic = { ...user, pinnedTickers: current };
        setUser(optimistic);
        localStorage.setItem('duta_user', JSON.stringify(optimistic));

        try {
            await savePreferences({ pinnedTickers: current });
        } catch {}
    }, [user, openModal, savePreferences]);

    // UCS-009: ثبت تعامل معنادار (SOURCE_CLICK, SHARE, QUALIFIED_READ) یا بازخورد منفی (DISLIKE_TOPIC, MUTE_SOURCE, HIDE_CLUSTER)
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

    return (
        <UserContext.Provider value={{
            user,
            isLoggedIn: !!user,
            modalState,
            openModal,
            closeModal,
            loginSuccess,
            logout,
            savePreferences,
            togglePinTicker,
            sendFeedback
        }}>
            {children}
        </UserContext.Provider>
    );
}

export function useUser() {
    return useContext(UserContext);
}