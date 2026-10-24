import { useState, useEffect } from 'react';
import CategoryBar from '../components/CategoryBar';
import NewsGrid from '../components/NewsGrid';
import HotNewsPanel from '../components/HotNewsPanel';
import { useUser } from '../context/UserContext';

function Home({ onOpenArticle, searchKeyword, refreshTrigger }) {
    const { user, isLoggedIn, openModal } = useUser();
    const [feedTab, setFeedTab] = useState(() => (isLoggedIn ? 'myfeed' : 'newspaper'));
    const [activeCategory, setActiveCategory] = useState(null);

    useEffect(() => {
        if (!isLoggedIn && feedTab === 'myfeed') {
            setFeedTab('newspaper');
        } else if (isLoggedIn && feedTab === 'newspaper' && !activeCategory) {
            setFeedTab('myfeed');
        }
    }, [isLoggedIn]);

    const handleTabSelect = (tab) => {
        if (tab === 'myfeed' && !isLoggedIn) {
            openModal('auth', 'ورود به حساب برای مشاهده «فید من»');
            return;
        }
        setFeedTab(tab);
    };

    const favCats = Array.isArray(user?.favoriteCategories) ? user.favoriteCategories : [];
    const followedSrcs = Array.isArray(user?.followedSources) ? user.followedSources : [];

    return (
        <section aria-label="صفحه اصلی اخبار Duta">
            {!searchKeyword && (
                <div className="home-top-container">
                    <HotNewsPanel onOpenArticle={onOpenArticle} />

                    {/* نوار تب‌های خطی به سبک X (فید من | روزنامه) */}
                    <div className="x-tabs-bar">
                        <div className="x-tabs">
                            <button
                                type="button"
                                className={`x-tab ${feedTab === 'myfeed' ? 'active' : ''}`}
                                onClick={() => handleTabSelect('myfeed')}
                            >
                                فید من
                            </button>
                            <button
                                type="button"
                                className={`x-tab ${feedTab === 'newspaper' ? 'active' : ''}`}
                                onClick={() => handleTabSelect('newspaper')}
                            >
                                روزنامه
                            </button>
                        </div>

                        <button
                            type="button"
                            className="x-tune-btn"
                            onClick={() => openModal('prefs', 'شخصی‌سازی فید خبری')}
                        >
                            <svg className="x-svg-sm" viewBox="0 0 24 24">
                                <line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/>
                                <line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/>
                                <line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/>
                                <line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>
                            </svg>
                            <span>مدیریت منابع و علایق</span>
                        </button>
                    </div>

                    {/* نوار وضعیت فیلترهای فعال در تب «فید من» */}
                    {feedTab === 'myfeed' && isLoggedIn && (
                        <div className="x-context-strip">
                            <div className="x-context-chips">
                                {user?.locationCity && (
                                    <span className="x-ctx-chip">موقعیت: {user.locationCity}</span>
                                )}
                                {favCats.map(c => (
                                    <span key={c} className="x-ctx-chip">{c}</span>
                                ))}
                                {followedSrcs.slice(0, 4).map(s => (
                                    <span key={s} className="x-ctx-chip">{s}</span>
                                ))}
                                {!user?.locationCity && favCats.length === 0 && followedSrcs.length === 0 && (
                                    <span style={{ color: 'var(--label-3)', fontSize: '12px' }}>
                                        حالت کاوش فعال است — برای دقت بیشتر، حوزه‌های مورد علاقه خود را انتخاب کنید.
                                    </span>
                                )}
                            </div>
                            <span className="x-ctx-meta">ترکیب ۸۵٪ علایق شما + ۱۵٪ کشف</span>
                        </div>
                    )}

                    {/* نوار دسته‌بندی‌ها در تب «روزنامه» */}
                    {feedTab === 'newspaper' && (
                        <CategoryBar
                            activeCategory={activeCategory}
                            onSelectCategory={setActiveCategory}
                        />
                    )}
                </div>
            )}

            <NewsGrid
                feedMode={searchKeyword ? 'search' : feedTab}
                activeCategory={activeCategory}
                onOpenArticle={onOpenArticle}
                searchKeyword={searchKeyword}
                refreshTrigger={refreshTrigger}
            />
        </section>
    );
}

export default Home;