import strings from '../strings/strings';
import { useState } from 'react';

function Navbar({ dark, view, onToggleTheme, onNavigate, onSearch, user, onAuthClick, onLogout }) {
    const t = strings['fa'];
    const [searchOpen, setSearchOpen] = useState(false);
    const [keyword, setKeyword] = useState('');
    const [showUserMenu, setShowUserMenu] = useState(false);

    const handleSearch = (e) => {
        const val = e.target.value;
        setKeyword(val);
        if (val.length > 1) onSearch(val);
        else if (val.length === 0) onSearch('');
    };

    const toggleSearch = () => {
        setSearchOpen(prev => !prev);
        if (searchOpen) { setKeyword(''); onSearch(''); }
    };

    return (
        <nav className="navbar" aria-label="منوی اصلی">
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
                                    aria-label={searchOpen ? 'بستن جستجو' : 'جستجو'}>
                                {searchOpen ? '✕' : '🔍'}
                            </button>
                        )}

                        {/* دکمه ورود / پروفایل */}
                        {user ? (
                            <div style={{ position: 'relative' }}>
                                <button
                                    className="auth-btn logged-in"
                                    onClick={() => setShowUserMenu(p => !p)}
                                    aria-label="منوی کاربر"
                                >
                                    <div className="user-avatar">
                                        {user.name?.charAt(0)?.toUpperCase()}
                                    </div>
                                    {user.name?.split(' ')[0]}
                                </button>
                                {showUserMenu && (
                                    <div className="user-menu">
                                        <div className="user-menu-email">{user.email}</div>
                                        <button className="user-menu-item" onClick={() => { onLogout(); setShowUserMenu(false); }}>
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
                    <input autoFocus type="search" value={keyword} onChange={handleSearch}
                           placeholder="جستجو در اخبار و منابع..." className="search-input"
                           aria-label="جستجو در اخبار" />
                </div>
            )}
        </nav>
    );
}

export default Navbar;
