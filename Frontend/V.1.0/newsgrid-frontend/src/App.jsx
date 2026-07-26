import { useEffect, useState, useRef } from 'react';
import { Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import BottomNav from './components/BottomNav';
import PriceTicker from './components/PriceTicker';
import Home from './pages/Home';
import About from './pages/About';
import ArticleDetail from './pages/ArticleDetail';
import Features from './pages/Features';
import Credibility from './pages/Credibility';
import api from './api/axiosConfig';
import './App.css';

// ── Wrapper برای ArticleDetail — article رو از API میگیره ──
function ArticleDetailPage({ lang }) {
    const { id } = useParams();
    const navigate = useNavigate();
    const [article, setArticle] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get(`/articles/${id}`)
            .then(res => setArticle(res.data))
            .catch(() => navigate('/'))
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) return (
        <div className="grid-status">
            <div className="status-text">در حال بارگذاری...</div>
        </div>
    );

    if (!article) return null;

    return (
        <>
            <div className="back-bar">
                <button className="back-btn" onClick={() => navigate(-1)}>
                    <i className="ti ti-chevron-right" />
                    اخبار
                </button>
            </div>
            <ArticleDetail lang={lang} article={article} />
        </>
    );
}

// ── App اصلی ──
function AppLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const lang = 'fa';
    const [dark, setDark] = useState(() =>
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    const [searchKeyword, setSearchKeyword] = useState('');
    const scrollPositionRef = useRef(0);
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

    const goHome = () => {
        navigate('/');
    };

    const handleNavigate = (v) => {
        if (v === 'home') goHome();
        else navigate(`/${v}`);
    };

    useEffect(() => {
        if (view === "home" && restoreScroll !== null) {
            const timer = setTimeout(() => {
                window.scrollTo({
                    top: restoreScroll,
                    behavior: "instant"
                });
            }, 100);

            return () => clearTimeout(timer);
        }
    }, [view, restoreScroll]);

    useEffect(() => {
        document.documentElement.setAttribute('dir', 'rtl');
        document.documentElement.setAttribute('lang', 'fa');
    }, []);

    useEffect(() => {
        document.body.classList.toggle('dark', dark);
    }, [dark]);

    return (
        <div>
            <PriceTicker />

            <div className="desktop-only">
                <Navbar
                    lang={lang} dark={dark} view={view}
                    onToggleTheme={() => setDark(prev => !prev)}
                    onNavigate={handleNavigate}
                    onSearch={handleSearch}
                />
            </div>

            {/* Home همیشه mount هست — فقط مخفی میشه */}
            <div style={{ display: view === 'home' ? 'block' : 'none' }}>
                <Home lang={lang} onOpenArticle={openArticle} searchKeyword={searchKeyword} />
            </div>

            <Routes>
                <Route path="/" element={null} />
                <Route path="/article/:slug" element={<ArticleDetailPage lang={lang} />} />
                <Route path="/features" element={<Features lang={lang} />} />
                <Route path="/credibility" element={<Credibility lang={lang} />} />
                <Route path="/about" element={<About lang={lang} />} />
            </Routes>

            <div className="mobile-only">
                <BottomNav
                    view={view} dark={dark}
                    onNavigate={handleNavigate}
                    onSearch={handleSearch}
                    onToggleTheme={() => setDark(prev => !prev)}
                />
            </div>
        </div>
    );
}

export default AppLayout;
