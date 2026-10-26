import { useState, useRef } from 'react';
import { useUser } from '../context/UserContext';

function BottomNav({ view, dark, onNavigate, onSearch, onToggleTheme }) {
    const { user, isLoggedIn, openModal } = useUser();
    const [searchOpen, setSearchOpen] = useState(false);
    const [keyword, setKeyword] = useState('');
    const debounceRef = useRef(null);
    const inputRef = useRef(null);

    const closeSearch = () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        setSearchOpen(false);
        setKeyword('');
        onSearch('');
    };

    const clearKeywordOnly = () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        setKeyword('');
        onSearch('');
        inputRef.current?.focus();
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
        else {
            setSearchOpen(true);
            if (view !== 'home') onNavigate('home');
        }
    };

    const activeView = (searchOpen && view === 'home') ? 'search' : view;

    return (
        <>
            {searchOpen && view !== 'detail' && (
                <div className="bottom-search" role="search">
                    <div className="bottom-search-inner">
                        <i className="ti ti-search bottom-search-lead-icon" aria-hidden="true" />
                        <input
                            ref={inputRef}
                            autoFocus
                            type="search"
                            value={keyword}
                            onChange={handleSearch}
                            placeholder="جستجو در تیتر اخبار و منابع..."
                            className="bottom-search-input"
                            aria-label="جستجو در اخبار"
                        />
                        {keyword && (
                            <button
                                type="button"
                                className="bottom-search-clear"
                                onClick={clearKeywordOnly}
                                aria-label="پاک کردن متن جستجو"
                            >
                                <i className="ti ti-x" aria-hidden="true" />
                            </button>
                        )}
                    </div>
                </div>
            )}

            <nav className="bottom-nav" aria-label="منوی پایین موبایل">
                <button
                    type="button"
                    className={`bottom-nav-item ${activeView === 'home' ? 'active' : ''}`}
                    onClick={() => { closeSearch(); onNavigate('home'); }}
                    aria-label="اخبار"
                >
                    <i className="ti ti-home" aria-hidden="true" />
                    <span>اخبار</span>
                </button>

                <button
                    type="button"
                    className={`bottom-nav-item ${activeView === 'tablo' ? 'active' : ''}`}
                    onClick={() => { closeSearch(); onNavigate('tablo'); }}
                    aria-label="تابلو بازار"
                >
                    <i className="ti ti-chart-bar" aria-hidden="true" />
                    <span>تابلو</span>
                </button>

                <button
                    type="button"
                    className={`bottom-nav-item ${activeView === 'search' ? 'active' : ''}`}
                    onClick={toggleSearch}
                    aria-label={searchOpen ? 'بستن جستجو' : 'جستجو'}
                >
                    <i className={`ti ${searchOpen ? 'ti-x' : 'ti-search'}`} aria-hidden="true" />
                    <span>{searchOpen ? 'بستن' : 'جستجو'}</span>
                </button>

                <button
                    type="button"
                    className={`bottom-nav-item ${activeView === 'auth' ? 'active' : ''}`}
                    onClick={() => { closeSearch(); openModal(isLoggedIn ? 'prefs' : 'auth'); }}
                    aria-label="حساب و علایق"
                >
                    <i className="ti ti-shield-check" aria-hidden="true" />
                    <span>{isLoggedIn ? (user?.displayName?.slice(0, 8) || 'حساب من') : 'علایق'}</span>
                </button>

                <button
                    type="button"
                    className="bottom-nav-item"
                    onClick={onToggleTheme}
                    aria-label={dark ? 'تغییر به حالت روشن' : 'تغییر به حالت تاریک'}
                >
                    <i className={`ti ${dark ? 'ti-moon' : 'ti-sun'}`} aria-hidden="true" />
                    <span>{dark ? 'تاریک' : 'روشن'}</span>
                </button>
            </nav>
        </>
    );
}

export default BottomNav;