import { useState, useEffect, useRef, useCallback } from 'react';
import NewsCard from './NewsCard';
import TelegramNewsCard from './TelegramNewsCard';
import NewsCardSkeleton from './NewsCardSkeleton';
import api from '../api/axiosConfig';

const AUTO_REFRESH_MS = 5 * 60 * 1000;
const CACHE_KEY = 'nitt_initial_articles_cache';

function NewsGrid({ activeCategory, onOpenArticle, searchKeyword }) {
    // Initialize state
    const [articles, setArticles] = useState(() => {
        if (!activeCategory && !searchKeyword) {
            try {
                const saved = localStorage.getItem(CACHE_KEY);
                return saved ? JSON.parse(saved) : [];
            } catch (e) {
                return [];
            }
        }
        return [];
    });

    const [newCount, setNewCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);

    const observer = useRef(null);
    const latestIdRef = useRef(null);

    // OPTIMIZED: Always clear articles on ANY category switch (including 'all' / null) to show Skeleton Loader
    useEffect(() => {
        setArticles([]);
        setPage(0);
        setHasMore(true);
        setNewCount(0);
        latestIdRef.current = null;
    }, [activeCategory, searchKeyword]);

    const fetchUrl = useCallback((p) => {
        if (searchKeyword)
            return api.get(`/articles/search?keyword=${encodeURIComponent(searchKeyword)}&page=${p}&size=20`);

        if (activeCategory === 'breaking')
            return api.get(`/articles/breaking?page=${p}&size=20`);

        if (activeCategory === 'telegram')
            return api.get(`/articles/telegram?page=${p}&size=20`);

        if (activeCategory === 'all' || activeCategory === null || activeCategory === undefined)
            return api.get(`/articles?page=${p}&size=20`);

        return api.get(`/articles/category?name=${encodeURIComponent(activeCategory)}&page=${p}&size=20`);
    }, [activeCategory, searchKeyword]);

    const fetchArticles = useCallback(async () => {
        if (loading || (!hasMore && page > 0)) return;

        try {
            setLoading(true);
            setError(null);
            const response = await fetchUrl(page);
            const data = response.data;

            const newItems = Array.isArray(data) ? data : (data?.content || []);

            setArticles(prev => {
                const combined = page === 0 ? newItems : [...prev, ...newItems];
                const uniqueMap = new Map();
                combined.forEach(item => {
                    if (item.id) uniqueMap.set(item.id, item);
                });
                const nextList = Array.from(uniqueMap.values());

                if (nextList.length > 0) {
                    const validIds = nextList.map(a => Number(a.id)).filter(Boolean);
                    if (validIds.length > 0) {
                        latestIdRef.current = Math.max(...validIds);
                    }
                    if (page === 0 && !activeCategory && !searchKeyword) {
                        try {
                            localStorage.setItem(CACHE_KEY, JSON.stringify(nextList.slice(0, 15)));
                        } catch (e) {}
                    }
                }
                return nextList;
            });

            if (Array.isArray(data)) {
                setHasMore(false);
            } else {
                setHasMore(!data.last);
            }

        } catch (err) {
            console.error("Error fetching articles:", err);
            setError("خطا در دریافت اخبار. لطفاً اتصال شبکه را بررسی کنید.");
        } finally {
            setLoading(false);
        }
    }, [fetchUrl, hasMore, loading, page, activeCategory, searchKeyword]);

    useEffect(() => {
        fetchArticles();
    }, [page, activeCategory, searchKeyword, refreshKey]);

    useEffect(() => {
        const interval = setInterval(async () => {
            if (!latestIdRef.current || document.hidden) return;
            try {
                const res = await fetchUrl(0);
                const rawList = Array.isArray(res.data) ? res.data : (res.data?.content || []);
                const fresh = rawList.filter(a => Number(a.id) > Number(latestIdRef.current));
                if (fresh.length > 0) setNewCount(fresh.length);
            } catch (ignored) {}
        }, AUTO_REFRESH_MS);
        return () => clearInterval(interval);
    }, [fetchUrl]);

    const loadNewArticles = () => {
        setError(null);
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

    const retryFetchPage = () => {
        setError(null);
        fetchArticles();
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

    if (error && articles.length === 0) {
        return (
            <div className="retry-container">
                <div className="status-text error">{error}</div>
                <button className="retry-btn" onClick={loadNewArticles}>
                    <i className="ti ti-refresh" />
                    تلاش مجدد
                </button>
            </div>
        );
    }

    return (
        <>
            {newCount > 0 && (
                <div className="new-articles-bar" onClick={loadNewArticles} role="button" tabIndex={0}>
                    <i className="ti ti-arrow-up" />
                    {newCount} خبر جدید
                </div>
            )}

            <div className="grid">
                {articles.map((article, index) => {
                    const isLast = index === articles.length - 1;
                    const isTelegram = article.source?.sourceType === 'TELEGRAM';

                    return (
                        <div key={article.id || index} ref={isLast ? lastCardRef : null}>
                            {isTelegram ? (
                                <TelegramNewsCard article={article} onOpen={onOpenArticle} />
                            ) : (
                                <NewsCard article={article} onOpen={onOpenArticle} />
                            )}
                        </div>
                    );
                })}

                {loading && articles.length === 0 && (
                    <>
                        <NewsCardSkeleton />
                        <NewsCardSkeleton />
                        <NewsCardSkeleton />
                        <NewsCardSkeleton />
                    </>
                )}
            </div>

            {error && articles.length > 0 && (
                <div className="retry-container" style={{ padding: '20px' }}>
                    <div className="status-text error">{error}</div>
                    <button className="retry-btn" onClick={retryFetchPage}>
                        <i className="ti ti-refresh" />
                        تلاش مجدد
                    </button>
                </div>
            )}

            {loading && articles.length > 0 && (
                <div className="grid-status">
                    <div className="status-text">در حال بارگذاری...</div>
                </div>
            )}

            {!hasMore && articles.length > 0 && !error && (
                <div className="grid-status">
                    <div className="status-text">همه اخبار نمایش داده شد</div>
                </div>
            )}
        </>
    );
}

export default NewsGrid;