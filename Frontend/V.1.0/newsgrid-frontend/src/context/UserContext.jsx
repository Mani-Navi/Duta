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
        setUser(null);
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

    return (
        <UserContext.Provider value={{
            user,
            isLoggedIn: !!user,
            openModal,
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