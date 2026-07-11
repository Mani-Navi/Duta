import strings from '../strings/strings';

function Navbar({  dark, view, onToggleLang, onToggleTheme, onNavigate }) {
    const t = strings['fa'];

    return (
        <nav className="navbar">
            <div className="nav-row">
                <div className="logo" onClick={() => onNavigate('home')}>
                    News<span>Grid</span>
                </div>

                <div className="nav-right">
                    {view !== 'detail' && (
                        <div className="nav-links">
                            <a onClick={() => onNavigate('features')}>{t.features}</a>
                            <a onClick={() => onNavigate('credibility')}>{t.credibility}</a>
                        </div>
                    )}

                    {view === 'detail' && (
                        <button className="back-btn" onClick={() => onNavigate('home')}>
                            <i className="ti ti-chevron-right" />
                            {t.backLabel}
                        </button>
                    )}

                    <div className="nav-tools">
                        <button className="tool-btn theme-toggle" onClick={onToggleTheme}>
                            <i className={`ti ${dark ? 'ti-sun' : 'ti-moon'}`} />
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    );
}

export default Navbar;