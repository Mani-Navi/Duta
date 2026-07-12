import {useEffect, useState} from 'react';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import ArticleDetail from './pages/ArticleDetail';
import Features from './pages/Features';
import Credibility from './pages/Credibility';
import './App.css';

function App() {
    const [view, setView] = useState('home');
    const [selectedArticle, setSelectedArticle] = useState(null);
    const lang = 'fa';
    const [dark, setDark] = useState(window.matchMedia("(prefers-color-scheme: dark)").matches);


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
            <Navbar
                lang={lang}
                dark={dark}
                view={view}
                onToggleLang={() => setLang(lang === 'fa' ? 'en' : 'fa')}
                onToggleTheme={() => setDark(!dark)}
                onNavigate={setView}
            />

            {view === 'home' && (
                <Home
                    lang={lang}
                    onOpenArticle={openArticle}
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
        </div>
    );
}

export default App;