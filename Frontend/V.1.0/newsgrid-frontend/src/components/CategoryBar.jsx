function CategoryBar({ activeCategory, onSelectCategory }) {
    const CATEGORIES = [
        { label: 'همه', value: null },
        { label: 'اقتصادی', value: 'اقتصادی' },
        { label: 'سیاسی', value: 'سیاسی' },
        { label: 'ورزشی', value: 'ورزشی' },
        { label: 'تکنولوژی', value: 'تکنولوژی' },
        { label: 'جهانی', value: 'جهانی' },
    ];

    return (
        <div className="categories" role="tablist" aria-label="دسته‌بندی اخبار">
            <button
                className={`cat cat-breaking ${activeCategory === 'breaking' ? 'active' : ''}`}
                onClick={() => onSelectCategory('breaking')}
                role="tab"
                aria-selected={activeCategory === 'breaking'}
            >
                <span className="pulse-dot" aria-hidden="true" />
                خبر فوری
            </button>

            <button
                className={`cat ${activeCategory === 'telegram' ? 'active' : ''}`}
                onClick={() => onSelectCategory('telegram')}
                role="tab"
                aria-selected={activeCategory === 'telegram'}
            >
                کانال‌های تلگرام
            </button>

            {CATEGORIES.map((cat, i) => (
                <button
                    key={cat.value || i}
                    className={`cat ${activeCategory === cat.value ? 'active' : ''}`}
                    onClick={() => onSelectCategory(cat.value)}
                    role="tab"
                    aria-selected={activeCategory === cat.value}
                >
                    {cat.label}
                </button>
            ))}
        </div>
    );
}

export default CategoryBar;