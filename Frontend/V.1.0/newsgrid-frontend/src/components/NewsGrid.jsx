import { useState, useEffect, useRef, useCallback } from 'react';
import NewsCard from './NewsCard';
import api from '../api/axiosConfig';
import strings from '../strings/strings';

function NewsGrid({ lang, activeCategory, onOpenArticle }) {
    const [articles, setArticles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const observer = useRef(null);
    const t = strings[lang];

    // وقتی کتگوری عوض شد، از اول شروع کن
    useEffect(() => {
        setArticles([]);
        setPage(0);
        setHasMore(true);
    }, [activeCategory]);

    // هر بار page تغییر کرد، اخبار جدید بگیر
    useEffect(() => {
        fetchArticles();
    }, [page, activeCategory]);

    const fetchArticles = async () => {
        if (loading || !hasMore) return;

        try {
            setLoading(true);
            setError(null);

            let response;
            if (activeCategory === 0) {
                response = await api.get(`/articles?page=${page}&size=20`);
            } else {
                response = await api.get(
                    `/articles/category/${activeCategory}?page=${page}&size=20`
                );
            }

            const data = response.data;

            // اخبار جدید رو به لیست قبلی اضافه کن
            setArticles(prev => page === 0 ? data.content : [...prev, ...data.content]);

            // اگه صفحه آخر بود، دیگه request نزن
            setHasMore(!data.last);

        } catch (err) {
            setError(t.error);
        } finally {
            setLoading(false);
        }
    };

    // آخرین کارت رو observe کن
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

    if (error) {
        return (
            <div className="grid-status">
                <div className="status-text error">{error}</div>
            </div>
        );
    }

    if (!loading && articles.length === 0) {
        return (
            <div className="grid-status">
                <div className="status-text">
                    {lang === 'fa' ? 'خبری یافت نشد' : 'No news found'}
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="grid">
                {articles.map((article, index) => {
                    // آخرین کارت رو ref بده
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

            {/* loading indicator */}
            {loading && (
                <div className="grid-status">
                    <div className="status-text">{t.loading}</div>
                </div>
            )}

            {/* پیام پایان اخبار */}
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