import { useState, useEffect, useRef } from 'react';
import strings from '../strings/strings';
import PriceTicker from './PriceTicker';
import DutaLogo from './DutaLogo';

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
            // BUGFIX: فقط زمانی با کلیک بیرون سرچ را ببند که کاربر هنوز عبارتی تایپ نکرده باشد
            // تا هنگام کلیک روی کارت‌های نتایج جستجو، لیست نتایج قبل از باز شدن خبر پاک نشود
            if (searchOpen && !keyword.trim() && navRef.current && !navRef.current.contains(e.target)) {
                closeSearch();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [searchOpen, keyword]);

    const closeSearch = () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
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
                {/* Duta Luxury Integrated Brand Header: Eye Logo + Duta | دو نگاه، یک حقیقت */}
                <div
                    className="logo"
                    dir="ltr"
                    onClick={() => { closeSearch(); onNavigate('home'); }}
                    role="button"
                    tabIndex={0}
                    aria-label="Duta - دو نگاه، یک حقیقت"
                    onKeyDown={(e) => { if (e.key === 'Enter') { closeSearch(); onNavigate('home'); } }}
                >
                    <DutaLogo />
                    <span className="logo-text">Duta</span>
                    <span className="logo-divider" aria-hidden="true" />
                    <span className="logo-sub" dir="rtl">دو نگاه، یک حقیقت</span>
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

            {/* BUGFIX: مخفی کردن اینپوت سرچ هنگام مشاهده صفحه جزئیات خبر */}
            {searchOpen && view !== 'detail' && (
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