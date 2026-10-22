import { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import { Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import BottomNav from './components/BottomNav';
import PriceTicker from './components/PriceTicker';
import Home from './pages/Home';
import ErrorBoundary from './components/ErrorBoundary';
import DutaLogo from './components/DutaLogo';
import api from './api/axiosConfig';
import './App.css';

const ArticleDetail = lazy(() => import('./pages/ArticleDetail'));
const Features = lazy(() => import('./pages/Features'));
const Credibility = lazy(() => import('./pages/Credibility'));
const About = lazy(() => import('./pages/About'));

const DEFAULT_TITLE = 'Duta — دو نگاه، یک حقیقت | پلتفرم هوشمند تجمیع و سنجش اعتبار اخبار';
const DEFAULT_DESC = 'Duta (دوتا) — پلتفرم هوشمند تجمیع، خوشه‌بندی و سنجش اعتبار اخبار فارسی. اخبار فوری، سیاسی، اقتصادی، ورزشی و تکنولوژی را با امتیاز اعتبار منابع دنبال کنید.';

function syncDocumentSeoTags({ title, description, canonicalUrl }) {
    document.title = title || DEFAULT_TITLE;

    const setMeta = (selector, content) => {
        const el = document.querySelector(selector);
        if (el && content) el.setAttribute('content', content);
    };

    setMeta('meta[name="description"]', description || DEFAULT_DESC);
    setMeta('meta[property="og:title"]', title || DEFAULT_TITLE);
    setMeta('meta[property="og:description"]', description || DEFAULT_DESC);
    setMeta('meta[property="og:url"]', canonicalUrl || 'https://duta.ir/');

    let canonicalEl = document.querySelector('link[rel="canonical"]');
    if (!canonicalEl) {
        canonicalEl = document.createElement('link');
        canonicalEl.setAttribute('rel', 'canonical');
        document.head.appendChild(canonicalEl);
    }
    canonicalEl.setAttribute('href', canonicalUrl || 'https://duta.ir/');
}

function NotFoundPage() {
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

function PrivacyPage() {
    const sections = [
        {
            icon: "ti-shield-lock",
            title: "عدم دریافت اطلاعات هویتی",
            desc: "استفاده از پلتفرم خبری Duta کاملاً آزاد و رایگان است و برای مطالعه اخبار، جستجو یا بررسی اعتبار منابع نیازی به ثبت‌نام یا ارائه اطلاعات شخصی (مانند شماره تماس یا نام) نیست."
        },
        {
            icon: "ti-chart-bar",
            title: "داده‌های آماری و کوکی‌ها",
            desc: "ما صرفاً از کوکی‌های استاندارد تحلیلی (Google Analytics) به صورت ناشناس برای سنجش سرعت بارگذاری صفحات و بهبود تجربه کاربری استفاده می‌کنیم و هیچ‌گونه ردیابی تبلیغاتی انجام نمی‌دهیم."
        },
        {
            icon: "ti-lock",
            title: "امنیت ارتباطات و عدم اشتراک‌گذاری",
            desc: "تمامی ارتباطات شما با سرورهای Duta از طریق پروتکل امن HTTPS (TLS 1.3) رمزنگاری می‌شود و هیچ داده‌ای با اشخاص یا شرکت‌های ثالث به اشتراک گذاشته نمی‌شود."
        }
    ];

    return (
        <div className="page-content">
            <div className="page-header">
                <h1>سیاست حفظ حریم خصوصی</h1>
                <p>در Duta، احترام به حریم خصوصی و امنیت داده‌های کاربران اولویت اصلی ماست.</p>
            </div>

            <div className="feature-grid">
                {sections.map((s, i) => (
                    <div className="feature-card" key={i}>
                        <div className="feature-icon">
                            <i className={`ti ${s.icon}`} aria-hidden="true" />
                        </div>
                        <h3>{s.title}</h3>
                        <p>{s.desc}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

function TermsPage() {
    const terms = [
        {
            icon: "ti-rss",
            title: "ماهیت خودکار تجمیع اخبار",
            desc: "پلتفرم Duta یک موتور هوشمند تجمیع خبر (News Aggregator) است که تیتر و خلاصه اخبار را به صورت خودکار از فیدهای عمومی RSS خبرگزاری‌های رسمی جمع‌آوری می‌کند. مسئولیت حقوقی و محتوایی هر خبر بر عهده رسانه منتشرکننده اصلی است."
        },
        {
            icon: "ti-cpu",
            title: "محاسبه الگوریتمی امتیاز اعتبار",
            desc: "امتیاز اعتبار نمایش‌داده‌شده برای هر خبر یا خوشه خبری، حاصل پردازش آماری و ریاضی (الگوریتم شباهت جاکارد و فرمول وزنی بیزین بر اساس تعداد و سابقه منابع پوشش‌دهنده) بوده و به منزله قضاوت انسانی یا تایید و رد قطعی حقوقی نیست."
        },
        {
            icon: "ti-external-link",
            title: "حقوق مالکیت فکری و ارجاع به منبع",
            desc: "تمامی حقوق مادی و معنوی اخبار متعلق به رسانه‌های منتشرکننده است. Duta همواره نام منبع را به صورت شفاف درج کرده و کاربر را برای مطالعه متن کامل خبر مستقیماً به وب‌سایت اصلی منبع ارجاع می‌دهد."
        }
    ];

    return (
        <div className="page-content">
            <div className="page-header">
                <h1>قوانین استفاده و سلب مسئولیت</h1>
                <p>شرایط بهره‌برداری از خدمات پلتفرم تجمیع و سنجش اعتبار خبر Duta</p>
            </div>

            <div className="feature-grid">
                {terms.map((item, i) => (
                    <div className="feature-card" key={i}>
                        <div className="feature-icon">
                            <i className={`ti ${item.icon}`} aria-hidden="true" />
                        </div>
                        <h3>{item.title}</h3>
                        <p>{item.desc}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

function ArticleDetailPage() {
    const { slug } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const isBreakingInit = location.state?.breaking || false;

    const [article, setArticle] = useState(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        let isMounted = true;
        setArticle(null);
        setLoading(true);
        setNotFound(false);

        const isNumericId = /^\d+$/.test(slug);
        const endpoint = isNumericId
            ? `/articles/${slug}`
            : `/articles/slug/${encodeURIComponent(slug)}`;

        api.get(endpoint)
            .then(res => {
                if (!isMounted) return;
                const data = res.data;
                setArticle(data);
                if (data?.title) {
                    const canonicalSlug = data.slug || data.id;
                    const score = data.cluster?.credibilityScore ?? data.source?.credibility ?? 50;
                    const seoDesc = data.description
                        ? `امتیاز اعتبار: ${score}٪ | ${data.description}`
                        : `امتیاز اعتبار: ${score}٪ | ${data.title}`;

                    syncDocumentSeoTags({
                        title: `${data.title} | Duta`,
                        description: seoDesc,
                        canonicalUrl: `https://duta.ir/article/${canonicalSlug}`
                    });
                }
            })
            .catch(async () => {
                if (isMounted && location.state?.articleData) {
                    setArticle(location.state.articleData);
                } else if (isMounted) {
                    setNotFound(true);
                }
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [slug, navigate, location.state]);

    const handleBack = () => {
        if (window.history.state && window.history.state.idx > 0) {
            navigate(-1);
        } else {
            navigate('/');
        }
    };

    if (loading) {
        return (
            <div className="nitt-loading-box">
                <DutaLogo loading={true} breaking={isBreakingInit} />
                <span className="nitt-loading-text">در حال تحلیل و بارگذاری خبر...</span>
            </div>
        );
    }

    if (notFound || !article) {
        return <NotFoundPage />;
    }

    return (
        <main id="main-content" aria-label="محتوای خبر">
            <div className="back-bar">
                <button className="back-btn" onClick={handleBack} aria-label="بازگشت به اخبار">
                    <i className="ti ti-chevron-right" aria-hidden="true" />
                    بازگشت به اخبار
                </button>
            </div>
            <ArticleDetail article={article} />
        </main>
    );
}

function AppLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const [dark, setDark] = useState(() =>
        window.matchMedia("(prefers-color-scheme: dark)").matches
    );
    const [searchKeyword, setSearchKeyword] = useState('');
    const [restoreScroll, setRestoreScroll] = useState(null);

    useEffect(() => {
        if (window.gtag) {
            window.gtag('config', 'G-5ZTGQ5ZVBJ', {
                page_path: location.pathname + location.search,
            });
        }

        if (location.pathname === '/') {
            syncDocumentSeoTags({
                title: DEFAULT_TITLE,
                description: DEFAULT_DESC,
                canonicalUrl: 'https://duta.ir/'
            });
        } else if (location.pathname === '/features') {
            syncDocumentSeoTags({
                title: 'ویژگی‌های پلتفرم خبری Duta | خوشه‌بندی و سنجش اعتبار خبر',
                description: 'آشنایی با امکانات Duta: امتیاز اعتبار زنده، مقایسه چند منبع، فیلتر دسته‌بندی و هشدار شایعه.',
                canonicalUrl: 'https://duta.ir/features'
            });
        } else if (location.pathname === '/credibility') {
            syncDocumentSeoTags({
                title: 'الگوریتم امتیاز اعتبار خبر در Duta | تشخیص خبر معتبر از شایعه',
                description: 'نحوه کار الگوریتم امتیازدهی بیزین و خوشه‌بندی اخبار در Duta برای سنجش اعتبار رسانه‌ها.',
                canonicalUrl: 'https://duta.ir/credibility'
            });
        } else if (location.pathname === '/about') {
            syncDocumentSeoTags({
                title: 'درباره Duta — دو نگاه، یک حقیقت',
                description: 'درباره پلتفرم تجمیع و اعتبارسنجی اخبار فارسی Duta و راه‌های ارتباطی.',
                canonicalUrl: 'https://duta.ir/about'
            });
        } else if (location.pathname === '/privacy') {
            syncDocumentSeoTags({
                title: 'سیاست حفظ حریم خصوصی | Duta',
                description: 'سیاست حفظ حریم خصوصی و امنیت داده‌های کاربران در پلتفرم خبری Duta.',
                canonicalUrl: 'https://duta.ir/privacy'
            });
        } else if (location.pathname === '/terms') {
            syncDocumentSeoTags({
                title: 'قوانین استفاده و سلب مسئولیت | Duta',
                description: 'قوانین بهره‌برداری، نحوه کارکرد الگوریتم اعتبارسنجی و سلب مسئولیت منابع خبری در Duta.',
                canonicalUrl: 'https://duta.ir/terms'
            });
        } else if (!location.pathname.startsWith('/article/')) {
            syncDocumentSeoTags({
                title: 'صفحه یافت نشد (404) | Duta',
                description: DEFAULT_DESC,
                canonicalUrl: 'https://duta.ir/'
            });
        }
    }, [location]);

    const isHome = location.pathname === '/';
    const isDetail = location.pathname.startsWith('/article/');
    const view = isDetail ? 'detail'
        : location.pathname === '/features' ? 'features'
            : location.pathname === '/credibility' ? 'credibility'
                : location.pathname === '/about' ? 'about'
                    : isHome ? 'home' : 'other';

    const handleSearch = useCallback((keyword) => {
        setSearchKeyword(prev => {
            if (prev !== keyword && keyword) {
                navigate('/');
            }
            return keyword;
        });
    }, [navigate]);

    const openArticle = useCallback((article) => {
        setRestoreScroll(window.scrollY);
        const targetSlug = article.slug || article.id;
        navigate(`/article/${targetSlug}`, {
            state: {
                breaking: article.breaking,
                articleData: article
            }
        });
    }, [navigate]);

    const handleNavigate = useCallback((v) => {
        if (v === 'home') {
            setRestoreScroll(0);
            setSearchKeyword('');
            window.scrollTo(0, 0);
            navigate('/');
        } else {
            navigate(`/${v}`);
        }
    }, [navigate]);

    useEffect(() => {
        if (location.pathname === '/') {
            if (restoreScroll !== null) {
                window.scrollTo({ top: restoreScroll, behavior: 'instant' });
            }
        } else {
            window.scrollTo(0, 0);
        }
    }, [location.pathname, restoreScroll]);

    useEffect(() => {
        document.documentElement.setAttribute('dir', 'rtl');
        document.documentElement.setAttribute('lang', 'fa');
    }, []);

    useEffect(() => {
        document.body.classList.toggle('dark', dark);
    }, [dark]);

    return (
        <ErrorBoundary>
            <div>
                <header className="mobile-only mobile-header-centered">
                    <a
                        href="/"
                        className="logo"
                        dir="ltr"
                        onClick={(e) => { e.preventDefault(); handleNavigate('home'); }}
                        aria-label="Duta - دو نگاه، یک حقیقت"
                    >
                        <DutaLogo />
                        <span className="logo-text">Duta</span>
                        <span className="logo-divider" aria-hidden="true" />
                        <span className="logo-sub" dir="rtl">دو نگاه، یک حقیقت</span>
                    </a>
                </header>

                <div className="mobile-only" style={{ padding: '6px 0', background: 'var(--navbar-bg)' }}>
                    <PriceTicker />
                </div>

                <div className="desktop-only">
                    <Navbar
                        dark={dark} view={view}
                        onToggleTheme={() => setDark(prev => !prev)}
                        onNavigate={handleNavigate}
                        onSearch={handleSearch}
                    />
                </div>

                <main id="main-content" aria-label="محتوای اصلی اخبار">
                    <div style={{ display: view === 'home' ? 'block' : 'none' }}>
                        <Home onOpenArticle={openArticle} searchKeyword={searchKeyword} />
                    </div>

                    <Suspense fallback={
                        <div className="nitt-loading-box">
                            <DutaLogo loading={true} />
                            <span className="nitt-loading-text">در حال بارگذاری...</span>
                        </div>
                    }>
                        <Routes>
                            <Route path="/" element={null} />
                            <Route path="/article/:slug" element={<ArticleDetailPage />} />
                            <Route path="/features" element={<Features />} />
                            <Route path="/credibility" element={<Credibility />} />
                            <Route path="/about" element={<About />} />
                            <Route path="/privacy" element={<PrivacyPage />} />
                            <Route path="/terms" element={<TermsPage />} />
                            <Route path="*" element={<NotFoundPage />} />
                        </Routes>
                    </Suspense>
                </main>

                <footer className="footer-note" style={{ padding: '28px 20px 90px', textAlign: 'center' }} role="contentinfo">
                    <nav aria-label="لینک‌های فوتر" style={{ display: 'flex', justifyContent: 'center', gap: '18px', flexWrap: 'wrap', marginBottom: '12px', fontWeight: 600 }}>
                        <a href="/about" onClick={(e) => { e.preventDefault(); handleNavigate('about'); }}>درباره ما</a>
                        <a href="/credibility" onClick={(e) => { e.preventDefault(); handleNavigate('credibility'); }}>روش سنجش اعتبار</a>
                        <a href="/privacy" onClick={(e) => { e.preventDefault(); handleNavigate('privacy'); }}>حریم خصوصی</a>
                        <a href="/terms" onClick={(e) => { e.preventDefault(); handleNavigate('terms'); }}>قوانین و سلب مسئولیت</a>
                        <a href="mailto:info@duta.ir">info@duta.ir</a>
                    </nav>
                    <div style={{ opacity: 0.75 }}>
                        تمامی حقوق برای Duta محفوظ است © {new Date().getFullYear()} — ایران، تهران
                    </div>
                </footer>

                <div className="mobile-only">
                    <BottomNav
                        view={view} dark={dark}
                        onNavigate={handleNavigate}
                        onSearch={handleSearch}
                        onToggleTheme={() => setDark(prev => !prev)}
                    />
                </div>
            </div>
        </ErrorBoundary>
    );
}

export default AppLayout;