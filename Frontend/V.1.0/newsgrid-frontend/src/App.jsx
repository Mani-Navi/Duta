import { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import { Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import BottomNav from './components/BottomNav';
import PriceTicker from './components/PriceTicker';
import Home from './pages/Home';
import ErrorBoundary from './components/ErrorBoundary';
import DutaLogo from './components/DutaLogo';
import api from './api/axiosConfig';
import './App.css';

const ArticleDetail = lazy(() => import('./pages/ArticleDetail'));
const Features = lazy(() => import('./pages/Features'));
const Credibility = lazy(() => import('./pages/Credibility'));
const About = lazy(() => import('./pages/About'));

function ArticleDetailPage() {
    const { slug } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const isBreakingInit = location.state?.breaking || false;

    const [article, setArticle] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        setArticle(null);
        setLoading(true);

        // BUGFIX 1: پشتیبانی همزمان از Slug و ID عددی + Encode کردن حروف فارسی
        const isNumericId = /^\d+$/.test(slug);
        const endpoint = isNumericId
            ? `/articles/${slug}`
            : `/articles/slug/${encodeURIComponent(slug)}`;

        api.get(endpoint)
            .then(res => {
                if (!isMounted) return;
                setArticle(res.data);
                if (res.data?.title) {
                    document.title = `${res.data.title} | Duta`;
                }
            })
            .catch(async () => {
                // Fallback: اگر با اسلاگ پیدا نشد ولی از طریق state مقاله را داریم، نمایش بده
                if (isMounted && location.state?.articleData) {
                    setArticle(location.state.articleData);
                } else if (isMounted) {
                    navigate('/', { replace: true });
                }
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => {
            isMounted = false;
            document.title = 'Duta — دو نگاه، یک حقیقت';
        };
    }, [slug, navigate, location.state]);

    if (loading) {
        return (
            <div className="nitt-loading-box">
                <DutaLogo loading={true} breaking={isBreakingInit} />
                <span className="nitt-loading-text">در حال تحلیل و بارگذاری خبر...</span>
            </div>
        );
    }

    if (!article) return null;

    return (
        <main id="main-content" aria-label="محتوای خبر">
            <div className="back-bar">
                <button className="back-btn" onClick={() => navigate(-1)} aria-label="بازگشت به اخبار">
                    <i className="ti ti-chevron-right" aria-hidden="true" />
                    بازگشت به اخبار
                </button>
            </div>
            <ArticleDetail article={article} />
        </main>
    );
}

function AppLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const [dark, setDark] = useState(() =>
        window.matchMedia("(prefers-color-scheme: dark)").matches
    );
    const [searchKeyword, setSearchKeyword] = useState('');
    const [restoreScroll, setRestoreScroll] = useState(null);

    // --- ANALYTICS_START: Route Change Tracking ---
    useEffect(() => {
        if (window.gtag) {
            window.gtag('config', 'G-5ZTGQ5ZVBJ', {
                page_path: location.pathname + location.search,
            });
        }
    }, [location]);
    // --- ANALYTICS_END ---

    const isDetail = location.pathname.startsWith('/article/');
    const view = isDetail ? 'detail'
        : location.pathname === '/features' ? 'features'
            : location.pathname === '/credibility' ? 'credibility'
                : location.pathname === '/about' ? 'about'
                    : 'home';

    // BUGFIX 2: تثبیت رفرنس تابع سرچ با useCallback و جلوگیری از ریدایرکت ناخواسته به صفحه اصلی
    const handleSearch = useCallback((keyword) => {
        setSearchKeyword(prev => {
            if (prev !== keyword && keyword) {
                navigate('/');
            }
            return keyword;
        });
    }, [navigate]);

    // BUGFIX 3: عدم پاک کردن ناگهانی استیت سرچ در لحظه کلیک و ارسال دیتای خبر به عنوان پشتیبان
    const openArticle = useCallback((article) => {
        setRestoreScroll(window.scrollY);
        const targetSlug = article.slug || article.id;
        navigate(`/article/${targetSlug}`, {
            state: {
                breaking: article.breaking,
                articleData: article
            }
        });
    }, [navigate]);

    const handleNavigate = useCallback((v) => {
        if (v === 'home') {
            setRestoreScroll(0);
            setSearchKeyword('');
            window.scrollTo(0, 0);
            navigate('/');
        } else {
            navigate(`/${v}`);
        }
    }, [navigate]);

    useEffect(() => {
        if (location.pathname === '/') {
            if (restoreScroll !== null) {
                window.scrollTo({ top: restoreScroll, behavior: 'instant' });
            }
        } else {
            window.scrollTo(0, 0);
        }
    }, [location.pathname, restoreScroll]);

    useEffect(() => {
        document.documentElement.setAttribute('dir', 'rtl');
        document.documentElement.setAttribute('lang', 'fa');
    }, []);

    useEffect(() => {
        document.body.classList.toggle('dark', dark);
    }, [dark]);

    return (
        <ErrorBoundary>
            <div>
                <header className="mobile-only mobile-header-centered">
                    <div
                        className="logo"
                        dir="ltr"
                        onClick={() => handleNavigate('home')}
                        role="button"
                        tabIndex={0}
                        aria-label="Duta - دو نگاه، یک حقیقت"
                    >
                        <DutaLogo />
                        <span className="logo-text">Duta</span>
                        <span className="logo-divider" aria-hidden="true" />
                        <span className="logo-sub" dir="rtl">دو نگاه، یک حقیقت</span>
                    </div>
                </header>

                <div className="mobile-only" style={{ padding: '6px 0', background: 'var(--navbar-bg)' }}>
                    <PriceTicker />
                </div>

                <div className="desktop-only">
                    <Navbar
                        dark={dark} view={view}
                        onToggleTheme={() => setDark(prev => !prev)}
                        onNavigate={handleNavigate}
                        onSearch={handleSearch}
                    />
                </div>

                <main id="main-content" aria-label="محتوای اصلی اخبار">
                    <div style={{ display: view === 'home' ? 'block' : 'none' }}>
                        <Home onOpenArticle={openArticle} searchKeyword={searchKeyword} />
                    </div>

                    <Suspense fallback={
                        <div className="nitt-loading-box">
                            <DutaLogo loading={true} />
                            <span className="nitt-loading-text">در حال بارگذاری...</span>
                        </div>
                    }>
                        <Routes>
                            <Route path="/" element={null} />
                            <Route path="/article/:slug" element={<ArticleDetailPage />} />
                            <Route path="/features" element={<Features />} />
                            <Route path="/credibility" element={<Credibility />} />
                            <Route path="/about" element={<About />} />
                        </Routes>
                    </Suspense>
                </main>

                <footer className="footer-note" style={{ padding: '20px', textAlign: 'center', opacity: 0.7 }} role="contentinfo">
                    تمامی حقوق برای Duta محفوظ است © {new Date().getFullYear()}
                </footer>

                <div className="mobile-only">
                    <BottomNav
                        view={view} dark={dark}
                        onNavigate={handleNavigate}
                        onSearch={handleSearch}
                        onToggleTheme={() => setDark(prev => !prev)}
                    />
                </div>
            </div>
        </ErrorBoundary>
    );
}

export default AppLayout;