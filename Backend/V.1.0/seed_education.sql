BEGIN;

-- ۱. درج دسته‌بندی «آموزشی»
INSERT INTO categories (name_fa, name_en, slug) VALUES
    ('آموزشی', 'Education & Academic', 'education')
ON CONFLICT (slug) DO UPDATE SET name_fa = EXCLUDED.name_fa;

-- ۲. جدول موقت منابع آموزشی، کنکور، سازمان سنجش و دانشگاه
CREATE TEMP TABLE tmp_edu_sources (
    name VARCHAR(255),
    rss_url VARCHAR(500),
    credibility SMALLINT,
    color VARCHAR(7),
    initials VARCHAR(5),
    cat_slug VARCHAR(255)
);

INSERT INTO tmp_edu_sources (name, rss_url, credibility, color, initials, cat_slug) VALUES
    ('متادرس', 'https://metadars.org/category/%d8%ae%d8%a8%d8%b1/feed/', 92, '#2563EB', 'متا', 'education'),
    ('پانا آموزش', 'https://www.pana.ir/fa/feeds/', 89, '#0284C7', 'پان', 'education'),
    ('ایسنا دانشگاه', 'https://www.isna.ir/rss/tp/11', 91, '#0369A1', 'اید', 'education'),
    ('مهر دانشگاه', 'https://www.mehrnews.com/rss/tp/8', 89, '#1D4ED8', 'مهد', 'education'),
    ('تسنیم آموزش', 'https://www.tasnimnews.com/fa/rss/feed/0/7/1685/%D8%A2%D9%85%D9%88%D8%B2%D8%B4-%D9%88-%D9%BE%D8%B1%D9%88%D8%B1%D8%B4', 87, '#D97706', 'تسآ', 'education'),
    ('ایرنا دانشگاه', 'https://www.irna.ir/rss/tp/6', 91, '#0077B6', 'ایآ', 'education'),
    ('باشگاه خبرنگاران علمی', 'https://www.yjc.ir/fa/rss/6', 85, '#4F46E5', 'علج', 'education');

INSERT INTO sources (name, rss_url, credibility, color, initials, source_type, category_id)
SELECT
    t.name,
    t.rss_url,
    t.credibility,
    t.color,
    t.initials,
    'RSS',
    c.id
FROM tmp_edu_sources t
JOIN categories c ON c.slug = t.cat_slug
WHERE NOT EXISTS (
    SELECT 1 FROM sources s WHERE s.name = t.name OR s.rss_url = t.rss_url
);

COMMIT;
