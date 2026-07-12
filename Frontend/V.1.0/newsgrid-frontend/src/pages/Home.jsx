import { useState, useEffect } from 'react';
import CategoryBar from '../components/CategoryBar';
import NewsGrid from '../components/NewsGrid';
import strings from '../strings/strings';
import api from "../api/axiosConfig.js";

function Home({ lang, onOpenArticle, searchKeyword }) {
    const [activeCategory, setActiveCategory] = useState(0);
    const [categories, setCategories] = useState([]);

    useEffect(() => {
        api.get('/categories')
            .then(res => setCategories(res.data))
            .catch(err => console.error(err));
    }, []);

    const t = strings[lang];

    return (
        <div>
            {!searchKeyword && (
                <CategoryBar
                    lang={lang}
                    activeCategory={activeCategory}
                    onSelectCategory={setActiveCategory}
                    categories={categories}
                />
            )}

            <NewsGrid
                lang={lang}
                activeCategory={activeCategory}
                onOpenArticle={onOpenArticle}
                searchKeyword={searchKeyword}
            />
        </div>
    );
}

export default Home;