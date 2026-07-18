import { useState } from 'react';

function BottomNav({ view, dark, onNavigate, onSearch, onToggleTheme }) {
    const [searchOpen, setSearchOpen] = useState(false);
    const [keyword, setKeyword] = useState('');

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

    const activeView = searchOpen ? 'search' : view;

    return (
        <>
            {searchOpen && (
                <div className="bottom-search" role="search">
                    <input
                        autoFocus
                        type="search"
                        value={keyword}
                        onChange={handleSearch}
                        placeholder="جستجو در اخبار و منابع..."
                        className="search-input"
                        aria-label="جستجو در اخبار"
                    />
                </div>
            )}

            <nav className="bottom-nav" aria-label="منوی پایین">
                <button
                    className={`bottom-nav-item ${activeView === 'home' ? 'active' : ''}`}
                    onClick={() => { setSearchOpen(false); onNavigate('home'); }}
                    aria-label="خانه"
                    aria-current={activeView === 'home' ? 'page' : undefined}
                >
                    <i className="ti ti-home" aria-hidden="true" />
                    <span>خانه</span>
                </button>

                <button
                    className={`bottom-nav-item ${activeView === 'search' ? 'active' : ''}`}
                    onClick={toggleSearch}
                    aria-label={searchOpen ? 'بستن جستجو' : 'جستجو'}
                    aria-expanded={searchOpen}
                >
                    <i className={`ti ${searchOpen ? 'ti-x' : 'ti-search'}`} aria-hidden="true" />
                    <span>جستجو</span>
                </button>

                <button
                    className={`bottom-nav-item ${activeView === 'features' ? 'active' : ''}`}
                    onClick={() => { setSearchOpen(false); onNavigate('features'); }}
                    aria-label="ویژگی‌ها"
                    aria-current={activeView === 'features' ? 'page' : undefined}
                >
                    <i className="ti ti-layout-grid" aria-hidden="true" />
                    <span>ویژگی‌ها</span>
                </button>

                <button
                    className={`bottom-nav-item ${activeView === 'about' ? 'active' : ''}`}
                    onClick={() => { setSearchOpen(false); onNavigate('about'); }}
                    aria-label="درباره"
                    aria-current={activeView === 'about' ? 'page' : undefined}
                >
                    <i className="ti ti-info-circle" aria-hidden="true" />
                    <span>درباره</span>
                </button>

                <button
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
