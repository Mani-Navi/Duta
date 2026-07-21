import { useState, useEffect, useRef, useCallback } from 'react';
import NewsCard from './NewsCard';
import api from '../api/axiosConfig';
import strings from '../strings/strings';

// هر ۵ دقیقه auto-refresh
const AUTO_REFRESH_MS = 5 * 60 * 1000;

function NewsGrid({ lang, activeCategory, onOpenArticle, searchKeyword }) {
    const [articles, setArticles] = useState([]);
    const [newCount, setNewCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const observer = useRef(null);
    const latestIdRef = useRef(null);
    const t = strings[lang];

    useEffect(() => {
        setArticles([]);
        setPage(0);
        setHasMore(true);
        setNewCount(0);
        latestIdRef.current = null;
    }, [activeCategory, searchKeyword]);

    useEffect(() => {
        fetchArticles();
    }, [page, activeCategory, searchKeyword]);

    // auto-refresh — هر ۵ دقیقه چک کن اخبار جدید داریم
    useEffect(() => {
        const interval = setInterval(async () => {
            if (!latestIdRef.current) return;
            try {
                const res = await fetchUrl(0);
                const newArticles = res.data.content;
                const latestId = latestIdRef.current;
                const fresh = newArticles.filter(a => a.id > latestId);
                if (fresh.length > 0) {
                    setNewCount(fresh.length);
                }
            } catch {}
        }, AUTO_REFRESH_MS);

        return () => clearInterval(interval);
    }, [activeCategory, searchKeyword]);

    const fetchUrl = (p) => {
        if (searchKeyword) {
            return api.get(`/articles/search?keyword=${encodeURIComponent(searchKeyword)}&page=${p}&size=20`);
        } else if (activeCategory === 'breaking') {
            return api.get(`/articles/breaking?page=${p}&size=20`);
        } else if (activeCategory === 0) {
            return api.get(`/articles?page=${p}&size=20`);
        } else {
            return api.get(`/articles/category/${activeCategory}?page=${p}&size=20`);
        }
    };

    const fetchArticles = async () => {
        if (loading || !hasMore) return;
        try {
            setLoading(true);
            setError(null);
            const response = await fetchUrl(page);
            const data = response.data;

            setArticles(prev => {
                const next = page === 0 ? data.content : [...prev, ...data.content];
                // بالاترین ID رو ذخیره کن
                if (next.length > 0) {
                    latestIdRef.current = Math.max(...next.map(a => a.id));
                }
                return next;
            });

            setHasMore(!data.last);
        } catch {
            setError(t.error);
        } finally {
            setLoading(false);
        }
    };

    // کاربر روی دکمه «اخبار جدید» زد
    const loadNewArticles = () => {
        setArticles([]);
        setPage(0);
        setHasMore(true);
        setNewCount(0);
        latestIdRef.current = null;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const lastCardRef = useCallback(node => {
        if (loading) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                setPage(prev => prev + 1);
            }
        });
        if (node) observer.current.observe(node);
    }, [loading, hasMore]);

    if (error) return (
        <div className="grid-status">
            <div className="status-text error">{error}</div>
        </div>
    );

    if (!loading && articles.length === 0) return (
        <div className="grid-status">
            <div className="status-text">
                {lang === 'fa' ? 'خبری یافت نشد' : 'No news found'}
            </div>
        </div>
    );

    return (
        <>
            {/* دکمه اخبار جدید */}
            {newCount > 0 && (
                <div className="new-articles-bar" onClick={loadNewArticles}>
                    <i className="ti ti-arrow-up" />
                    {newCount} خبر جدید
                </div>
            )}

            <div className="grid">
                {articles.map((article, index) => {
                    const isLast = index === articles.length - 1;
                    return (
                        <div key={article.id} ref={isLast ? lastCardRef : null}>
                            <NewsCard
                                article={article}
                                lang={lang}
                                onOpen={onOpenArticle}
                            />
                        </div>
                    );
                })}
            </div>

            {loading && (
                <div className="grid-status">
                    <div className="status-text">{t.loading}</div>
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
