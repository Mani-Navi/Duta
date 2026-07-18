import {useEffect, useState} from 'react';
import Navbar from './components/Navbar';
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
    const [searchKeyword, setSearchKeyword] = useState('')

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
    return (
        <div>
            {/* Ticker همیشه نشون داده میشه */}
            <PriceTicker />

            <Navbar
                lang={lang}
                dark={dark}
                view={view}
                onToggleTheme={() => setDark(prev => !prev)}
                onNavigate={setView}
                onSearch={handleSearch}
            />

            {/* دکمه بک — فقط توی صفحه detail، زیر navbar */}
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

            {view === 'features' && (
                <Features lang={lang} />
            )}

            {view === 'credibility' && (
                <Credibility lang={lang} />
            )}

            {view === 'about' && <About lang={lang} />}
        </div>
    );
}

export default App;