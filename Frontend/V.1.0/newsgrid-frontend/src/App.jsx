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

const DEFAULT_TITLE = 'Duta — دو نگاه، یک حقیقت | پلتفرم هوشمند تجمیع و سنجش اعتبار اخبار';
const DEFAULT_DESC = 'Duta (دوتا) — پلتفرم هوشمند تجمیع، خوشه‌بندی و سنجش اعتبار اخبار فارسی. اخبار فوری، سیاسی، اقتصادی، ورزشی و تکنولوژی را با امتیاز اعتبار منابع دنبال کنید.';

function syncDocumentSeoTags({ title, description, canonicalUrl }) {
    document.title = title || DEFAULT_TITLE;

    const setMeta = (selector, content) => {
        const el = document.querySelector(selector);
        if (el && content) el.setAttribute('content', content);
    };

    setMeta('meta[name="description"]', description || DEFAULT_DESC);
    setMeta('meta[property="og:title"]', title || DEFAULT_TITLE);
    setMeta('meta[property="og:description"]', description || DEFAULT_DESC);
    setMeta('meta[property="og:url"]', canonicalUrl || 'https://duta.ir/');

    let canonicalEl = document.querySelector('link[rel="canonical"]');
    if (!canonicalEl) {
        canonicalEl = document.createElement('link');
        canonicalEl.setAttribute('rel', 'canonical');
        document.head.appendChild(canonicalEl);
    }
    canonicalEl.setAttribute('href', canonicalUrl || 'https://duta.ir/');
}

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

        const isNumericId = /^\d+$/.test(slug);
        const endpoint = isNumericId
            ? `/articles/${slug}`
            : `/articles/slug/${encodeURIComponent(slug)}`;

        api.get(endpoint)
            .then(res => {
                if (!isMounted) return;
                const data = res.data;
                setArticle(data);
                if (data?.title) {
                    const canonicalSlug = data.slug || data.id;
                    const score = data.cluster?.credibilityScore ?? data.source?.credibility ?? 50;
                    const seoDesc = data.description
                        ? `امتیاز اعتبار: ${score}٪ | ${data.description}`
                        : `امتیاز اعتبار: ${score}٪ | ${data.title}`;

                    syncDocumentSeoTags({
                        title: `${data.title} | Duta`,
                        description: seoDesc,
                        canonicalUrl: `https://duta.ir/article/${canonicalSlug}`
                    });
                }
            })
            .catch(async () => {
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
        };
    }, [slug, navigate, location.state]);

    const handleBack = () => {
        if (window.history.state && window.history.state.idx > 0) {
            navigate(-1);
        } else {
            navigate('/');
        }
    };

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
                <button className="back-btn" onClick={handleBack} aria-label="بازگشت به اخبار">
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

    useEffect(() => {
        if (window.gtag) {
            window.gtag('config', 'G-5ZTGQ5ZVBJ', {
                page_path: location.pathname + location.search,
            });
        }

        // Dynamic SEO Title & Canonical for static routes
        if (location.pathname === '/') {
            syncDocumentSeoTags({
                title: DEFAULT_TITLE,
                description: DEFAULT_DESC,
                canonicalUrl: 'https://duta.ir/'
            });
        } else if (location.pathname === '/features') {
            syncDocumentSeoTags({
                title: 'ویژگی‌های پلتفرم خبری Duta | خوشه‌بندی و سنجش اعتبار خبر',
                description: 'آشنایی با امکانات Duta: امتیاز اعتبار زنده، مقایسه چند منبع، فیلتر دسته‌بندی و هشدار شایعه.',
                canonicalUrl: 'https://duta.ir/features'
            });
        } else if (location.pathname === '/credibility') {
            syncDocumentSeoTags({
                title: 'الگوریتم امتیاز اعتبار خبر در Duta | تشخیص خبر معتبر از شایعه',
                description: 'نحوه کار الگوریتم امتیازدهی بیزین و خوشه‌بندی اخبار در Duta برای سنجش اعتبار رسانه‌ها.',
                canonicalUrl: 'https://duta.ir/credibility'
            });
        } else if (location.pathname === '/about') {
            syncDocumentSeoTags({
                title: 'درباره Duta — دو نگاه، یک حقیقت',
                description: 'درباره پلتفرم تجمیع و اعتبارسنجی اخبار فارسی Duta و راه‌های ارتباطی.',
                canonicalUrl: 'https://duta.ir/about'
            });
        }
    }, [location]);

    const isDetail = location.pathname.startsWith('/article/');
    const view = isDetail ? 'detail'
        : location.pathname === '/features' ? 'features'
            : location.pathname === '/credibility' ? 'credibility'
                : location.pathname === '/about' ? 'about'
                    : 'home';

    const handleSearch = useCallback((keyword) => {
        setSearchKeyword(prev => {
            if (prev !== keyword && keyword) {
                navigate('/');
            }
            return keyword;
        });
    }, [navigate]);

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
                    <a
                        href="/"
                        className="logo"
                        dir="ltr"
                        onClick={(e) => { e.preventDefault(); handleNavigate('home'); }}
                        aria-label="Duta - دو نگاه، یک حقیقت"
                    >
                        <DutaLogo />
                        <span className="logo-text">Duta</span>
                        <span className="logo-divider" aria-hidden="true" />
                        <span className="logo-sub" dir="rtl">دو نگاه، یک حقیقت</span>
                    </a>
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