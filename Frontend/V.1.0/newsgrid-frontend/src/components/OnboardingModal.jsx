import { useState, useEffect } from 'react';
import api from '../api/axiosConfig';
import { useUser } from '../context/UserContext';

const DEFAULT_CITIES = ['تهران', 'شیراز', 'اصفهان', 'مشهد', 'تبریز', 'کرج', 'اهواز', 'رشت', 'قم', 'کرمانشاه', 'یزد', 'بوشهر'];
const DEFAULT_CATEGORIES = ['اقتصادی', 'تکنولوژی', 'سیاسی', 'ورزشی', 'جهانی', 'سرگرمی'];

function OnboardingModal({ onPreferencesSaved }) {
    const { user, modalState, closeModal, loginSuccess, logout, savePreferences } = useUser();

    const [viewMode, setViewMode] = useState('auth'); // 'auth' | 'prefs'
    const [authTab, setAuthTab] = useState('login');  // 'login' | 'register'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [authError, setAuthError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Discovery Catalog from Backend
    const [catalog, setCatalog] = useState({
        cities: DEFAULT_CITIES,
        categories: DEFAULT_CATEGORIES,
        sourcesByCategory: {}
    });

    // Selected Preferences State
    const [selectedCity, setSelectedCity] = useState('');
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [selectedSources, setSelectedSources] = useState([]);
    const [mutedSources, setMutedSources] = useState([]);
    const [lastPickedSource, setLastPickedSource] = useState(null);

    useEffect(() => {
        if (!modalState.open) return;
        setViewMode(user ? 'prefs' : 'auth');
        setAuthError('');

        if (user) {
            setSelectedCity(user.locationCity || '');
            setSelectedCategories(Array.isArray(user.favoriteCategories) ? user.favoriteCategories : []);
            setSelectedSources(Array.isArray(user.followedSources) ? user.followedSources : []);
            setMutedSources(Array.isArray(user.mutedSources) ? user.mutedSources : []);
        }

        api.get('/user/discovery-catalog')
            .then(res => {
                if (res.data) {
                    setCatalog({
                        cities: res.data.cities || DEFAULT_CITIES,
                        categories: res.data.categories || DEFAULT_CATEGORIES,
                        sourcesByCategory: res.data.sourcesByCategory || {}
                    });
                }
            })
            .catch(() => {});
    }, [modalState.open, user]);

    if (!modalState.open) return null;

    const handleAuthSubmit = async (e) => {
        e.preventDefault();
        setAuthError('');
        setSubmitting(true);

        try {
            if (authTab === 'login') {
                const res = await api.post('/auth/login', { email, password });
                loginSuccess(res.data.token, res.data.user, false);
                if (onPreferencesSaved) onPreferencesSaved();
            } else {
                const res = await api.post('/auth/register', {
                    email,
                    password,
                    displayName
                });
                loginSuccess(res.data.token, res.data.user, true);
                setViewMode('prefs');
            }
        } catch (err) {
            setAuthError(err.response?.data?.error || 'خطا در برقراری ارتباط با سرور');
        } finally {
            setSubmitting(false);
        }
    };

    const toggleCategory = (cat) => {
        setSelectedCategories(prev =>
            prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
        );
    };

    const toggleSource = (srcName) => {
        setSelectedSources(prev => {
            if (prev.includes(srcName)) {
                return prev.filter(s => s !== srcName);
            } else {
                setLastPickedSource(srcName);
                return [...prev, srcName];
            }
        });
    };

    const handleUnmuteSource = (srcName) => {
        setMutedSources(prev => prev.filter(s => s !== srcName));
    };

    const handleSavePrefs = async () => {
        setSubmitting(true);
        try {
            await savePreferences({
                locationCity: selectedCity,
                favoriteCategories: selectedCategories,
                followedSources: selectedSources,
                mutedSources: mutedSources
            });
            closeModal();
            if (onPreferencesSaved) onPreferencesSaved();
        } catch {
            closeModal();
        } finally {
            setSubmitting(false);
        }
    };

    // Layer 2: Gather specialized sources belonging to currently selected categories
    const availableSources = [];
    const seenNames = new Set();
    selectedCategories.forEach(cat => {
        const list = catalog.sourcesByCategory[cat] || [];
        list.forEach(srcObj => {
            if (!seenNames.has(srcObj.name)) {
                seenNames.add(srcObj.name);
                availableSources.push(srcObj);
            }
        });
    });

    // Layer 3: Peer/Similar sources based on lastPickedSource's category
    let similarSources = [];
    if (lastPickedSource) {
        Object.values(catalog.sourcesByCategory).forEach(list => {
            if (list.some(s => s.name === lastPickedSource)) {
                similarSources = list
                    .filter(s => s.name !== lastPickedSource && !selectedSources.includes(s.name))
                    .slice(0, 4);
            }
        });
    }

    return (
        <div className="x-modal-overlay" onClick={(e) => e.target === e.currentTarget && closeModal()}>
            <div className="x-modal-panel" role="dialog" aria-modal="true">
                <div className="x-modal-head">
                    <h2>{modalState.title || (viewMode === 'auth' ? 'حساب کاربری Duta' : 'شخصی‌سازی فید خبری')}</h2>
                    <button className="x-close-btn" onClick={closeModal} aria-label="بستن">
                        <svg className="x-svg" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>

                {viewMode === 'auth' ? (
                    <div>
                        <div className="x-tabs" style={{ marginBottom: '18px', borderBottom: '1px solid var(--separator)' }}>
                            <button
                                type="button"
                                className={`x-tab ${authTab === 'login' ? 'active' : ''}`}
                                onClick={() => { setAuthTab('login'); setAuthError(''); }}
                            >
                                ورود به حساب
                            </button>
                            <button
                                type="button"
                                className={`x-tab ${authTab === 'register' ? 'active' : ''}`}
                                onClick={() => { setAuthTab('register'); setAuthError(''); }}
                            >
                                ایجاد حساب جدید
                            </button>
                        </div>

                        <form onSubmit={handleAuthSubmit} className="x-auth-form">
                            {authTab === 'register' && (
                                <div className="x-field">
                                    <label>نام نمایشی</label>
                                    <input
                                        type="text"
                                        placeholder="مثلاً: مانی"
                                        value={displayName}
                                        onChange={e => setDisplayName(e.target.value)}
                                        required
                                    />
                                </div>
                            )}

                            <div className="x-field">
                                <label>آدرس ایمیل</label>
                                <input
                                    type="email"
                                    dir="ltr"
                                    placeholder="name@example.com"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="x-field">
                                <label>رمز عبور (حداقل ۶ کاراکتر)</label>
                                <input
                                    type="password"
                                    dir="ltr"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                    minLength={6}
                                />
                            </div>

                            {authError && <div className="status-text error" style={{ fontSize: '13px' }}>{authError}</div>}

                            <button type="submit" className="x-primary-btn" disabled={submitting} style={{ width: '100%', marginTop: '8px' }}>
                                {submitting ? 'در حال پردازش...' : (authTab === 'login' ? 'ورود به Duta' : 'ثبت‌نام و انتخاب علایق')}
                            </button>
                        </form>
                    </div>
                ) : (
                    <div>
                        <p className="x-modal-sub">
                            با انتخاب هر حوزه، خبرگزاری‌های تخصصی مرتبط با آن به صورت پویا باز می‌شوند تا «فید من» دقیقاً مطابق سلیقه شما چیده شود.
                        </p>

                        {/* Layer 1: City Selection */}
                        <div className="x-layer-box">
                            <div className="x-layer-label">۱. موقعیت مکانی (اولویت اخبار شهر شما)</div>
                            <div className="x-pill-cloud">
                                <button
                                    type="button"
                                    className={`x-select-pill ${!selectedCity ? 'selected' : ''}`}
                                    onClick={() => setSelectedCity('')}
                                >
                                    همه شهرها
                                </button>
                                {catalog.cities.map(city => (
                                    <button
                                        type="button"
                                        key={city}
                                        className={`x-select-pill ${selectedCity === city ? 'selected' : ''}`}
                                        onClick={() => setSelectedCity(city)}
                                    >
                                        {city}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Layer 2: Main Categories */}
                        <div className="x-layer-box">
                            <div className="x-layer-label">۲. حوزه‌های خبری مورد علاقه (انتخاب کنید)</div>
                            <div className="x-pill-cloud">
                                {catalog.categories.map(cat => {
                                    const active = selectedCategories.includes(cat);
                                    return (
                                        <button
                                            type="button"
                                            key={cat}
                                            className={`x-select-pill ${active ? 'selected' : ''}`}
                                            onClick={() => toggleCategory(cat)}
                                        >
                                            {active ? '✓ ' : '+ '}{cat}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Layer 3: Cascading Specialized Sources */}
                        {availableSources.length > 0 && (
                            <div className="x-layer-box">
                                <div className="x-layer-label">۳. منابع تخصصی پیشنهادی (بر اساس حوزه‌های انتخابی شما)</div>
                                <div className="x-pill-cloud">
                                    {availableSources.map(src => {
                                        const isFollowed = selectedSources.includes(src.name);
                                        return (
                                            <button
                                                type="button"
                                                key={src.name}
                                                className={`x-select-pill source-pill ${isFollowed ? 'selected' : ''}`}
                                                onClick={() => toggleSource(src.name)}
                                            >
                                                <span>{isFollowed ? '✓' : '+'}</span>
                                                <span>{src.name}</span>
                                                <span style={{ opacity: 0.7, fontSize: '10.5px' }}>{src.credibility}%</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Layer 4: Source-to-Source Affinity Suggestions */}
                        {similarSources.length > 0 && (
                            <div className="x-layer-box" style={{ background: 'rgba(0, 122, 255, 0.05)', padding: '12px', borderRadius: '12px' }}>
                                <div className="x-layer-label" style={{ color: 'var(--blue)' }}>
                                    پیشنهاد مشابه بر اساس انتخاب «{lastPickedSource}»:
                                </div>
                                <div className="x-pill-cloud">
                                    {similarSources.map(sim => (
                                        <button
                                            type="button"
                                            key={sim.name}
                                            className="x-select-pill source-pill"
                                            onClick={() => toggleSource(sim.name)}
                                        >
                                            + {sim.name} ({sim.credibility}%)
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Muted Sources Management */}
                        {mutedSources.length > 0 && (
                            <div className="x-layer-box">
                                <div className="x-layer-label">منابع بی‌صداشده (کلیک برای لغو بی‌صدا)</div>
                                <div className="x-pill-cloud">
                                    {mutedSources.map(ms => (
                                        <button
                                            type="button"
                                            key={ms}
                                            className="x-select-pill"
                                            onClick={() => handleUnmuteSource(ms)}
                                        >
                                            ✕ {ms}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="x-modal-footer">
                            <button type="button" className="cat" onClick={() => { logout(); closeModal(); }} style={{ color: 'var(--red)' }}>
                                خروج از حساب
                            </button>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button type="button" className="cat" onClick={closeModal}>انصراف</button>
                                <button type="button" className="x-primary-btn" onClick={handleSavePrefs} disabled={submitting}>
                                    {submitting ? 'در حال ذخیره...' : 'ذخیره تنظیمات'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default OnboardingModal;