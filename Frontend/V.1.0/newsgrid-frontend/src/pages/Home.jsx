import { useState } from 'react';
import CategoryBar from '../components/CategoryBar';
import NewsGrid from '../components/NewsGrid';

function Home({ onOpenArticle, searchKeyword }) {
    const [activeCategory, setActiveCategory] = useState(null);

    return (
        <main aria-label="صفحه اصلی اخبار Duta">
            {!searchKeyword && (
                <CategoryBar
                    activeCategory={activeCategory}
                    onSelectCategory={setActiveCategory}
                />
            )}

            <NewsGrid
                activeCategory={activeCategory}
                onOpenArticle={onOpenArticle}
                searchKeyword={searchKeyword}
            />
        </main>
    );
}

export default Home;