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
    const [columnCount, setColumnCount] = useState(() => (window.innerWidth <= 440 ? 1 : window.innerWidth <= 768 ? 2 : window.innerWidth <= 1024 ? 3 : 4));

    const observer = useRef(null);
    const abortControllerRef = useRef(null);

    // ۱. ریسپانسیو ستون‌ها
    useEffect(() => {
        const handleResize = () => {
            const w = window.innerWidth;
            const newCol = w <= 440 ? 1 : w <= 768 ? 2 : w <= 1024 ? 3 : 4;
            if (newCol !== columnCount) setColumnCount(newCol);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [columnCount]);

    // ۲. متد دریافت اخبار با قابلیت لغو درخواست قبلی (رفع کندی سوییچ)
    const fetchArticles = useCallback(async (pageNum, isInitial = false) => {
        if (abortControllerRef.current) abortControllerRef.current.abort();
        abortControllerRef.current = new AbortController();

        try {
            if (isInitial) {
                setLoading(true);
                setArticles([]);
            } else {
                setIsFetchingMore(true);
            }
            setError(null);

            let url = `/articles?page=${pageNum}&size=20`;
            if (searchKeyword) url = `/articles/search?keyword=${encodeURIComponent(searchKeyword)}&page=${pageNum}&size=20`;
            else if (activeCategory === 'breaking') url = `/articles/breaking?page=${pageNum}&size=20`;
            else if (activeCategory === 'telegram') url = `/articles/telegram?page=${pageNum}&size=20`;
            else if (activeCategory && activeCategory !== 'all') url = `/articles/category?name=${encodeURIComponent(activeCategory)}&page=${pageNum}&size=20`;

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
            if (err.name !== 'CanceledError') {
                setError("خطا در دریافت اخبار");
            }
        } finally {
            setLoading(false);
            setIsFetchingMore(false);
        }
    }, [activeCategory, searchKeyword]);

    useEffect(() => {
        setPage(0);
        setHasMore(true);
        fetchArticles(0, true);
    }, [activeCategory, searchKeyword, fetchArticles]);

    // ۳. اسکرول بی‌نهایت ضد باگ
    const lastCardRef = useCallback(node => {
        if (loading || isFetchingMore) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                setPage(prev => {
                    const next = prev + 1;
                    fetchArticles(next);
                    return next;
                });
            }
        });
        if (node) observer.current.observe(node);
    }, [loading, isFetchingMore, hasMore, fetchArticles]);

    // ۴. توزیع فوق سریع در ستون‌ها (حذف کامل منطق تبلیغات)
    const columns = useMemo(() => {
        const cols = Array.from({ length: columnCount }, () => []);
        articles.forEach((article, index) => {
            cols[index % columnCount].push(article);
        });
        return cols;
    }, [articles, columnCount]);

    if (error && articles.length === 0) return (
        <div className="retry-container">
            <div className="status-text error">{error}</div>
            <button className="retry-btn" onClick={() => fetchArticles(0, true)}>تلاش مجدد</button>
        </div>
    );

    return (
        <>
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
                            {colItems.map((article, idx) => {
                                // محاسبه اینکه آیا این آخرین کارت در کل گرید است
                                const isLast = colIdx === (columnCount - 1) && idx === (colItems.length - 1);
                                return (
                                    <div key={article.id} ref={isLast ? lastCardRef : null}>
                                        {article.source?.sourceType === 'TELEGRAM' ?
                                            <TelegramNewsCard article={article} onOpen={onOpenArticle} /> :
                                            <NewsCard article={article} onOpen={onOpenArticle} />
                                        }
                                    </div>
                                );
                            })}
                        </div>
                    ))
                )}
            </div>
            {isFetchingMore && <div className="grid-status"><div className="status-text">در حال بارگذاری اخبار بیشتر...</div></div>}
        </>
    );
}

export default NewsGrid;