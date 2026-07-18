import strings from '../strings/strings';
import {useState} from 'react';

function Navbar({ dark, view, onToggleTheme, onNavigate, onSearch }) {
    const t = strings['fa'];
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

    return (
        <nav className="navbar" aria-label="منوی اصلی">
            <div className="nav-row">
                <div className="logo" onClick={() => onNavigate('home')} role="button" tabIndex={0} aria-label="NewsGrid - صفحه اصلی">
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
                            <button
                                className="tool-btn theme-toggle"
                                onClick={toggleSearch}
                                aria-label={searchOpen ? 'بستن جستجو' : 'باز کردن جستجو'}
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
        </nav>
    );
}

export default Navbar;
