function CategoryBar({ activeCategory, onSelectCategory }) {
    const CATEGORIES = [
        { label: 'همه', value: null },
        { label: 'اقتصادی', value: 'اقتصادی' },
        { label: 'سیاسی', value: 'سیاسی' },
        { label: 'تکنولوژی', value: 'تکنولوژی' },
        { label: 'آموزشی', value: 'آموزشی' },
        { label: 'رمزارز', value: 'رمزارز' },
        { label: 'اجتماعی', value: 'اجتماعی' },
        { label: 'خودرو', value: 'خودرو' },
        { label: 'ورزشی', value: 'ورزشی' },
        { label: 'جهانی', value: 'جهانی' },
        { label: 'سلامت', value: 'سلامت' },
        { label: 'سرگرمی', value: 'سرگرمی' },
        { label: 'فرهنگ و هنر', value: 'فرهنگ و هنر' },
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