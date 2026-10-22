function Privacy() {
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
                        <h2>{s.title}</h2>
                        <p>{s.desc}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default Privacy;