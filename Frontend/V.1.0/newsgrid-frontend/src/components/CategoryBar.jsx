import strings from '../strings/strings';

function CategoryBar({ lang, activeCategory, onSelectCategory }) {
    const t = strings[lang];

    return (
        <div className="categories">
            {t.categories.map((cat, i) => (
                <button
                    key={i}
                    className={`cat ${activeCategory === i ? 'active' : ''}`}
                    onClick={() => onSelectCategory(i)}
                >
                    {cat}
                </button>
            ))}
        </div>
    );
}

export default CategoryBar;