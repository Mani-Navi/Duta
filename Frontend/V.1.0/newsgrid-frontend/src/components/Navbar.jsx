import { useState, useEffect, useRef } from 'react';
import strings from '../strings/strings';
import PriceTicker from './PriceTicker';
import DutaLogo from './DutaLogo';
import { useUser } from '../context/UserContext';

function Navbar({ dark, view, onToggleTheme, onNavigate, onSearch }) {
    const t = strings.fa;
    const { user, isLoggedIn, openModal } = useUser();
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
            else onSearch('');
        }, 300);
    };

    const toggleSearch = () => {
        if (searchOpen) closeSearch();
        else setSearchOpen(true);
    };

    return (
        <header className="navbar" ref={navRef}>
            <div className="nav-row">
                <a
                    href="/"
                    className="logo"
                    dir="ltr"
                    onClick={(e) => { e.preventDefault(); closeSearch(); onNavigate('home'); }}
                    aria-label="Duta - دو نگاه، یک حقیقت"
                >
                    <DutaLogo />
                    <span className="logo-text">Duta</span>
                    <span className="logo-divider" aria-hidden="true" />
                    <span className="logo-sub" dir="rtl">دو نگاه، یک حقیقت</span>
                </a>

                <div className="nav-center">
                    <PriceTicker />
                </div>

                <div className="nav-right">
                    {!searchOpen && (
                        <nav className="nav-links" aria-label="لینک‌های هدر">
                            <a href="/tablo" onClick={(e) => { e.preventDefault(); onNavigate('tablo'); }} style={{ color: view === 'tablo' ? 'var(--blue)' : undefined }}>
                                تابلو بازار
                            </a>
                            <a href="/credibility" onClick={(e) => { e.preventDefault(); onNavigate('credibility'); }}>{t.credibility}</a>
                            <a href="/about" onClick={(e) => { e.preventDefault(); onNavigate('about'); }}>{t.about}</a>
                        </nav>
                    )}

                    <div className="nav-tools">
                        {isLoggedIn && user?.locationCity && (
                            <button
                                type="button"
                                className="x-city-pill"
                                onClick={() => openModal('prefs', 'تغییر موقعیت مکانی و علایق')}
                            >
                                <i className="ti ti-map-pin" aria-hidden="true" />
                                <span>{user.locationCity}</span>
                            </button>
                        )}

                        <button
                            type="button"
                            className={`x-auth-pill ${isLoggedIn ? 'is-member' : ''}`}
                            onClick={() => openModal(isLoggedIn ? 'prefs' : 'auth')}
                        >
                            {isLoggedIn ? (user.displayName || 'حساب من') : 'ورود / عضویت'}
                        </button>

                        {view !== 'detail' && (
                            <button
                                className="tool-btn theme-toggle"
                                onClick={toggleSearch}
                                aria-label={searchOpen ? 'بستن جستجو' : 'جستجو'}
                                aria-expanded={searchOpen}
                            >
                                <i className={`ti ${searchOpen ? 'ti-x' : 'ti-search'}`} aria-hidden="true" />
                            </button>
                        )}
                        <button
                            className={`toggle-btn ${dark ? 'is-dark' : 'is-light'}`}
                            onClick={onToggleTheme}
                            aria-label={dark ? 'تغییر به حالت روشن' : 'تغییر به حالت تاریک'}
                        >
                            <i className={`ti ${dark ? 'ti-moon' : 'ti-sun'}`} aria-hidden="true" />
                        </button>
                    </div>
                </div>
            </div>

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