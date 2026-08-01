import strings from '../strings/strings';
import { useState, useEffect, useRef } from 'react';
import PriceTicker from './PriceTicker'; // ← اضافه شدن کامپوننت قیمت دلار و طلا

function Navbar({ dark, view, onToggleTheme, onNavigate, onSearch }) {
    const t = strings['fa'];
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
        <nav className="navbar" aria-label="منوی اصلی" ref={navRef}>
            <div className="nav-row">
                {/* تغییر لوگو به Nitt */}
                <div className="logo" onClick={() => onNavigate('home')}
                     role="button" tabIndex={0} aria-label="Nitt - صفحه اصلی">
                    Nitt
                </div>

                {/* جایگاه تمیز قیمت دلار و طلا در وسط هدر */}
                <div className="nav-center">
                    <PriceTicker lang="fa" />
                </div>

                <div className="nav-right">
                    {!searchOpen && (
                        <div className="nav-links" role="navigation">
                            <a onClick={() => onNavigate('features')} role="button" tabIndex={0}>{t.features}</a>
                            <a onClick={() => onNavigate('credibility')} role="button" tabIndex={0}>{t.credibility}</a>
                            <a onClick={() => onNavigate('about')} role="button" tabIndex={0}>{t.about}</a>
                        </div>
                    )}

                    <div className="nav-tools">
                        {view !== 'detail' && (
                            <button className="tool-btn theme-toggle" onClick={toggleSearch}
                                    aria-label={searchOpen ? 'بستن جستجو' : 'جستجو'}
                                    aria-expanded={searchOpen}>
                                {searchOpen ? '✕' : '🔍'}
                            </button>
                        )}
                        <button className={`toggle-btn ${dark ? 'is-dark' : 'is-light'}`}
                                onClick={onToggleTheme}
                                aria-label={dark ? 'تغییر به حالت روشن' : 'تغییر به حالت تاریک'}>
                            {dark ? '🌙' : '☀️'}
                        </button>
                    </div>
                </div>
            </div>

            {searchOpen && (
                <div className="search-bar" role="search">
                    <input autoFocus type="search" value={keyword}
                           onChange={handleSearch}
                           placeholder="جستجو در اخبار و منابع..."
                           className="search-input"
                           aria-label="جستجو در اخبار" />
                </div>
            )}
        </nav>
    );
}

export default Navbar;