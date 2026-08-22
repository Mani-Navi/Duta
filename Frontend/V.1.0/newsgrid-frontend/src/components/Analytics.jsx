import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const Analytics = () => {
    const location = useLocation();

    useEffect(() => {
        // ارسال اطلاعات صفحه جدید به گوگل آنالیتیکس
        if (window.gtag) {
            window.gtag('config', 'G-5ZTGQ5ZVBJ', {
                page_path: location.pathname + location.search,
            });
        }
    }, [location]);

    return null; // این کامپوننت چیزی رندر نمی‌کند
};

export default Analytics;