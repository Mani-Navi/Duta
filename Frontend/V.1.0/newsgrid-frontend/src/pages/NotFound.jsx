import { useNavigate } from 'react-router-dom';
import DutaLogo from '../components/DutaLogo';

function NotFound() {
    const navigate = useNavigate();

    return (
        <div className="page-content" style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                <DutaLogo breaking={true} />
            </div>
            <h1 style={{ fontSize: '64px', fontWeight: 800, color: 'var(--blue)', lineHeight: 1, marginBottom: '12px' }}>
                404
            </h1>
            <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '10px', color: 'var(--label)' }}>
                صفحه یا خبر مورد نظر یافت نشد
            </h2>
            <p style={{ fontSize: '14.5px', color: 'var(--label-2)', maxWidth: '420px', margin: '0 auto 28px', lineHeight: 1.7 }}>
                ممکن است آدرس صفحه را اشتباه وارد کرده باشید یا این خبر پس از گذشت ۳۰ روز از آرشیو خودکار Duta حذف شده باشد.
            </p>
            <button
                className="retry-btn"
                onClick={() => navigate('/')}
                aria-label="بازگشت به صفحه اصلی اخبار"
            >
                <i className="ti ti-home" aria-hidden="true" />
                مشاهده آخرین اخبار
            </button>
        </div>
    );
}

export default NotFound;