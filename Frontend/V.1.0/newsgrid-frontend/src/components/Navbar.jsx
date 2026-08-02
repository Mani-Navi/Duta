import { useState, useEffect, useRef } from 'react';
import strings from '../strings/strings';
import PriceTicker from './PriceTicker';

function Navbar({ dark, view, onToggleTheme, onNavigate, onSearch }) {
    const t = strings.fa;
    const [searchOpen, setSearchOpen] = useState(false);
    const [keyword, setKeyword] = useState('');
    const navRef = useRef(null);
    const debounceRef = useRef(null);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && searchOpen) closeSearch();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [searchOpen]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (searchOpen && navRef.current && !navRef.current.contains(e.target)) {
                closeSearch();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [searchOpen]);

    const closeSearch = () => {
        setSearchOpen(false);
        setKeyword('');
        onSearch('');
    };

    const handleSearch = (e) => {
        const val = e.target.value;
        setKeyword(val);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            const trimmed = val.trim();
            if (trimmed.length >= 2) onSearch(trimmed);
            else if (trimmed.length === 0) onSearch('');
        }, 300);
    };

    const toggleSearch = () => {
        if (searchOpen) closeSearch();
        else setSearchOpen(true);
    };

    return (
        <header className="navbar" ref={navRef}>
            <div className="nav-row">
                {/* لوگوی جدید و رسمی Nitt با نقطه آبی‌رنگ و زیرعنوان News in Bites */}
                <div
                    className="logo"
                    onClick={() => onNavigate('home')}
                    role="button"
                    tabIndex={0}
                    aria-label="Nitt - News in Bites"
                    onKeyDown={(e) => e.key === 'Enter' && onNavigate('home')}
                >
                    <div className="logo-text">
                        N<span className="logo-dot">i</span>tt
                    </div>
                    <span className="logo-sub">News in Bites</span>
                </div>

                <div className="nav-center">
                    <PriceTicker />
                </div>

                <div className="nav-right">
                    {!searchOpen && (
                        <nav className="nav-links" aria-label="لینک‌های هدر">
                            <a onClick={() => onNavigate('features')} role="button" tabIndex={0}>{t.features}</a>
                            <a onClick={() => onNavigate('credibility')} role="button" tabIndex={0}>{t.credibility}</a>
                            <a onClick={() => onNavigate('about')} role="button" tabIndex={0}>{t.about}</a>
                        </nav>
                    )}

                    <div className="nav-tools">
                        {view !== 'detail' && (
                            <button
                                className="tool-btn theme-toggle"
                                onClick={toggleSearch}
                                aria-label={searchOpen ? 'بستن جستجو' : 'جستجو'}
                                aria-expanded={searchOpen}
                            >
                                {searchOpen ? '✕' : '🔍'}
                            </button>
                        )}
                        <button
                            className={`toggle-btn ${dark ? 'is-dark' : 'is-light'}`}
                            onClick={onToggleTheme}
                            aria-label={dark ? 'تغییر به حالت روشن' : 'تغییر به حالت تاریک'}
                        >
                            {dark ? '🌙' : '☀️'}
                        </button>
                    </div>
                </div>
            </div>

            {searchOpen && (
                <div className="search-bar" role="search">
                    <label htmlFor="search-input" className="sr-only">جستجو در اخبار</label>
                    <input
                        id="search-input"
                        autoFocus
                        type="search"
                        value={keyword}
                        onChange={handleSearch}
                        placeholder="جستجو در اخبار و منابع..."
                        className="search-input"
                    />
                </div>
            )}
        </header>
    );
}

export default Navbar;