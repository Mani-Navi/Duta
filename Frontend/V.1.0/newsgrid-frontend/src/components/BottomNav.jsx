import { useState, useRef, useEffect } from 'react';

function BottomNav({ view, dark, onNavigate, onSearch, onToggleTheme }) {
    const [searchOpen, setSearchOpen] = useState(false);
    const [keyword, setKeyword] = useState('');
    const debounceRef = useRef(null);

    useEffect(() => {
        if (!searchOpen) return;
        const handlePopState = () => closeSearch();
        window.history.pushState(null, '', window.location.href);
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
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

    const activeView = searchOpen ? 'search' : view;

    return (
        <>
            {searchOpen && (
                <div className="bottom-search" role="search">
                    <input autoFocus type="search" value={keyword}
                           onChange={handleSearch}
                           placeholder="جستجو در اخبار و منابع..."
                           className="search-input"
                           aria-label="جستجو در اخبار" />
                </div>
            )}

            <nav className="bottom-nav" aria-label="منوی پایین">
                <button className={`bottom-nav-item ${activeView === 'home' ? 'active' : ''}`}
                        onClick={() => { closeSearch(); onNavigate('home'); }}
                        aria-label="خانه" aria-current={activeView === 'home' ? 'page' : undefined}>
                    <i className="ti ti-home" aria-hidden="true" />
                    <span>خانه</span>
                </button>

                <button className={`bottom-nav-item ${activeView === 'search' ? 'active' : ''}`}
                        onClick={toggleSearch}
                        aria-label={searchOpen ? 'بستن جستجو' : 'جستجو'}
                        aria-expanded={searchOpen}>
                    <i className={`ti ${searchOpen ? 'ti-x' : 'ti-search'}`} aria-hidden="true" />
                    <span>جستجو</span>
                </button>

                <button className={`bottom-nav-item ${activeView === 'features' ? 'active' : ''}`}
                        onClick={() => { closeSearch(); onNavigate('features'); }}
                        aria-label="ویژگی‌ها" aria-current={activeView === 'features' ? 'page' : undefined}>
                    <i className="ti ti-layout-grid" aria-hidden="true" />
                    <span>ویژگی‌ها</span>
                </button>

                <button className={`bottom-nav-item ${activeView === 'about' ? 'active' : ''}`}
                        onClick={() => { closeSearch(); onNavigate('about'); }}
                        aria-label="درباره" aria-current={activeView === 'about' ? 'page' : undefined}>
                    <i className="ti ti-info-circle" aria-hidden="true" />
                    <span>درباره</span>
                </button>

                <button className="bottom-nav-item" onClick={onToggleTheme}
                        aria-label={dark ? 'تغییر به حالت روشن' : 'تغییر به حالت تاریک'}>
                    <i className={`ti ${dark ? 'ti-moon' : 'ti-sun'}`} aria-hidden="true" />
                    <span>{dark ? 'تاریک' : 'روشن'}</span>
                </button>
            </nav>
        </>
    );
}

export default BottomNav;
