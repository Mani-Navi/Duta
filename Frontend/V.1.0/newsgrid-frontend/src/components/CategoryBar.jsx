import strings from '../strings/strings';

function CategoryBar({ lang, activeCategory, onSelectCategory }) {
    const t = strings[lang];

    const CATEGORIES = [
        { label: 'همه', value: null },
        { label: 'اقتصادی', value: 'اقتصادی' },
        { label: 'سیاسی', value: 'سیاسی' },
        { label: 'ورزشی', value: 'ورزشی' },
        { label: 'تکنولوژی', value: 'تکنولوژی' },
        { label: 'جهانی', value: 'جهانی' },
        { label: 'عمومی', value: 'عمومی' },
    ];

    return (
        <div className="categories" role="tablist" aria-label="دسته‌بندی اخبار">
            {/* دکمه خبر فوری */}
            <button
                className={`cat cat-breaking ${activeCategory === 'breaking' ? 'active-breaking' : ''}`}
                onClick={() => onSelectCategory('breaking')}
                role="tab"
                aria-selected={activeCategory === 'breaking'}
                aria-label="خبر فوری"
            >
                <span className="pulse-dot" aria-hidden="true" />
                خبر فوری
            </button>

            {/* دکمه اختصاصی تلگرام */}
            <button
                className={`cat ${activeCategory === 'telegram' ? 'active' : ''}`}
                onClick={() => onSelectCategory('telegram')}
                role="tab"
            >
                کانال‌های تلگرام
            </button>

            {/* دسته‌بندی‌های معمولی */}
            {t.categories.map((cat, i) => (
                <button
                    key={i}
                    className={`cat ${activeCategory === i ? 'active' : ''}`}
                    onClick={() => onSelectCategory(i)}
                    role="tab"
                    aria-selected={activeCategory === i}
                >
                    {cat}
                </button>
            ))}
        </div>
    );
}

export default CategoryBar;
