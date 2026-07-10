import { useState } from 'react';
import CategoryBar from '../components/CategoryBar';
import NewsGrid from '../components/NewsGrid';
import strings from '../strings/strings';

function Home({ lang, onOpenArticle }) {
    const [activeCategory, setActiveCategory] = useState(0);
    const t = strings[lang];

    return (
        <div>
            <CategoryBar
                lang={lang}
                activeCategory={activeCategory}
                onSelectCategory={setActiveCategory}
            />
            <NewsGrid
                lang={lang}
                activeCategory={activeCategory}
                onOpenArticle={onOpenArticle}
            />
        </div>
    );
}

export default Home;