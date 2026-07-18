import strings from '../strings/strings';
import {useState} from 'react';

function Navbar({  dark, view, onToggleTheme, onNavigate, onSearch }) {
    const t = strings['fa'];
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

    return (
        <nav className="navbar">
            <div className="nav-row">
                <div className="logo" onClick={() => onNavigate('home')}>
                    News<span>Grid</span>
                </div>

                <div className="nav-right">
                    {/* nav-links همیشه نشون داده میشه */}
                    {!searchOpen && (
                        <div className="nav-links">
                            <a onClick={() => onNavigate('features')}>{t.features}</a>
                            <a onClick={() => onNavigate('credibility')}>{t.credibility}</a>
                        </div>
                    )}

                    <div className="nav-tools">
                        {view !== 'detail' && (
                            <button className="tool-btn theme-toggle" onClick={toggleSearch}>
                                {searchOpen ? '✕' : '🔍'}
                            </button>
                        )}
                        <button
                            className={`toggle-btn ${dark ? 'is-dark' : 'is-light'}`}
                            onClick={onToggleTheme}
                            aria-label="تغییر تم"
                        >
                            {dark ? '🌙' : '☀️'}
                        </button>
                    </div>
                </div>
            </div>

            {searchOpen && (
                <div className="search-bar">
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
        </nav>
    );
}

export default Navbar;