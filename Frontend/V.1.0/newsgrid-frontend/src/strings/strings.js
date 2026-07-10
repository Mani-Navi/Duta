const strings = {
    fa: {
        dir: 'rtl',
        features: "ویژگی‌ها",
        credibility: "امتیاز اعتبار",
        backLabel: "اخبار",
        categories: ["همه", "جهانی", "سیاسی", "اقتصادی", "ورزشی", "تکنولوژی"],
        sourcesCoveredBy: (n) => `پوشش داده شده توسط ${n} منبع`,
        clickToRead: "برای مطالعه خبر روی هر منبع کلیک کنید",
        loading: "در حال بارگذاری...",
        error: "خطا در دریافت اخبار",
        featuresTitle: "ویژگی‌ها",
        featuresDesc: "NewsGrid برای یک هدف ساخته شده: کمک به شما برای تشخیص خبر معتبر از شایعه، در کمترین زمان ممکن.",
        featureList: [
            { icon: "ti-shield-check", title: "امتیاز اعتبار زنده", desc: "هر خبر به‌محض انتشار بر اساس تعداد و اعتبار منابعی که آن را پوشش داده‌اند، امتیازدهی می‌شود." },
            { icon: "ti-layout-grid", title: "مقایسه چند منبع", desc: "در صفحه‌ی هر خبر می‌بینید دقیقاً چه رسانه‌هایی آن را پوشش داده‌اند." },
            { icon: "ti-filter", title: "فیلتر بر اساس دسته", desc: "اخبار جهانی، سیاسی، اقتصادی، ورزشی و تکنولوژی را جدا از هم دنبال کنید." },
            { icon: "ti-alert-triangle", title: "هشدار شایعه", desc: "وقتی خبری با امتیاز پایین منتشر می‌شود، پیش از قضاوت به شما اطلاع می‌دهیم." },
            { icon: "ti-history", title: "آرشیو اخبار تأییدشده", desc: "لیستی از خبرهایی که با بالاترین امتیاز اعتبار منتشر شده‌اند را دنبال کنید." },
            { icon: "ti-search", title: "جست‌وجوی هوشمند", desc: "هر موضوع را جست‌وجو کنید و نتیجه را به‌همراه امتیاز اعتبار ببینید." }
        ],
        credTitle: "امتیاز اعتبار",
        credDesc: "یک نگاه سریع و رنگی، بدون نیاز به خواندن کامل خبر.",
        credLevels: [
            { cls: "green", title: "تأیید شده", desc: "سه منبع معتبر یا بیشتر این خبر را به‌طور مستقل پوشش داده‌اند." },
            { cls: "orange", title: "در حال بررسی", desc: "تنها یک یا دو منبع این خبر را پوشش داده‌اند." },
            { cls: "red", title: "نامعتبر", desc: "هیچ منبع شناخته‌شده‌ای این خبر را تأیید نکرده." }
        ],
        algoTitle: "نحوه کار الگوریتم",
        algoDesc: "پشت هر امتیاز اعتبار، یک فرآیند شفاف در سه مرحله قرار دارد.",
        steps: [
            { title: "جمع‌آوری", desc: "خبر از ده‌ها منبع معتبر به‌طور هم‌زمان جمع‌آوری می‌شود." },
            { title: "تحلیل", desc: "میزان هم‌پوشانی منابع و سابقه‌ی اعتبار هرکدام بررسی می‌شود." },
            { title: "نمایش", desc: "یک امتیاز ساده و رنگی به شما نشان می‌دهد چقدر می‌توانید اعتماد کنید." }
        ]
    },

    en: {
        dir: 'ltr',
        features: "Features",
        credibility: "Credibility Score",
        backLabel: "News",
        categories: ["All", "World", "Politics", "Economy", "Sports", "Technology"],
        sourcesCoveredBy: (n) => `Covered by ${n} sources`,
        clickToRead: "Click on any source to read the full story",
        loading: "Loading...",
        error: "Error loading news",
        featuresTitle: "Features",
        featuresDesc: "NewsGrid is built for one purpose: helping you tell real news from rumor, as fast as possible.",
        featureList: [
            { icon: "ti-shield-check", title: "Live credibility score", desc: "Every story is scored the moment it breaks, based on how many credible sources cover it." },
            { icon: "ti-layout-grid", title: "Multi-source comparison", desc: "On every story page, see exactly which outlets covered it." },
            { icon: "ti-filter", title: "Category filters", desc: "Follow world, politics, economy, sports, and technology news separately." },
            { icon: "ti-alert-triangle", title: "Rumor alerts", desc: "When a low-score story spreads fast, we flag it before you judge it as confirmed." },
            { icon: "ti-history", title: "Verified news archive", desc: "Save and revisit the stories published with the highest credibility scores." },
            { icon: "ti-search", title: "Smart search", desc: "Search any topic and see results with credibility score." }
        ],
        credTitle: "Credibility Score",
        credDesc: "A quick, color-coded read — without needing to read the full story.",
        credLevels: [
            { cls: "green", title: "Verified", desc: "Three or more credible sources have independently covered this story." },
            { cls: "orange", title: "Developing", desc: "Only one or two sources have covered it so far." },
            { cls: "red", title: "Unverified", desc: "No known credible source has confirmed this story. Read with caution." }
        ],
        algoTitle: "How the algorithm works",
        algoDesc: "Behind every credibility score is a transparent, three-step process.",
        steps: [
            { title: "Collect", desc: "The story is gathered from dozens of credible sources simultaneously." },
            { title: "Analyze", desc: "We check source overlap and each outlet's track record." },
            { title: "Display", desc: "A simple, color-coded score shows how much you can trust this story." }
        ]
    }
};

export default strings;