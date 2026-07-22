import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

function AuthModal({ onClose }) {
    const [mode, setMode] = useState('login'); // login | register
    const [form, setForm] = useState({ email: '', password: '', name: '', city: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login, register } = useAuth();

    const handleSubmit = async () => {
        if (!form.email || !form.password) {
            setError('ایمیل و رمز عبور الزامی است');
            return;
        }
        if (mode === 'register' && !form.name) {
            setError('نام الزامی است');
            return;
        }

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

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box" onClick={e => e.stopPropagation()}>

                {/* header */}
                <div className="modal-header">
                    <div className="modal-logo">News<span>Grid</span></div>
                    <button className="modal-close" onClick={onClose} aria-label="بستن">
                        <i className="ti ti-x" />
                    </button>
                </div>

                {/* tab */}
                <div className="modal-tabs">
                    <button
                        className={`modal-tab ${mode === 'login' ? 'active' : ''}`}
                        onClick={() => { setMode('login'); setError(''); }}
                    >
                        ورود
                    </button>
                    <button
                        className={`modal-tab ${mode === 'register' ? 'active' : ''}`}
                        onClick={() => { setMode('register'); setError(''); }}
                    >
                        ثبت‌نام
                    </button>
                </div>

                {/* فرم */}
                <div className="modal-form">
                    {mode === 'register' && (
                        <>
                            <input
                                className="modal-input"
                                type="text"
                                placeholder="نام"
                                value={form.name}
                                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                            />
                            <input
                                className="modal-input"
                                type="text"
                                placeholder="شهر (اختیاری)"
                                value={form.city}
                                onChange={e => setForm(p => ({ ...p, city: e.target.value }))}
                            />
                        </>
                    )}
                    <input
                        className="modal-input"
                        type="email"
                        placeholder="ایمیل"
                        value={form.email}
                        onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                    />
                    <input
                        className="modal-input"
                        type="password"
                        placeholder="رمز عبور"
                        value={form.password}
                        onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                    />

                    {error && <div className="modal-error">{error}</div>}

                    <button
                        className="modal-submit"
                        onClick={handleSubmit}
                        disabled={loading}
                    >
                        {loading ? 'در حال پردازش...' : mode === 'login' ? 'ورود' : 'ثبت‌نام'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default AuthModal;
