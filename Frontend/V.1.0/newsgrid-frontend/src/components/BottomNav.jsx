import { useState } from 'react';

function BottomNav({ view, dark, onNavigate, onSearch, onToggleTheme }) {
    const [searchOpen, setSearchOpen] = useState(false);
    const [keyword, setKeyword] = useState('');

    const handleSearch = (e) => {
        const val = e.target.value;
        setKeyword(val);
        if (val.length > 1) {
            onSearch(val);
        } else if (val.length === 0) {
            onSearch('');
        }
    };

    const toggleSearch = () => {
        setSearchOpen(prev => !prev);
        if (searchOpen) {
            setKeyword('');
            onSearch('');
        }
    };

    const activeView = searchOpen ? 'search' : view;

    return (
        <>
            {/* سرچ باز شده */}
            {searchOpen && (
                <div className="bottom-search">
                    <input
                        autoFocus
                        type="text"
                        value={keyword}
                        onChange={handleSearch}
                        placeholder="جستجو در اخبار و منابع..."
                        className="search-input"
                    />
                </div>
            )}

            <nav className="bottom-nav">
                {/* خانه */}
                <button
                    className={`bottom-nav-item ${activeView === 'home' ? 'active' : ''}`}
                    onClick={() => { setSearchOpen(false); onNavigate('home'); }}
                >
                    <i className="ti ti-home" />
                    <span>خانه</span>
                </button>

                {/* جستجو */}
                <button
                    className={`bottom-nav-item ${activeView === 'search' ? 'active' : ''}`}
                    onClick={toggleSearch}
                >
                    <i className={`ti ${searchOpen ? 'ti-x' : 'ti-search'}`} />
                    <span>جستجو</span>
                </button>

                {/* ویژگی‌ها */}
                <button
                    className={`bottom-nav-item ${activeView === 'features' ? 'active' : ''}`}
                    onClick={() => { setSearchOpen(false); onNavigate('features'); }}
                >
                    <i className="ti ti-layout-grid" />
                    <span>ویژگی‌ها</span>
                </button>

                {/* درباره */}
                <button
                    className={`bottom-nav-item ${activeView === 'about' ? 'active' : ''}`}
                    onClick={() => { setSearchOpen(false); onNavigate('about'); }}
                >
                    <i className="ti ti-info-circle" />
                    <span>درباره</span>
                </button>

                {/* تم */}
                <button
                    className="bottom-nav-item"
                    onClick={onToggleTheme}
                >
                    <i className={`ti ${dark ? 'ti-moon' : 'ti-sun'}`} />
                    <span>{dark ? 'تاریک' : 'روشن'}</span>
                </button>
            </nav>
        </>
    );
}

export default BottomNav;
