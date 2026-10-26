import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import { useUser } from '../context/UserContext';
import DutaLogo from '../components/DutaLogo';

const DEFAULT_CITIES = ['تهران', 'شیراز', 'اصفهان', 'مشهد', 'تبریز', 'کرج', 'اهواز', 'رشت', 'قم', 'کرمانشاه', 'یزد', 'بوشهر'];
const DEFAULT_CATEGORIES = [
    'اقتصادی', 'سیاسی', 'تکنولوژی', 'آموزشی', 'رمزارز', 'اجتماعی',
    'خودرو', 'ورزشی', 'جهانی', 'سلامت', 'سرگرمی', 'فرهنگ و هنر'
];

function PasswordCriteriaChecklist({ password, confirmPassword }) {
    const checks = useMemo(() => {
        const lenOk = password.length >= 8;
        const hasLetter = /[a-zA-Z]/.test(password);
        const hasCaseMix = /[a-z]/.test(password) && /[A-Z]/.test(password);
        const hasNumber = /\d/.test(password);
        const matchOk = password.length > 0 && password === confirmPassword;

        let strength = 0;
        if (lenOk) strength++;
        if (hasLetter && hasNumber) strength++;
        if (hasCaseMix || /[^a-zA-Z0-9]/.test(password)) strength++;
        if (password.length >= 10) strength++;

        return { lenOk, hasLetter, hasNumber, matchOk, strength };
    }, [password, confirmPassword]);

    const strengthLabel = checks.strength <= 1 ? 'ضعیف' : (checks.strength <= 2 ? 'متوسط' : 'قوی');
    const strengthColor = checks.strength <= 1 ? 'var(--red)' : (checks.strength <= 2 ? 'var(--orange)' : 'var(--green)');

    return (
        <div className="pass-criteria-box">
            <div className="pass-strength-head">
                <span>امنیت رمز عبور</span>
                <span style={{ color: password ? strengthColor : 'var(--label-3)', fontWeight: 700 }}>
                    {password ? strengthLabel : 'وارد نشده'}
                </span>
            </div>

            <div className="pass-meter-track">
                {[1, 2, 3, 4].map(step => (
                    <div
                        key={step}
                        className="pass-meter-bar"
                        style={{
                            background: password && checks.strength >= step ? strengthColor : 'var(--separator)'
                        }}
                    />
                ))}
            </div>

            <ul className="pass-criteria-list">
                <li className={checks.lenOk ? 'ok' : ''}>
                    <span className="crit-dot">{checks.lenOk ? '✓' : '○'}</span>
                    <span>حداقل ۸ کاراکتر</span>
                </li>
                <li className={checks.hasLetter ? 'ok' : ''}>
                    <span className="crit-dot">{checks.hasLetter ? '✓' : '○'}</span>
                    <span>شامل حروف انگلیسی (a-z)</span>
                </li>
                <li className={checks.hasNumber ? 'ok' : ''}>
                    <span className="crit-dot">{checks.hasNumber ? '✓' : '○'}</span>
                    <span>شامل حداقل یک عدد (0-9)</span>
                </li>
                <li className={checks.matchOk ? 'ok' : ''}>
                    <span className="crit-dot">{checks.matchOk ? '✓' : '○'}</span>
                    <span>تطابق کامل با تکرار رمز عبور</span>
                </li>
            </ul>
        </div>
    );
}

