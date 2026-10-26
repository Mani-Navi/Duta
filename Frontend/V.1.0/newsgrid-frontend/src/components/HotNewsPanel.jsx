import { useState, useEffect, useCallback } from 'react';
import api from '../api/axiosConfig';
import { useUser } from '../context/UserContext';
import { getArticleScore, getArticleSourceCount, getBadgeClass } from '../utils/articleHelpers';

const HOT_REFRESH_INTERVAL_MS = 5 * 60 * 1000; // هر ۵ دقیقه

function HotNewsPanel({ onOpenArticle, refreshTrigger = 0 }) {
    const [hotArticles, setHotArticles] = useState([]);
    const { getReactionData } = useUser();

    const fetchHotArticles = useCallback(() => {
        if (document.hidden) return;
        api.get('/articles/hot')
            .then(res => {
                if (Array.isArray(res.data) && res.data.length > 0) {
                    setHotArticles(res.data.slice(0, 4));
                }
            })
            .catch(() => {});
    }, []);

    // ۱. بارگذاری اولیه و همگام‌سازی فوری هنگام کلیک روی دکمه «اخبار جدید منتشر شد» یا تغییر تنظیمات
    useEffect(() => {
        fetchHotArticles();
    }, [fetchHotArticles, refreshTrigger]);

    // ۲. به‌روزرسانی خودکار هر ۵ دقیقه در پس‌زمینه + هنگام بازگشت کاربر به تب سایت
    useEffect(() => {
        const interval = setInterval(fetchHotArticles, HOT_REFRESH_INTERVAL_MS);

        const handleVisibilityChange = () => {
            if (!document.hidden) {
                fetchHotArticles();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [fetchHotArticles]);

    if (hotArticles.length === 0) return null;

    return (
        <section className="x-trending-panel" aria-label="اخبار داغ روز">
            <div className="x-trending-header">
                <div className="x-trending-title">
                    <svg className="x-svg" style={{ color: 'var(--blue)' }} viewBox="0 0 24 24">
                        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                        <polyline points="17 6 23 6 23 12" />
                    </svg>
                    <span>اخبار داغ روز</span>
                </div>
                <span className="x-trending-sub">بر اساس شاخص پوشش رسانه‌ها و تعامل کاربران</span>
            </div>

            <div className="x-trending-grid">
                {hotArticles.map((article, idx) => {
                    const score = getArticleScore(article);
                    const sourceCount = getArticleSourceCount(article);
                    const badgeCls = getBadgeClass(score);
                    const rankStr = String(idx + 1).padStart(2, '0');
                    const { likeCount, hotCount, doubtCount } = getReactionData(article);
                    const reactionsCount = likeCount + hotCount + doubtCount;
                    const articleHref = `/article/${encodeURIComponent(article.slug || article.id)}`;

                    return (
                        <article
                            key={article.id}
                            className="x-trending-item"
                            onClick={() => onOpenArticle(article)}
                        >
                            <div>
                                <div className="x-trending-top">
                                    <span>
                                        {article.category || 'اخبار'} · پوشش {sourceCount} منبع
                                    </span>
                                    <span className="x-rank-num">{rankStr}</span>
                                </div>
                                <h3 className="x-trending-headline">
                                    <a
                                        href={articleHref}
                                        onClick={(e) => e.preventDefault()}
                                        style={{ color: 'inherit', textDecoration: 'none' }}
                                    >
                                        {article.title}
                                    </a>
                                </h3>
                            </div>

                            <div className="x-trending-foot">
                                <span>
                                    {article.source?.name}
                                    {reactionsCount > 0 ? ` · ${reactionsCount} بازخورد` : ''}
                                </span>
                                <span className={`badge ${badgeCls}`}>{score}% اعتبار</span>
                            </div>
                        </article>
                    );
                })}
            </div>
        </section>
    );
}

export default HotNewsPanel;