import { useState, useEffect } from 'react';
import CategoryBar from '../components/CategoryBar';
import NewsGrid from '../components/NewsGrid';
import api from '../api/axiosConfig';

function Home({ onOpenArticle, searchKeyword }) {
    const [activeCategory, setActiveCategory] = useState(null);
    const [categories, setCategories] = useState([]);

    useEffect(() => {
        api.get('/categories')
            .then(res => setCategories(res.data))
            .catch(err => console.error('Failed to load categories:', err));
    }, []);

    return (
        <div>
            {!searchKeyword && (
                <CategoryBar
                    activeCategory={activeCategory}
                    onSelectCategory={setActiveCategory}
                    categories={categories}
                />
            )}

            <NewsGrid
                activeCategory={activeCategory}
                onOpenArticle={onOpenArticle}
                searchKeyword={searchKeyword}
            />
        </div>
    );
}

export default Home;