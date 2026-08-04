function CategoryBar({ activeCategory, onSelectCategory }) {
    const CATEGORIES = [
        { label: 'همه', value: null },
        { label: 'اقتصادی', value: 'اقتصادی' },
        { label: 'سیاسی', value: 'سیاسی' },
        { label: 'ورزشی', value: 'ورزشی' },
        { label: 'تکنولوژی', value: 'تکنولوژی' },
        { label: 'جهانی', value: 'جهانی' },
        { label: 'سرگرمی', value: 'سرگرمی' },
    ];

    return (
        <nav className="categories" aria-label="دسته‌بندی اخبار">
            <button
                className={`cat cat-breaking ${activeCategory === 'breaking' ? 'active' : ''}`}
                onClick={() => onSelectCategory('breaking')}
            >
                <span className="pulse-dot" aria-hidden="true" />
                خبر فوری
            </button>

            {/*
            <button
                className={`cat cat-telegram ${activeCategory === 'telegram' ? 'active' : ''}`}
                onClick={() => onSelectCategory('telegram')}
            >
                <i className="ti ti-brand-telegram" aria-hidden="true" style={{ fontSize: '15px' }} />
                کانال‌های تلگرام
            </button>
            */}

            {CATEGORIES.map((cat, i) => (
                <button
                    key={cat.value || i}
                    className={`cat ${activeCategory === cat.value ? 'active' : ''}`}
                    onClick={() => onSelectCategory(cat.value)}
                >
                    {cat.label}
                </button>
            ))}
        </nav>
    );
}

export default CategoryBar;