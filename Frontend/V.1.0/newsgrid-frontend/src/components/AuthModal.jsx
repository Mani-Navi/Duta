import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

const IRAN_CITIES = [
    'تهران', 'مشهد', 'اصفهان', 'کرج', 'شیراز', 'تبریز', 'اهواز', 'قم',
    'کرمانشاه', 'ارومیه', 'رشت', 'زاهدان', 'همدان', 'کرمان', 'یزد',
    'اردبیل', 'بندرعباس', 'اراک', 'اسلامشهر', 'زنجان', 'سنندج', 'قزوین',
    'خرم‌آباد', 'گرگان', 'ساری', 'بوشهر', 'بیرجند', 'ایلام', 'شهرکرد', 'یاسوج'
];

const getPasswordStrength = (password) => {
    if (password.length === 0) return null;
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    if (score <= 1) return { label: 'ضعیف', color: '#FF3B30', width: '33%' };
    if (score <= 3) return { label: 'متوسط', color: '#FF9500', width: '66%' };
    return { label: 'قوی', color: '#34C759', width: '100%' };
};

function AuthModal({ onClose }) {
    const [mode, setMode] = useState('login');
    const [form, setForm] = useState({
        email: '', password: '', confirmPassword: '', name: '', city: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login, register } = useAuth();

    const strength = mode === 'register' ? getPasswordStrength(form.password) : null;

    const validate = () => {
        if (!form.email || !form.password) return 'ایمیل و رمز عبور الزامی است';
        if (!form.email.includes('@')) return 'ایمیل معتبر وارد کنید';
        if (mode === 'register') {
            if (!form.name.trim()) return 'نام الزامی است';
            if (form.password.length < 8) return 'رمز عبور باید حداقل ۸ کاراکتر باشد';
            if (form.password !== form.confirmPassword) return 'رمز عبور و تکرار آن یکسان نیستند';
        }
        return null;
    };

    const handleSubmit = async () => {
        const err = validate();
        if (err) { setError(err); return; }

        try {
            setLoading(true);
            setError('');
            if (mode === 'login') {
                await login(form.email, form.password);
            } else {
                await register(form.email, form.password, form.name, form.city);
            }
            onClose();
        } catch (err) {
            setError(err.response?.data?.error || 'خطایی رخ داد');
        } finally {
            setLoading(false);
        }
    };

    const switchMode = (m) => {
        setMode(m);
        setError('');
        setForm({ email: '', password: '', confirmPassword: '', name: '', city: '' });
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box" onClick={e => e.stopPropagation()}>

                <div className="modal-header">
                    <div className="modal-logo">News<span>Grid</span></div>
                    <button className="modal-close" onClick={onClose} aria-label="بستن">
                        <i className="ti ti-x" />
                    </button>
                </div>

                <div className="modal-tabs">
                    <button className={`modal-tab ${mode === 'login' ? 'active' : ''}`}
                            onClick={() => switchMode('login')}>ورود</button>
                    <button className={`modal-tab ${mode === 'register' ? 'active' : ''}`}
                            onClick={() => switchMode('register')}>ثبت‌نام</button>
                </div>

                <div className="modal-form">
                    {mode === 'register' && (
                        <>
                            <input className="modal-input" type="text" placeholder="نام و نام خانوادگی"
                                   value={form.name}
                                   onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />

                            <select className="modal-input modal-select" value={form.city}
                                    onChange={e => setForm(p => ({ ...p, city: e.target.value }))}>
                                <option value="">شهر (اختیاری)</option>
                                {IRAN_CITIES.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </>
                    )}

                    <input className="modal-input" type="email" placeholder="ایمیل"
                           value={form.email}
                           onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />

                    {/* رمز عبور با نمایش/مخفی */}
                    <div className="modal-input-wrap">
                        <input className="modal-input" style={{ paddingLeft: '44px' }}
                               type={showPassword ? 'text' : 'password'}
                               placeholder="رمز عبور"
                               value={form.password}
                               onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
                        <button className="modal-eye" type="button"
                                onClick={() => setShowPassword(p => !p)}
                                aria-label={showPassword ? 'مخفی کردن رمز' : 'نمایش رمز'}>
                            <i className={`ti ${showPassword ? 'ti-eye-off' : 'ti-eye'}`} />
                        </button>
                    </div>

                    {/* قدرت رمز */}
                    {strength && (
                        <div className="password-strength">
                            <div className="strength-bar">
                                <div className="strength-fill"
                                     style={{ width: strength.width, background: strength.color }} />
                            </div>
                            <span style={{ color: strength.color }}>{strength.label}</span>
                        </div>
                    )}

                    {/* تکرار رمز عبور */}
                    {mode === 'register' && (
                        <div className="modal-input-wrap">
                            <input className="modal-input"
                                   style={{
                                       paddingLeft: '44px',
                                       borderColor: form.confirmPassword && form.password !== form.confirmPassword
                                           ? '#FF3B30' : undefined
                                   }}
                                   type={showPassword ? 'text' : 'password'}
                                   placeholder="تکرار رمز عبور"
                                   value={form.confirmPassword}
                                   onChange={e => setForm(p => ({ ...p, confirmPassword: e.target.value }))}
                                   onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
                            {form.confirmPassword && (
                                <i className={`ti modal-check ${form.password === form.confirmPassword
                                    ? 'ti-check' : 'ti-x'}`}
                                   style={{ color: form.password === form.confirmPassword ? '#34C759' : '#FF3B30' }} />
                            )}
                        </div>
                    )}

                    {mode === 'login' && (
                        <input className="modal-input" type="password" placeholder="رمز عبور"
                               style={{ display: 'none' }} /> // dummy for autocomplete
                    )}

                    {error && <div className="modal-error">{error}</div>}

                    <button className="modal-submit" onClick={handleSubmit} disabled={loading}>
                        {loading ? 'در حال پردازش...' : mode === 'login' ? 'ورود' : 'ثبت‌نام'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default AuthModal;
