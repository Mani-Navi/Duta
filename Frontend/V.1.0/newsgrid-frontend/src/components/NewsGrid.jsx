import { useState, useEffect, useRef, useCallback } from 'react';
import NewsCard from './NewsCard';
import TelegramNewsCard from './TelegramNewsCard';
import NewsCardSkeleton from './NewsCardSkeleton';
import api from '../api/axiosConfig';
import strings from '../strings/strings';

const AUTO_REFRESH_MS = 5 * 60 * 1000;

function NewsGrid({ lang = 'fa', activeCategory, onOpenArticle, searchKeyword }) {
    const [articles, setArticles] = useState([]);
    const [newCount, setNewCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);
    const observer = useRef(null);
    const latestIdRef = useRef(null);
    const t = strings[lang] || strings['fa'];

    useEffect(() => {
        setArticles([]);
        setPage(0);
        setHasMore(true);
        setNewCount(0);
        latestIdRef.current = null;
    }, [activeCategory, searchKeyword]);

    useEffect(() => {
        fetchArticles();
    }, [page, activeCategory, searchKeyword, refreshKey]);

    useEffect(() => {
        const interval = setInterval(async () => {
            if (!latestIdRef.current) return;
            try {
                const res = await fetchUrl(0);
                const rawList = Array.isArray(res.data) ? res.data : (res.data?.content || []);
                const fresh = rawList.filter(a => a.id > latestIdRef.current);
                if (fresh.length > 0) setNewCount(fresh.length);
            } catch {}
        }, AUTO_REFRESH_MS);
        return () => clearInterval(interval);
    }, [activeCategory, searchKeyword]);

    const fetchUrl = (p) => {
        if (searchKeyword)
            return api.get(`/articles/search?keyword=${encodeURIComponent(searchKeyword)}&page=${p}&size=20`);
        if (activeCategory === 'breaking')
            return api.get(`/articles/breaking?page=${p}&size=20`);
        if (activeCategory === 'telegram')
            return api.get(`/articles/telegram?page=${p}&size=20`);
        if (activeCategory === 'all' || activeCategory === 0 || activeCategory === null)
            return api.get(`/articles?page=${p}&size=20`);

        return api.get(`/articles/category?name=${encodeURIComponent(activeCategory)}&page=${p}&size=20`);
    };

    const fetchArticles = async () => {
        if (loading || (page > 0 && !hasMore)) return;

        try {
            setLoading(true);
            setError(null);
            const response = await fetchUrl(page);
            const data = response.data;

            const newItems = Array.isArray(data) ? data : (data?.content || []);

            setArticles(prev => {
                const next = page === 0 ? newItems : [...prev, ...newItems];
                if (next.length > 0) {
                    const validIds = next.map(a => a.id).filter(Boolean);
                    if (validIds.length > 0) {
                        latestIdRef.current = Math.max(...validIds);
                    }
                }
                return next;
            });

            if (Array.isArray(data)) {
                setHasMore(false);
            } else {
                setHasMore(!data.last);
            }

        } catch (err) {
            console.error("❌ خطای دریافت اخبار در فرانت‌اند:", err);
            setError(lang === 'fa' ? 'خطا در دریافت اخبار' : 'Error fetching news');
        } finally {
            setLoading(false);
        }
    };

    const loadNewArticles = () => {
        setArticles([]);
        setHasMore(true);
        setNewCount(0);
        latestIdRef.current = null;
        window.scrollTo({ top: 0, behavior: 'smooth' });

        if (page === 0) {
            setRefreshKey(k => k + 1);
        } else {
            setPage(0);
        }
    };

    const lastCardRef = useCallback(node => {
        if (loading) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore)
                setPage(prev => prev + 1);
        });
        if (node) observer.current.observe(node);
    }, [loading, hasMore]);

    // ── نمایش حالت خطا با دکمه «تلاش مجدد» ──
    if (error && articles.length === 0) return (
        <div className="retry-container">
            <div className="status-text error">{error}</div>
            <button className="retry-btn" onClick={loadNewArticles}>
                🔄 {lang === 'fa' ? 'تلاش مجدد' : 'Retry'}
            </button>
        </div>
    );

    return (
        <>
            {newCount > 0 && (
                <div className="new-articles-bar" onClick={loadNewArticles}>
                    <i className="ti ti-arrow-up" />
                    {newCount} خبر جدید
                </div>
            )}

            <div className="grid">
                {/* رندر اخبار اصلی */}
                {articles.map((article, index) => {
                    const isLast = index === articles.length - 1;
                    const isTelegram = article.source?.sourceType === 'TELEGRAM';

                    return (
                        <div key={article.id || index} ref={isLast ? lastCardRef : null}>
                            {isTelegram ? (
                                <TelegramNewsCard article={article} lang={lang} onOpen={onOpenArticle} />
                            ) : (
                                <NewsCard article={article} lang={lang} onOpen={onOpenArticle} />
                            )}
                        </div>
                    );
                })}

                {/* رندر اسکلتون لودر در صورت در حال بارگذاری بودن صفحه اول */}
                {loading && articles.length === 0 && (
                    <>
                        <NewsCardSkeleton />
                        <NewsCardSkeleton />
                        <NewsCardSkeleton />
                        <NewsCardSkeleton />
                        <NewsCardSkeleton />
                        <NewsCardSkeleton />
                    </>
                )}
            </div>

            {/* لودینگ صفحه دوم به بعد */}
            {loading && articles.length > 0 && (
                <div className="grid-status">
                    <div className="status-text">{lang === 'fa' ? 'در حال دریافت اخبار بیشتر...' : 'Loading more...'}</div>
                </div>
            )}

            {!hasMore && articles.length > 0 && (
                <div className="grid-status">
                    <div className="status-text">
                        {lang === 'fa' ? 'همه اخبار نمایش داده شد' : 'All news loaded'}
                    </div>
                </div>
            )}
        </>
    );
}

export default NewsGrid;