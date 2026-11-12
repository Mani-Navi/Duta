import { useState, useEffect, useCallback } from 'react';
import CategoryBar from '../components/CategoryBar';
import NewsGrid from '../components/NewsGrid';
import HotNewsPanel from '../components/HotNewsPanel';
import { useUser } from '../context/UserContext';

function Home({ onOpenArticle, searchKeyword, refreshTrigger = 0 }) {
    const { isLoggedIn, openModal, notificationsEnabled, toggleNotifications } = useUser();
    const [feedTab, setFeedTab] = useState(() => (isLoggedIn ? 'myfeed' : 'newspaper'));
    const [activeCategory, setActiveCategory] = useState(null);
    const [hotRefreshKey, setHotRefreshKey] = useState(0);

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

    const handleRefreshHot = useCallback(() => {
        setHotRefreshKey(prev => prev + 1);
    }, []);

    return (
        <section aria-label="صفحه اصلی اخبار Duta">
            {!searchKeyword && (
                <div className="home-top-container">
                    <HotNewsPanel
                        onOpenArticle={onOpenArticle}
                        refreshTrigger={refreshTrigger + hotRefreshKey}
                    />

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

                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                            <button
                                type="button"
                                className="x-tune-btn"
                                onClick={toggleNotifications}
                                title={notificationsEnabled ? 'خاموش کردن اعلان خبر فوری' : 'روشن کردن اعلان مرورگر برای اخبار فوری'}
                                style={notificationsEnabled ? {
                                    borderColor: 'rgba(0, 186, 124, 0.45)',
                                    background: 'rgba(0, 186, 124, 0.12)',
                                    color: 'var(--green)'
                                } : undefined}
                            >
                                <svg className="x-svg-sm" viewBox="0 0 24 24">
                                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                                </svg>
                                <span>{notificationsEnabled ? 'اعلان فعال' : 'اعلان فوری'}</span>
                            </button>

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
                                <span>تنظیم علایق</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {!searchKeyword && feedTab === 'newspaper' && (
                <CategoryBar
                    activeCategory={activeCategory}
                    onSelectCategory={setActiveCategory}
                />
            )}

            <NewsGrid
                feedMode={searchKeyword ? 'search' : feedTab}
                activeCategory={activeCategory}
                onOpenArticle={onOpenArticle}
                searchKeyword={searchKeyword}
                refreshTrigger={refreshTrigger}
                onRefreshHot={handleRefreshHot}
            />
        </section>
    );
}

export default Home;