function AuthPage({ onPreferencesSaved }) {
    const navigate = useNavigate();
    const { user, isLoggedIn, loginSuccess, logout, savePreferences } = useUser();
    const googleBtnRef = useRef(null);

    const [authTab, setAuthTab] = useState('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [authError, setAuthError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [googleClientId, setGoogleClientId] = useState(import.meta.env.VITE_GOOGLE_CLIENT_ID || '');

    const [memberTab, setMemberTab] = useState('feed_prefs');
    const [profileName, setProfileName] = useState('');
    const [currentPass, setCurrentPass] = useState('');
    const [newPass, setNewPass] = useState('');
    const [confirmNewPass, setConfirmNewPass] = useState('');
    const [secMessage, setSecMessage] = useState({ type: '', text: '' });
    const [savedNotice, setSavedNotice] = useState(false);

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
            setProfileName(user.displayName || '');
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
                    if (res.data.googleClientId && !googleClientId) {
                        setGoogleClientId(res.data.googleClientId);
                    }
                }
            })
            .catch(() => {});
    }, [user]);

    useEffect(() => {
        if (isLoggedIn || !googleClientId) {
            if (googleBtnRef.current) googleBtnRef.current.innerHTML = '';
            return;
        }

        let cancelled = false;
        const scriptId = 'google-gsi-client';

        if (!document.getElementById(scriptId)) {
            const script = document.createElement('script');
            script.id = scriptId;
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            script.onload = initGoogle;
            document.body.appendChild(script);
        } else {
            initGoogle();
        }

        function initGoogle() {
            if (cancelled || isLoggedIn || !window.google?.accounts?.id) return;
            try {
                window.google.accounts.id.initialize({
                    client_id: googleClientId,
                    callback: async (response) => {
                        if (!response.credential) return;
                        setSubmitting(true);
                        setAuthError('');
                        try {
                            const res = await api.post('/auth/google', { credential: response.credential });
                            if (googleBtnRef.current) googleBtnRef.current.innerHTML = '';
                            loginSuccess(res.data.token, res.data.user);
                            if (!res.data.isNewUser) navigate('/');
                        } catch (err) {
                            setAuthError(err.response?.data?.error || 'خطا در ورود با حساب گوگل');
                        } finally {
                            setSubmitting(false);
                        }
                    }
                });

                if (googleBtnRef.current) {
                    googleBtnRef.current.innerHTML = '';
                    window.google.accounts.id.renderButton(googleBtnRef.current, {
                        type: 'standard',
                        theme: 'filled_black',
                        size: 'large',
                        shape: 'pill',
                        text: 'continue_with',
                        locale: 'fa',
                        width: 360
                    });
                }
            } catch {}
        }

        return () => {
            cancelled = true;
            if (googleBtnRef.current) {
                googleBtnRef.current.innerHTML = '';
            }
        };
    }, [isLoggedIn, googleClientId, authTab, loginSuccess, navigate]);

    const isRegisterValid = useMemo(() => {
        return (
            displayName.trim().length >= 2 &&
            email.includes('@') &&
            password.length >= 8 &&
            /[a-zA-Z]/.test(password) &&
            /\d/.test(password) &&
            password === confirmPassword
        );
    }, [displayName, email, password, confirmPassword]);

    const handleAuthSubmit = async (e) => {
        e.preventDefault();
        setAuthError('');

        if (authTab === 'register') {
            if (password !== confirmPassword) {
                setAuthError('رمز عبور و تکرار آن یکسان نیستند');
                return;
            }
            if (!isRegisterValid) {
                setAuthError('لطفاً تمامی معیارهای امنیتی رمز عبور را رعایت کنید');
                return;
            }
        }

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
                setMemberTab('feed_prefs');
            }
        } catch (err) {
            setAuthError(err.response?.data?.error || 'خطا در برقراری ارتباط با سرور');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSaveFeedPrefs = async () => {
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

    const handleUpdateDisplayName = async (e) => {
        e.preventDefault();
        if (!profileName.trim()) return;
        setSubmitting(true);
        setSecMessage({ type: '', text: '' });
        try {
            await savePreferences({ displayName: profileName.trim() });
            setSecMessage({ type: 'success', text: 'نام نمایشی شما با موفقیت به‌روزرسانی شد.' });
        } catch (err) {
            setSecMessage({ type: 'error', text: err.response?.data?.error || 'خطا در ذخیره نام نمایشی' });
        } finally {
            setSubmitting(false);
        }
    };

    const hasPassword = user?.hasPassword !== false;

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setSecMessage({ type: '', text: '' });

        if (newPass !== confirmNewPass) {
            setSecMessage({ type: 'error', text: 'رمز عبور جدید و تکرار آن یکسان نیستند.' });
            return;
        }
        if (newPass.length < 8 || !/[a-zA-Z]/.test(newPass) || !/\d/.test(newPass)) {
            setSecMessage({ type: 'error', text: 'رمز عبور باید حداقل ۸ کاراکتر و شامل حروف انگلیسی و عدد باشد.' });
            return;
        }

        setSubmitting(true);
        try {
            const res = await api.put('/user/password', {
                currentPassword: hasPassword ? currentPass : '',
                newPassword: newPass
            });
            setCurrentPass('');
            setNewPass('');
            setConfirmNewPass('');
            if (res.data?.user) {
                loginSuccess(localStorage.getItem('duta_token'), res.data.user);
            }
            setSecMessage({ type: 'success', text: res.data?.status || 'رمز عبور با موفقیت ثبت شد.' });
        } catch (err) {
            setSecMessage({ type: 'error', text: err.response?.data?.error || 'رمز عبور فعلی اشتباه است.' });
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

    // ─── حالت ۱: فرم ورود و ثبت‌نام (با key اختصاصی برای تخریب کامل DOM پس از ورود) ───
    if (!isLoggedIn) {
        return (
            <div key="guest-auth-view" className="auth-page-wrap">
                <div className="auth-card">
                    <div className="auth-brand-head">
                        <DutaLogo />
                        <h1 className="auth-title">
                            {authTab === 'login' ? 'ورود به حساب Duta' : 'ساخت حساب کاربری در Duta'}
                        </h1>
                        <p className="auth-subtitle">
                            روزنامه شخصی خود را بسازید، منابع معتبر را دنبال کنید و تابلوی بازار خود را بچینید.
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
                            ایجاد حساب جدید
                        </button>
                    </div>

                    {/* کانتینر اختصاصی دکمه گوگل */}
                    <div
                        ref={googleBtnRef}
                        style={{
                            display: 'flex',
                            justifyContent: 'center',
                            minHeight: '42px',
                            marginBottom: '4px'
                        }}
                    />

                    <div className="auth-divider">
                        <span>یا با ایمیل</span>
                    </div>

                    <form onSubmit={handleAuthSubmit} className="auth-form">
                        {authTab === 'register' && (
                            <div className="auth-field">
                                <label htmlFor="auth-name">نام نمایشی</label>
                                <input
                                    id="auth-name"
                                    type="text"
                                    placeholder="نام شما در Duta"
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
                                    {showPassword ? 'پنهان کردن رمز' : 'نمایش رمز'}
                                </button>
                            </div>
                            <input
                                id="auth-pass"
                                type={showPassword ? 'text' : 'password'}
                                dir="ltr"
                                placeholder={authTab === 'register' ? 'حداقل ۸ کاراکتر (حروف و عدد)' : '••••••••'}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        {authTab === 'register' && (
                            <>
                                <div className="auth-field">
                                    <label htmlFor="auth-pass-confirm">تکرار رمز عبور</label>
                                    <input
                                        id="auth-pass-confirm"
                                        type={showPassword ? 'text' : 'password'}
                                        dir="ltr"
                                        placeholder="رمز عبور را مجدداً وارد کنید"
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        required
                                    />
                                </div>

                                <PasswordCriteriaChecklist
                                    password={password}
                                    confirmPassword={confirmPassword}
                                />
                            </>
                        )}

                        {authError && (
                            <div className="auth-error-box">
                                {authError}
                            </div>
                        )}

                        <button
                            type="submit"
                            className="auth-submit-btn"
                            disabled={submitting || (authTab === 'register' && !isRegisterValid)}
                        >
                            {submitting
                                ? 'در حال بررسی...'
                                : (authTab === 'login' ? 'ورود به حساب کاربری' : 'ایجاد حساب و انتخاب علایق')}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // ─── حالت ۲: پنل حساب کاربری و علایق (با key مجزا) ───
    return (
        <div key="member-account-view" className="page-content" style={{ maxWidth: '680px' }}>
            <div className="prefs-card">
                <div className="prefs-top-bar">
                    <div>
                        <h1 className="prefs-title">حساب کاربری من</h1>
                        <p className="prefs-subtitle">
                            {user.displayName} · <span dir="ltr">{user.email}</span>
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

                <div className="x-tabs-bar" style={{ marginTop: '14px', marginBottom: '18px' }}>
                    <div className="x-tabs">
                        <button
                            type="button"
                            className={`x-tab ${memberTab === 'feed_prefs' ? 'active' : ''}`}
                            onClick={() => { setMemberTab('feed_prefs'); setSecMessage({ type: '', text: '' }); }}
                        >
                            سلیقه خبری و منابع
                        </button>
                        <button
                            type="button"
                            className={`x-tab ${memberTab === 'profile_security' ? 'active' : ''}`}
                            onClick={() => { setMemberTab('profile_security'); setSecMessage({ type: '', text: '' }); }}
                        >
                            پروفایل و تغییر رمز
                        </button>
                    </div>
                </div>

                {memberTab === 'feed_prefs' ? (
                    <div>
                        <div className="x-layer-box" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0 }}>
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

                        {availableSources.length > 0 && (
                            <div className="x-layer-box">
                                <div className="x-layer-label">۳. خبرگزاری‌های تخصصی پیشنهادی (بر اساس انتخاب شما)</div>
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
                            <button type="button" className="auth-submit-btn" style={{ width: 'auto', padding: '10px 26px', marginTop: 0 }} onClick={handleSaveFeedPrefs} disabled={submitting}>
                                {savedNotice ? '✓ ذخیره شد' : (submitting ? 'در حال ذخیره...' : 'ذخیره و مشاهده فید من')}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div>
                        {secMessage.text && (
                            <div
                                className="auth-error-box"
                                style={{
                                    marginBottom: '16px',
                                    background: secMessage.type === 'success' ? 'rgba(0,186,124,0.12)' : undefined,
                                    borderColor: secMessage.type === 'success' ? 'rgba(0,186,124,0.35)' : undefined,
                                    color: secMessage.type === 'success' ? 'var(--green)' : undefined
                                }}
                            >
                                {secMessage.text}
                            </div>
                        )}

                        <form onSubmit={handleUpdateDisplayName} className="auth-form" style={{ marginBottom: '26px', paddingBottom: '22px', borderBottom: '1px solid var(--separator)' }}>
                            <div className="x-layer-label" style={{ marginBottom: '4px' }}>مشخصات پروفایل</div>
                            <div className="auth-field">
                                <label>آدرس ایمیل (شناسه حساب)</label>
                                <input type="email" dir="ltr" value={user.email || ''} disabled style={{ opacity: 0.6, cursor: 'not-allowed' }} />
                            </div>
                            <div className="auth-field">
                                <label htmlFor="prof-name">نام نمایشی</label>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <input
                                        id="prof-name"
                                        type="text"
                                        style={{ flex: 1 }}
                                        value={profileName}
                                        onChange={e => setProfileName(e.target.value)}
                                        required
                                    />
                                    <button type="submit" className="auth-submit-btn" style={{ width: 'auto', marginTop: 0, padding: '0 22px' }} disabled={submitting}>
                                        به‌روزرسانی نام
                                    </button>
                                </div>
                            </div>
                        </form>

                        <form onSubmit={handleChangePassword} className="auth-form">
                            <div className="x-layer-label" style={{ marginBottom: '4px' }}>
                                {hasPassword ? 'تغییر رمز عبور' : 'تعریف رمز عبور برای حساب گوگل'}
                            </div>

                            {!hasPassword && (
                                <p style={{ fontSize: '12.5px', color: 'var(--label-2)', marginBottom: '6px', lineHeight: 1.6 }}>
                                    حساب شما از طریق گوگل ساخته شده است. با تعریف رمز عبور، علاوه بر دکمه گوگل می‌توانید با ایمیل و رمز عبور نیز وارد شوید.
                                </p>
                            )}

                            {hasPassword && (
                                <div className="auth-field">
                                    <label htmlFor="cur-pass">رمز عبور فعلی</label>
                                    <input
                                        id="cur-pass"
                                        type={showPassword ? 'text' : 'password'}
                                        dir="ltr"
                                        placeholder="••••••••"
                                        value={currentPass}
                                        onChange={e => setCurrentPass(e.target.value)}
                                        required
                                    />
                                </div>
                            )}

                            <div className="auth-field">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <label htmlFor="new-pass">{hasPassword ? 'رمز عبور جدید' : 'رمز عبور'}</label>
                                    <button type="button" className="auth-pass-toggle" onClick={() => setShowPassword(p => !p)}>
                                        {showPassword ? 'پنهان کردن رمز' : 'نمایش رمز'}
                                    </button>
                                </div>
                                <input
                                    id="new-pass"
                                    type={showPassword ? 'text' : 'password'}
                                    dir="ltr"
                                    placeholder="حداقل ۸ کاراکتر (حروف و عدد)"
                                    value={newPass}
                                    onChange={e => setNewPass(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="auth-field">
                                <label htmlFor="conf-new-pass">{hasPassword ? 'تکرار رمز عبور جدید' : 'تکرار رمز عبور'}</label>
                                <input
                                    id="conf-new-pass"
                                    type={showPassword ? 'text' : 'password'}
                                    dir="ltr"
                                    placeholder="تکرار رمز عبور"
                                    value={confirmNewPass}
                                    onChange={e => setConfirmNewPass(e.target.value)}
                                    required
                                />
                            </div>

                            <PasswordCriteriaChecklist
                                password={newPass}
                                confirmPassword={confirmNewPass}
                            />

                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                                <button
                                    type="submit"
                                    className="auth-submit-btn"
                                    style={{ width: 'auto', padding: '11px 28px' }}
                                    disabled={submitting || (hasPassword && !currentPass) || newPass.length < 8 || newPass !== confirmNewPass}
                                >
                                    {submitting ? 'در حال ثبت...' : (hasPassword ? 'تغییر رمز عبور' : 'ثبت رمز عبور')}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}

export default AuthPage;