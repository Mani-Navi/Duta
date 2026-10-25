import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import { useUser } from '../context/UserContext';
import DutaLogo from '../components/DutaLogo';

const DEFAULT_CITIES = ['تهران', 'شیراز', 'اصفهان', 'مشهد', 'تبریز', 'کرج', 'اهواز', 'رشت', 'قم', 'کرمانشاه', 'یزد', 'بوشهر'];
const DEFAULT_CATEGORIES = ['اقتصادی', 'تکنولوژی', 'سیاسی', 'ورزشی', 'جهانی', 'سرگرمی'];

function AuthPage({ onPreferencesSaved }) {
    const navigate = useNavigate();
    const { user, isLoggedIn, loginSuccess, logout, savePreferences } = useUser();

    const [authTab, setAuthTab] = useState('login'); // 'login' | 'register'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [authError, setAuthError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [savedNotice, setSavedNotice] = useState(false);

    // Cascading Discovery Catalog
    const [catalog, setCatalog] = useState({
        cities: DEFAULT_CITIES,
        categories: DEFAULT_CATEGORIES,
        sourcesByCategory: {}
    });

    const [selectedCity, setSelectedCity] = useState('');
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [selectedSources, setSelectedSources] = useState([]);
    const [mutedSources, setMutedSources] = useState([]);
    const [lastPickedSource, setLastPickedSource] = useState(null);

    useEffect(() => {
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
    }, [user]);

    const handleAuthSubmit = async (e) => {
        e.preventDefault();
        setAuthError('');
        setSubmitting(true);

        try {
            if (authTab === 'login') {
                const res = await api.post('/auth/login', { email, password });
                loginSuccess(res.data.token, res.data.user);
                if (onPreferencesSaved) onPreferencesSaved();
                navigate('/');
            } else {
                const res = await api.post('/auth/register', {
                    email,
                    password,
                    displayName
                });
                loginSuccess(res.data.token, res.data.user);
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
            setSavedNotice(true);
            if (onPreferencesSaved) onPreferencesSaved();
            setTimeout(() => {
                setSavedNotice(false);
                navigate('/');
            }, 600);
        } catch {} finally {
            setSubmitting(false);
        }
    };

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

    // ─── حالت ۱: صفحه ورود و ثبت‌نام (وقتی کاربر هنوز لاگین نیست) ───
    if (!isLoggedIn) {
        return (
            <div className="auth-page-wrap">
                <div className="auth-card">
                    <div className="auth-brand-head">
                        <DutaLogo />
                        <h1 className="auth-title">
                            {authTab === 'login' ? 'ورود به Duta' : 'ایجاد حساب در Duta'}
                        </h1>
                        <p className="auth-subtitle">
                            فید خبری خود را شخصی‌سازی کنید، خبرگزاری‌های معتبر را دنبال کنید و تابلوی بازار اختصاصی بسازید.
                        </p>
                    </div>

                    <div className="auth-segmented">
                        <button
                            type="button"
                            className={`auth-seg-btn ${authTab === 'login' ? 'active' : ''}`}
                            onClick={() => { setAuthTab('login'); setAuthError(''); }}
                        >
                            ورود به حساب
                        </button>
                        <button
                            type="button"
                            className={`auth-seg-btn ${authTab === 'register' ? 'active' : ''}`}
                            onClick={() => { setAuthTab('register'); setAuthError(''); }}
                        >
                            ثبت‌نام جدید
                        </button>
                    </div>

                    <form onSubmit={handleAuthSubmit} className="auth-form">
                        {authTab === 'register' && (
                            <div className="auth-field">
                                <label htmlFor="auth-name">نام نمایشی</label>
                                <input
                                    id="auth-name"
                                    type="text"
                                    placeholder="نام شما"
                                    value={displayName}
                                    onChange={e => setDisplayName(e.target.value)}
                                    required
                                />
                            </div>
                        )}

                        <div className="auth-field">
                            <label htmlFor="auth-email">آدرس ایمیل</label>
                            <input
                                id="auth-email"
                                type="email"
                                dir="ltr"
                                placeholder="name@example.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <div className="auth-field">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label htmlFor="auth-pass">رمز عبور</label>
                                <button
                                    type="button"
                                    className="auth-pass-toggle"
                                    onClick={() => setShowPassword(p => !p)}
                                >
                                    {showPassword ? 'پنهان کردن' : 'نمایش رمز'}
                                </button>
                            </div>
                            <input
                                id="auth-pass"
                                type={showPassword ? 'text' : 'password'}
                                dir="ltr"
                                placeholder="حداقل ۶ کاراکتر"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                minLength={6}
                            />
                        </div>

                        {authError && (
                            <div className="auth-error-box">
                                {authError}
                            </div>
                        )}

                        <button type="submit" className="auth-submit-btn" disabled={submitting}>
                            {submitting
                                ? 'در حال بررسی...'
                                : (authTab === 'login' ? 'ورود به حساب کاربری' : 'ایجاد حساب و ادامه')}
                        </button>
                    </form>

                    <div className="auth-perks">
                        <div className="auth-perk-item">
                            <i className="ti ti-shield-check" aria-hidden="true" />
                            <span>فید شخصی با ترکیب ۸۵٪ علایق شما و ۱۵٪ کشف هوشمند</span>
                        </div>
                        <div className="auth-perk-item">
                            <i className="ti ti-map-pin" aria-hidden="true" />
                            <span>اولویت‌دهی هوشمند به اخبار شهر و استان شما</span>
                        </div>
                        <div className="auth-perk-item">
                            <i className="ti ti-chart-bar" aria-hidden="true" />
                            <span>پین کردن ارزها و طلاهای دلخواه در نوار بالای سایت</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ─── حالت ۲: استودیوی کشف آبشاری سلیقه و مدیریت حساب (وقتی کاربر لاگین است) ───
    return (
        <div className="page-content" style={{ maxWidth: '680px' }}>
            <div className="prefs-card">
                <div className="prefs-top-bar">
                    <div>
                        <h1 className="prefs-title">تنظیمات حساب و سلیقه خبری</h1>
                        <p className="prefs-subtitle">
                            {user.displayName} ({user.email}) — با انتخاب هر حوزه، خبرگزاری‌های تخصصی مرتبط باز می‌شوند.
                        </p>
                    </div>
                    <button
                        type="button"
                        className="cat"
                        style={{ color: 'var(--red)', borderColor: 'rgba(244,33,46,0.3)' }}
                        onClick={() => { logout(); navigate('/'); }}
                    >
                        خروج از حساب
                    </button>
                </div>

                {/* لایه ۱: شهر */}
                <div className="x-layer-box">
                    <div className="x-layer-label">۱. موقعیت مکانی شما (اولویت اخبار محلی)</div>
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

                {/* لایه ۲: دسته‌بندی‌ها */}
                <div className="x-layer-box">
                    <div className="x-layer-label">۲. حوزه‌های خبری مورد علاقه</div>
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

                {/* لایه ۳: باز شدن آبشاری خبرگزاری‌های تخصصی */}
                {availableSources.length > 0 && (
                    <div className="x-layer-box">
                        <div className="x-layer-label">۳. خبرگزاری‌های تخصصی پیشنهادی (بر اساس حوزه‌های انتخابی شما)</div>
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

                {/* لایه ۴: پیشنهاد زنجیره‌ای منابع هم‌تراز */}
                {similarSources.length > 0 && (
                    <div className="x-layer-box" style={{ background: 'rgba(29, 155, 240, 0.06)', padding: '14px', borderRadius: '14px', border: '1px solid rgba(29, 155, 240, 0.2)' }}>
                        <div className="x-layer-label" style={{ color: 'var(--blue)', marginBottom: '10px' }}>
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

                {/* مدیریت منابع بی‌صداشده */}
                {mutedSources.length > 0 && (
                    <div className="x-layer-box">
                        <div className="x-layer-label">منابع بی‌صداشده (کلیک برای لغو محدودیت)</div>
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
                    <button type="button" className="cat" onClick={() => navigate('/')}>
                        بازگشت به اخبار
                    </button>
                    <button type="button" className="auth-submit-btn" style={{ width: 'auto', padding: '10px 26px', marginTop: 0 }} onClick={handleSavePrefs} disabled={submitting}>
                        {savedNotice ? '✓ ذخیره شد' : (submitting ? 'در حال ذخیره...' : 'ذخیره و مشاهده فید من')}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default AuthPage;