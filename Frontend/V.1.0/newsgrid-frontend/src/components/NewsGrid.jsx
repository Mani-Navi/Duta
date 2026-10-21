import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import NewsCard from './NewsCard';
import TelegramNewsCard from './TelegramNewsCard';
import NewsCardSkeleton from './NewsCardSkeleton';
import api from '../api/axiosConfig';

function NewsGrid({ activeCategory, onOpenArticle, searchKeyword }) {
    const [articles, setArticles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [hasNewArticles, setHasNewArticles] = useState(false);
    const [columnCount, setColumnCount] = useState(() =>
        window.innerWidth <= 440 ? 1 : window.innerWidth <= 768 ? 2 : window.innerWidth <= 1024 ? 3 : 4
    );

    const observer = useRef(null);
    const abortControllerRef = useRef(null);

    // ۱. ریسپانسیو ستون‌ها
    useEffect(() => {
        const handleResize = () => {
            const w = window.innerWidth;
            const newCol = w <= 440 ? 1 : w <= 768 ? 2 : w <= 1024 ? 3 : 4;
            setColumnCount(prev => (prev !== newCol ? newCol : prev));
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const buildEndpointUrl = useCallback((pageNum) => {
        if (searchKeyword) {
            return `/articles/search?keyword=${encodeURIComponent(searchKeyword)}&page=${pageNum}&size=20`;
        }
        if (activeCategory === 'breaking') {
            return `/articles/breaking?page=${pageNum}&size=20`;
        }
        if (activeCategory === 'telegram') {
            return `/articles/telegram?page=${pageNum}&size=20`;
        }
        if (activeCategory && activeCategory !== 'all') {
            return `/articles/category?name=${encodeURIComponent(activeCategory)}&page=${pageNum}&size=20`;
        }
        return `/articles?page=${pageNum}&size=20`;
    }, [activeCategory, searchKeyword]);

    // ۲. متد دریافت اخبار با قابلیت لغو درخواست قبلی
    const fetchArticles = useCallback(async (pageNum, isInitial = false) => {
        if (abortControllerRef.current) abortControllerRef.current.abort();
        abortControllerRef.current = new AbortController();

        try {
            if (isInitial) {
                setLoading(true);
                setArticles([]);
                setHasNewArticles(false);
            } else {
                setIsFetchingMore(true);
            }
            setError(null);

            const url = buildEndpointUrl(pageNum);
            const response = await api.get(url, { signal: abortControllerRef.current.signal });
            const data = response.data;
            const newItems = Array.isArray(data) ? data : (data?.content || []);

            setArticles(prev => {
                const combined = pageNum === 0 ? newItems : [...prev, ...newItems];
                const uniqueMap = new Map();
                combined.forEach(item => uniqueMap.set(item.id, item));
                return Array.from(uniqueMap.values());
            });

            setHasMore(Array.isArray(data) ? false : !data.last);
        } catch (err) {
            if (err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
                setError("خطا در دریافت اخبار");
            }
        } finally {
            setLoading(false);
            setIsFetchingMore(false);
        }
    }, [buildEndpointUrl]);

    // لود اولیه هنگام تغییر دسته‌بندی یا جستجو
    useEffect(() => {
        setPage(0);
        setHasMore(true);
        fetchArticles(0, true);
    }, [fetchArticles]);

    // لود صفحات بعدی هنگام افزایش page
    useEffect(() => {
        if (page > 0) {
            fetchArticles(page, false);
        }
    }, [page, fetchArticles]);

    // ۳. بررسی خودکار اخبار جدید هر ۵ دقیقه (طبق UCS-001)
    useEffect(() => {
        if (searchKeyword) return;

        const interval = setInterval(async () => {
            if (document.hidden || loading || isFetchingMore) return;
            try {
                const url = buildEndpointUrl(0);
                const res = await api.get(url);
                const latestItems = Array.isArray(res.data) ? res.data : (res.data?.content || []);
                if (latestItems.length > 0 && articles.length > 0 && latestItems[0].id !== articles[0].id) {
                    setHasNewArticles(true);
                }
            } catch {
                // خطای بررسی پس‌زمینه نادیده گرفته می‌شود
            }
        }, 5 * 60 * 1000);

        return () => clearInterval(interval);
    }, [searchKeyword, loading, isFetchingMore, buildEndpointUrl, articles]);

    // ۴. اسکرول بی‌نهایت با Sentinel در پایین گرید
    const sentinelRef = useCallback(node => {
        if (loading || isFetchingMore) return;
        if (observer.current) observer.current.disconnect();

        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                setPage(prev => prev + 1);
            }
        }, { rootMargin: '200px' });

        if (node) observer.current.observe(node);
    }, [loading, isFetchingMore, hasMore]);

    // ۵. توزیع متوازن در ستون‌ها
    const columns = useMemo(() => {
        const cols = Array.from({ length: columnCount }, () => []);
        articles.forEach((article, index) => {
            cols[index % columnCount].push(article);
        });
        return cols;
    }, [articles, columnCount]);

    const handleRefreshNewArticles = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setPage(0);
        setHasMore(true);
        fetchArticles(0, true);
    };

    if (error && articles.length === 0) {
        return (
            <div className="retry-container">
                <div className="status-text error">{error}</div>
                <button className="retry-btn" onClick={() => fetchArticles(0, true)}>تلاش مجدد</button>
            </div>
        );
    }

    if (!loading && !error && articles.length === 0) {
        return (
            <div className="grid-status">
                <div className="status-text">
                    {searchKeyword
                        ? `نتیجه‌ای برای «${searchKeyword}» یافت نشد`
                        : 'خبری در این دسته وجود ندارد'}
                </div>
            </div>
        );
    }

    return (
        <>
            {hasNewArticles && (
                <button
                    className="new-articles-bar"
                    onClick={handleRefreshNewArticles}
                    aria-label="نمایش اخبار جدید"
                >
                    <i className="ti ti-refresh" aria-hidden="true" />
                    اخبار جدید منتشر شد — نمایش
                </button>
            )}

            <div className="masonry-grid" dir="rtl">
                {loading ? (
                    Array.from({ length: columnCount }).map((_, i) => (
                        <div key={i} className="masonry-col">
                            <NewsCardSkeleton /><NewsCardSkeleton /><NewsCardSkeleton />
                        </div>
                    ))
                ) : (
                    columns.map((colItems, colIdx) => (
                        <div key={colIdx} className="masonry-col">
                            {colItems.map((article) => (
                                <div key={article.id}>
                                    {article.source?.sourceType === 'TELEGRAM' ?
                                        <TelegramNewsCard article={article} onOpen={onOpenArticle} /> :
                                        <NewsCard article={article} onOpen={onOpenArticle} />
                                    }
                                </div>
                            ))}
                        </div>
                    ))
                )}
            </div>

            {!loading && hasMore && (
                <div ref={sentinelRef} style={{ height: '1px', width: '100%' }} aria-hidden="true" />
            )}

            {isFetchingMore && (
                <div className="grid-status">
                    <div className="status-text">در حال بارگذاری اخبار بیشتر...</div>
                </div>
            )}
        </>
    );
}

export default NewsGrid;