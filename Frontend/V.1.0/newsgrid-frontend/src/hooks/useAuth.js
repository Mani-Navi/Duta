import { useState } from 'react';
import api from '../api/axiosConfig';

export function useAuth() {
    const [user, setUser] = useState(() => {
        const saved = localStorage.getItem('ng_user');
        return saved ? JSON.parse(saved) : null;
    });

    const login = async (email, password) => {
        const res = await api.post('/auth/login', { email, password });
        localStorage.setItem('ng_token', res.data.token);
        localStorage.setItem('ng_user', JSON.stringify(res.data));
        setUser(res.data);
        return res.data;
    };

    const register = async (email, password, name, city) => {
        const res = await api.post('/auth/register', { email, password, name, city });
        localStorage.setItem('ng_token', res.data.token);
        localStorage.setItem('ng_user', JSON.stringify(res.data));
        setUser(res.data);
        return res.data;
    };

    const logout = () => {
        localStorage.removeItem('ng_token');
        localStorage.removeItem('ng_user');
        setUser(null);
    };

    return { user, setUser, login, register, logout };
}