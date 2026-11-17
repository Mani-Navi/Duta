BEGIN;

-- ۱. حذف کامل مقالات و منابع تلگرامی و کلسترهای یتیم
DELETE FROM articles WHERE source_id IN (
    SELECT id FROM sources WHERE source_type = 'TELEGRAM' OR rss_url LIKE '%t.me%' OR telegram_username IS NOT NULL
);
DELETE FROM sources WHERE source_type = 'TELEGRAM' OR rss_url LIKE '%t.me%' OR telegram_username IS NOT NULL;
DELETE FROM article_clusters c WHERE NOT EXISTS (SELECT 1 FROM articles a WHERE a.cluster_id = c.id);

-- ۲. درج ۱۱ دسته‌بندی استاندارد (در صورت عدم وجود)
INSERT INTO categories (name_fa, name_en, slug) VALUES
    ('اقتصادی', 'Economy', 'economy'),
    ('سیاسی', 'Politics', 'politics'),
    ('تکنولوژی', 'Technology', 'technology'),
    ('رمزارز', 'Crypto & Fintech', 'crypto'),
    ('اجتماعی', 'Social', 'social'),
    ('خودرو', 'Auto & Industry', 'auto'),
    ('ورزشی', 'Sports', 'sports'),
    ('جهانی', 'World', 'world'),
    ('سلامت', 'Health & Science', 'health'),
    ('سرگرمی', 'Entertainment', 'entertainment'),
    ('فرهنگ و هنر', 'Culture & Art', 'culture')
ON CONFLICT (slug) DO UPDATE SET name_fa = EXCLUDED.name_fa;

-- ۳. تابع کمکی درج بدون تکرار خبرگزاری‌های RSS
CREATE TEMP TABLE tmp_new_sources (
    name VARCHAR(255),
    rss_url VARCHAR(500),
    credibility SMALLINT,
    color VARCHAR(7),
    initials VARCHAR(5),
    cat_slug VARCHAR(255)
);

