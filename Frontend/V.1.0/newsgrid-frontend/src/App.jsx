import { useEffect, useState, lazy, Suspense } from 'react';
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

// Helper function to animate the new D + Eye Favicon with base color #1a1a1a
const updateFavicon = (pupilColor = '#1a1a1a', dColor = '#1a1a1a') => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
      <path d="M 96 64 L 256 64 C 362 64, 448 150, 448 256 C 448 362, 362 448, 256 448 L 96 448 Z" fill="${dColor}" />
      <path d="M 128 256 C 192 160, 320 160, 384 256 C 320 352, 192 352, 128 256 Z" fill="#FFFFFF" />
      <circle cx="256" cy="256" r="56" fill="${pupilColor}" />
    </svg>`;
    const encoded = `data:image/svg+xml;base64,${btoa(svg)}`;
    let link = document.querySelector("link[rel*='icon']");
    if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
    }
    link.href = encoded;
};

function ArticleDetailPage() {
    const { slug } = useParams();
    const navigate = useNavigate();
    const [article, setArticle] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        api.get(`/articles/slug/${slug}`)
            .then(res => {
                setArticle(res.data);
                if (res.data?.title) {
                    document.title = `${res.data.title} | Duta`;
                }
            })
            .catch(() => {
                navigate('/', { replace: true });
            })
            .finally(() => setLoading(false));

        return () => {
            document.title = 'Duta — دو نگاه، یک حقیقت';
        };
    }, [slug, navigate]);

    if (loading) {
        return (
            <div className="nitt-loading-box">
                <DutaLogo loading={true} />
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

    const isDetail = location.pathname.startsWith('/article/');
    const view = isDetail ? 'detail'
        : location.pathname === '/features' ? 'features'
            : location.pathname === '/credibility' ? 'credibility'
                : location.pathname === '/about' ? 'about'
                    : 'home';

    const handleSearch = (keyword) => {
        setSearchKeyword(keyword);
        if (keyword) navigate('/');
    };

    const openArticle = (article) => {
        setRestoreScroll(window.scrollY);
        setSearchKeyword('');
        navigate(`/article/${article.slug || article.id}`);
    };

    const handleNavigate = (v) => {
        if (v === 'home') {
            setRestoreScroll(0);
            window.scrollTo(0, 0);
            navigate('/');
        } else {
            navigate(`/${v}`);
        }
    };

    // Favicon Mouse Hover (MouseEnter / MouseLeave) Event Listener with #1a1a1a base color
    useEffect(() => {
        const handleMouseEnter = () => updateFavicon('#A8292B', '#1a1a1a'); // Red pupil on Mouse Hover
        const handleMouseLeave = () => updateFavicon('#1a1a1a', '#1a1a1a'); // Base color #1a1a1a

        window.addEventListener('mouseenter', handleMouseEnter);
        window.addEventListener('mouseleave', handleMouseLeave);

        updateFavicon('#1a1a1a', '#1a1a1a'); // Initial #1a1a1a

        return () => {
            window.removeEventListener('mouseenter', handleMouseEnter);
            window.removeEventListener('mouseleave', handleMouseLeave);
        };
    }, []);

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
                    <div onClick={() => handleNavigate('home')} role="button" tabIndex={0} aria-label="Duta - خانه">
                        <DutaLogo />
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