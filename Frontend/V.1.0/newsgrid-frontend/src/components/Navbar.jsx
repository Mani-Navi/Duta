import strings from '../strings/strings';
import { useState, useEffect, useRef } from 'react';

function Navbar({ dark, view, onToggleTheme, onNavigate, onSearch, user, onAuthClick, onLogout }) {
    const t = strings['fa'];
    const [searchOpen, setSearchOpen] = useState(false);
    const [keyword, setKeyword] = useState('');
    const [showUserMenu, setShowUserMenu] = useState(false);
    const searchRef = useRef(null);
    const navRef = useRef(null);
    const debounceRef = useRef(null);

    // تست ۳: ESC بسته کردن جستجو
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && searchOpen) closeSearch();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [searchOpen]);

    // تست ۴: کلیک خارج از navbar جستجو رو میبنده
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (searchOpen && navRef.current && !navRef.current.contains(e.target)) {
                closeSearch();
            }
            // بستن user menu
            if (showUserMenu && !e.target.closest('.user-menu-wrap')) {
                setShowUserMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [searchOpen, showUserMenu]);

    const closeSearch = () => {
        setSearchOpen(false);
        setKeyword('');
        onSearch('');
    };

    // تست ۱۶: debounce — فقط بعد از ۳۰۰ms request بزن
    // تست ۱۷: space رو trim کن
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
        if (searchOpen) {
            closeSearch();
        } else {
            setSearchOpen(true);
        }
    };

    return (
        <nav className="navbar" aria-label="منوی اصلی" ref={navRef}>
            <div className="nav-row">
                <div className="logo" onClick={() => onNavigate('home')}
                     role="button" tabIndex={0} aria-label="NewsGrid - صفحه اصلی">
                    News<span>Grid</span>
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

                        {user ? (
                            <div className="user-menu-wrap" style={{ position: 'relative' }}>
                                <button className="auth-btn logged-in"
                                        onClick={() => setShowUserMenu(p => !p)}
                                        aria-label="منوی کاربر">
                                    <div className="user-avatar">
                                        {user.name?.charAt(0)?.toUpperCase()}
                                    </div>
                                    {user.name?.split(' ')[0]}
                                </button>
                                {showUserMenu && (
                                    <div className="user-menu">
                                        <div className="user-menu-email">{user.email}</div>
                                        <button className="user-menu-item"
                                                onClick={() => { onLogout(); setShowUserMenu(false); }}>
                                            <i className="ti ti-logout" />
                                            خروج
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <button className="auth-btn" onClick={onAuthClick} aria-label="ورود">
                                <i className="ti ti-user" />
                                ورود
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
                    <input ref={searchRef} autoFocus type="search" value={keyword}
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