INSERT INTO tmp_new_sources (name, rss_url, credibility, color, initials, cat_slug) VALUES
    -- سیاسی و عمومی
    ('ایرنا', 'https://www.irna.ir/rss', 92, '#0077B6', 'ایر', 'politics'),
    ('ایسنا', 'https://www.isna.ir/rss', 91, '#0284C7', 'ایس', 'politics'),
    ('خبرگزاری مهر', 'https://www.mehrnews.com/rss', 88, '#2563EB', 'مهر', 'politics'),
    ('خبرگزاری تسنیم', 'https://www.tasnimnews.com/fa/rss/feed/0/8/0/%D9%87%D9%85%D9%87-%D8%A8%D8%AE%D8%B4-%D9%87%D8%A7', 86, '#D97706', 'تسن', 'politics'),
    ('خبرآنلاین', 'https://www.khabaronline.ir/rss', 87, '#E11D48', 'خبر', 'politics'),
    ('انتخاب', 'https://www.entekhab.ir/fa/rss/allnews', 86, '#0D9488', 'انت', 'politics'),
    ('عصر ایران', 'https://www.asriran.com/fa/rss/allnews', 86, '#4F46E5', 'عصر', 'politics'),
    ('تابناک', 'https://www.tabnak.ir/fa/rss/allnews', 85, '#DC2626', 'تاب', 'politics'),
    ('ایلنا', 'https://www.ilna.ir/fa/feeds/', 87, '#2563EB', 'ایل', 'politics'),
    ('شفقنا', 'https://fa.shafaqna.com/feed/', 86, '#059669', 'شفق', 'politics'),
    ('جماران', 'https://www.jamaran.news/fa/feeds/', 84, '#0891B2', 'جما', 'politics'),
    ('فرارو', 'https://fararu.com/fa/feeds/', 86, '#1E40AF', 'فرا', 'politics'),

    -- اقتصادی و بازار
    ('دنیای اقتصاد', 'https://donya-e-eqtesad.com/fa/feeds/', 93, '#047857', 'دنی', 'economy'),
    ('اکو ایران', 'https://ecoiran.com/fa/feeds/', 91, '#10B981', 'اکو', 'economy'),
    ('تجارت نیوز', 'https://tejaratnews.com/feed', 89, '#0D9488', 'تجا', 'economy'),
    ('اقتصاد آنلاین', 'https://www.eghtesadonline.com/fa/feeds/', 87, '#059669', 'اقت', 'economy'),
    ('اقتصاد نیوز', 'https://www.eghtesadnews.com/fa/feeds/', 86, '#047857', 'اقن', 'economy'),
    ('بورس نیوز', 'https://www.boursenews.ir/fa/rss/allnews', 85, '#16A34A', 'بور', 'economy'),
    ('ایبنا بانکی', 'https://www.ibena.ir/fa/rss/allnews', 88, '#065F46', 'ایب', 'economy'),
    ('بنکر', 'https://www.banker.ir/rss', 83, '#15803D', 'بنک', 'economy'),
    ('تسنیم اقتصادی', 'https://www.tasnimnews.com/fa/rss/feed/0/7/2/%D8%A7%D9%82%D8%AA%D8%B5%D8%A7%D8%AF%DB%8C', 86, '#B45309', 'تسا', 'economy'),

    -- تکنولوژی
    ('زومیت', 'https://www.zoomit.ir/feed/', 94, '#E11D48', 'زوم', 'technology'),
    ('دیجیاتو', 'https://digiato.com/feed', 92, '#2563EB', 'دیج', 'technology'),
    ('پیوست', 'https://peivast.com/feed', 90, '#4F46E5', 'پیو', 'technology'),
    ('آی‌تی ایران', 'https://itiran.com/feed/', 88, '#0284C7', 'آیت', 'technology'),
    ('گجت نیوز', 'https://gadgetnews.net/feed/', 87, '#7C3AED', 'گجت', 'technology'),
    ('سیتنا', 'https://www.citna.ir/rss', 86, '#0369A1', 'سیت', 'technology'),
    ('تکراتو', 'https://techrato.com/feed', 84, '#6366F1', 'تکر', 'technology'),

    -- رمزارز و فین‌تک
    ('ارزدیجیتال', 'https://arzdigital.com/feed/', 92, '#D97706', 'ارز', 'crypto'),
    ('میهن بلاکچین', 'https://mihanblockchain.com/feed/', 91, '#F59E0B', 'میه', 'crypto'),
    ('راه پرداخت', 'https://way2pay.ir/feed/', 90, '#0284C7', 'راه', 'crypto'),
    ('رمزارز نیوز', 'https://ramzarz.news/feed/', 85, '#EA580C', 'رمز', 'crypto'),

    -- اجتماعی و حوادث
    ('همشهری آنلاین', 'https://www.hamshahrionline.ir/rss', 88, '#0D9488', 'همش', 'social'),
    ('میزان', 'https://www.mizanonline.ir/fa/rss/allnews', 89, '#1E40AF', 'میز', 'social'),
    ('ایمنا', 'https://www.imna.ir/rss', 87, '#0891B2', 'ایم', 'social'),
    ('باشگاه خبرنگاران', 'https://www.yjc.ir/fa/rss/allnews', 84, '#2563EB', 'باش', 'social'),
    ('رکنا', 'https://www.rokna.net/fa/feeds/', 78, '#E11D48', 'رکن', 'social'),

    -- خودرو و صنعت
    ('پدال', 'https://www.pedal.ir/feed/', 90, '#B91C1C', 'پدا', 'auto'),
    ('اسب بخار', 'https://asbe-bokhar.com/feed/', 89, '#DC2626', 'اسب', 'auto'),
    ('خودرو بانک', 'https://www.khodrobank.com/rss', 88, '#1D4ED8', 'خوب', 'auto'),
    ('بیت ران', 'https://bitrun.ir/feed/', 87, '#0F766E', 'بیت', 'auto'),

    -- ورزشی
    ('ورزش سه', 'https://www.varzesh3.com/rss/all', 93, '#16A34A', 'ور۳', 'sports'),
    ('فوتبالی', 'https://footballi.net/rss', 88, '#059669', 'فوت', 'sports'),
    ('خبرورزشی', 'https://www.khabarvarzeshi.com/rss', 87, '#2563EB', 'خبو', 'sports'),
    ('طرفداری', 'https://www.tarafdari.com/rss.xml', 85, '#DC2626', 'طرف', 'sports'),
    ('ایسنا ورزشی', 'https://www.isna.ir/rss/tp/14', 91, '#0284C7', 'ایو', 'sports'),

    -- سلامت و علمی
    ('سیناپرس', 'https://sinapress.ir/feed/', 89, '#0284C7', 'سین', 'health'),
    ('ایسنا سلامت', 'https://www.isna.ir/rss/tp/9', 91, '#10B981', 'سلا', 'health'),
    ('دیجیاتو علمی', 'https://digiato.com/topic/science/feed', 91, '#6366F1', 'علم', 'health'),

    -- سرگرمی و گیمینگ
    ('زومجی', 'https://www.zoomg.ir/feed/', 93, '#EC4899', 'زوج', 'entertainment'),
    ('ویجیاتو', 'https://vigiato.net/feed', 92, '#8B5CF6', 'ویج', 'entertainment'),
    ('گیمفا', 'https://gamefa.com/feed/', 88, '#7C3AED', 'گیم', 'entertainment'),

    -- فرهنگ و هنر
    ('هنرآنلاین', 'https://www.honaronline.ir/fa/feeds/', 89, '#9333EA', 'هنر', 'culture'),
    ('ایبنا کتاب', 'https://www.ibna.ir/rss', 90, '#7E22CE', 'کتب', 'culture'),
    ('ایرنا فرهنگ', 'https://www.irna.ir/rss/tp/4', 91, '#6D28D9', 'فره', 'culture'),

    -- جهانی و بین‌الملل
    ('یورونیوز فارسی', 'https://per.euronews.com/rss', 90, '#0052B4', 'یور', 'world'),
    ('ایرنا بین‌الملل', 'https://www.irna.ir/rss/tp/1', 91, '#0284C7', 'جهن', 'world'),
    ('ایسنا بین‌الملل', 'https://www.isna.ir/rss/tp/18', 91, '#0369A1', 'بین', 'world');

INSERT INTO sources (name, rss_url, credibility, color, initials, source_type, category_id)
SELECT
    t.name,
    t.rss_url,
    t.credibility,
    t.color,
    t.initials,
    'RSS',
    c.id
FROM tmp_new_sources t
JOIN categories c ON c.slug = t.cat_slug
WHERE NOT EXISTS (
    SELECT 1 FROM sources s WHERE s.name = t.name OR s.rss_url = t.rss_url
);

COMMIT;
