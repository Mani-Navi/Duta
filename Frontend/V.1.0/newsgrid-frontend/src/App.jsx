import { useEffect, useState, useRef } from 'react';
import Navbar from './components/Navbar';
import BottomNav from './components/BottomNav';
import PriceTicker from './components/PriceTicker';
import Home from './pages/Home';
import About from './pages/About';
import ArticleDetail from './pages/ArticleDetail';
import Features from './pages/Features';
import Credibility from './pages/Credibility';
import AuthPage from './pages/AuthPage';
import { useAuth } from './hooks/useAuth';
import './App.css';

function App() {
    const [view, setView] = useState('home');
    const [selectedArticle, setSelectedArticle] = useState(null);
    const lang = 'fa';
    const [dark, setDark] = useState(() =>
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    const [searchKeyword, setSearchKeyword] = useState('');
    const scrollPositionRef = useRef(0);
    const { user, login, register, logout } = useAuth();

    const handleSearch = (keyword) => {
        setSearchKeyword(keyword);
        if (keyword) setView('home');
    };

    const openArticle = (article) => {
        scrollPositionRef.current = window.scrollY;
        setSelectedArticle(article);
        setView('detail');
        // تست ۱۴: جستجو رو ریست کن وقتی روی خبر کلیک میشه
        setSearchKeyword('');
        window.scrollTo(0, 0);
    };

    const goHome = () => {
        setView('home');
        requestAnimationFrame(() => {
            window.scrollTo(0, scrollPositionRef.current);
        });
    };

    const goAuth = () => {
        scrollPositionRef.current = window.scrollY;
        setView('auth');
        window.scrollTo(0, 0);
    };

    const backFromAuth = () => {
        setView('home');
        requestAnimationFrame(() => {
            window.scrollTo(0, scrollPositionRef.current);
        });
    };

    useEffect(() => {
        document.documentElement.setAttribute('dir', 'rtl');
        document.documentElement.setAttribute('lang', 'fa');
    }, [lang]);

    useEffect(() => {
        document.body.classList.toggle('dark', dark);
    }, [dark]);

    if (view === 'auth') {
        return (
            <div>
                <PriceTicker />
                <AuthPage onBack={backFromAuth} onLogin={login} onRegister={register} />
            </div>
        );
    }

    return (
        <div>
            <PriceTicker />

            <div className="desktop-only">
                <Navbar
                    lang={lang} dark={dark} view={view} user={user}
                    onToggleTheme={() => setDark(prev => !prev)}
                    onNavigate={(v) => v === 'home' ? goHome() : setView(v)}
                    onSearch={handleSearch}
                    onAuthClick={goAuth}
                    onLogout={logout}
                />
            </div>

            {view === 'detail' && (
                <div className="back-bar">
                    <button className="back-btn" onClick={goHome}>
                        <i className="ti ti-chevron-right" />
                        اخبار
                    </button>
                </div>
            )}

            <div style={{ display: view === 'home' ? 'block' : 'none' }}>
                <Home lang={lang} onOpenArticle={openArticle}
                      searchKeyword={searchKeyword} user={user} />
            </div>

            {view === 'detail' && selectedArticle && (
                <ArticleDetail lang={lang} article={selectedArticle}
                               user={user} onAuthClick={goAuth} />
            )}
            {view === 'features' && <Features lang={lang} />}
            {view === 'credibility' && <Credibility lang={lang} />}
            {view === 'about' && <About lang={lang} />}

            <div className="mobile-only">
                <BottomNav
                    view={view} dark={dark} user={user}
                    onNavigate={(v) => v === 'home' ? goHome() : setView(v)}
                    onSearch={handleSearch}
                    onToggleTheme={() => setDark(prev => !prev)}
                    onAuthClick={goAuth}
                    onLogout={logout}
                />
            </div>
        </div>
    );
}

export default App;
