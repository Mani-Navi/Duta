import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL
});

// هر request اگه token داشتیم، اضافه کن
api.interceptors.request.use(config => {
    const token = localStorage.getItem('ng_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// اگه 401 گرفتیم، token رو پاک کن
api.interceptors.response.use(
    res => res,
    err => {
        if (err.response?.status === 401) {
            localStorage.removeItem('ng_token');
            localStorage.removeItem('ng_user');
        }
        return Promise.reject(err);
    }
);

export default api;