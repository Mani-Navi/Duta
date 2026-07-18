import { useEffect, useState } from 'react';
import Navbar from './components/Navbar';
import BottomNav from './components/BottomNav';
import PriceTicker from './components/PriceTicker';
import Home from './pages/Home';
import About from './pages/About';
import ArticleDetail from './pages/ArticleDetail';
import Features from './pages/Features';
import Credibility from './pages/Credibility';
import './App.css';

function App() {
    const [view, setView] = useState('home');
    const [selectedArticle, setSelectedArticle] = useState(null);
    const lang = 'fa';
    const [dark, setDark] = useState(() =>
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);

    const handleSearch = (keyword) => {
        setSearchKeyword(keyword);
        if (keyword) setView('home');
    };

    const openArticle = (article) => {
        setSelectedArticle(article);
        setView('detail');
        window.scrollTo(0, 0);
    };

    useEffect(() => {
        document.documentElement.setAttribute('dir', 'rtl');
        document.documentElement.setAttribute('lang', 'fa');
    }, [lang]);

    useEffect(() => {
        document.body.classList.toggle('dark', dark);
    }, [dark]);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div>
            {/* Ticker همیشه نشون داده میشه */}
            <PriceTicker />

            {/* دسکتاپ: navbar معمولی | موبایل: فقط لوگو */}
            {!isMobile ? (
                <Navbar
                    lang={lang}
                    dark={dark}
                    view={view}
                    onToggleTheme={() => setDark(prev => !prev)}
                    onNavigate={setView}
                    onSearch={handleSearch}
                />
            ) : (
                // موبایل: navbar حذف میشه
                null
            )}

            {/* دکمه بک — فقط توی صفحه detail */}
            {view === 'detail' && (
                <div className="back-bar">
                    <button className="back-btn" onClick={() => setView('home')}>
                        <i className="ti ti-chevron-right" />
                        اخبار
                    </button>
                </div>
            )}

            {view === 'home' && (
                <Home
                    lang={lang}
                    onOpenArticle={openArticle}
                    searchKeyword={searchKeyword}
                />
            )}

            {view === 'detail' && selectedArticle && (
                <ArticleDetail
                    lang={lang}
                    article={selectedArticle}
                />
            )}

            {view === 'features' && <Features lang={lang} />}
            {view === 'credibility' && <Credibility lang={lang} />}
            {view === 'about' && <About lang={lang} />}

            {/* موبایل: bottom nav */}
            {isMobile && (
                <BottomNav
                    view={view}
                    dark={dark}
                    onNavigate={setView}
                    onSearch={handleSearch}
                    onToggleTheme={() => setDark(prev => !prev)}
                />
            )}
        </div>
    );
}

export default App;
