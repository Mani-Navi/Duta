import axios from 'axios';

// OPTIMIZED: Robust API base URL with fallback to production Railway backend
const BASE_URL = import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    'https://newsgrid-production-16cb.up.railway.app/api';

const api = axios.create({
    baseURL: BASE_URL,
    timeout: 10000, // 10 seconds timeout to prevent hanging connections
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
});

// Response Interceptor for graceful error logging
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.code === 'ECONNABORTED') {
            console.warn('Network request timed out:', error.config?.url);
        }
        return Promise.reject(error);
    }
);

export default api;