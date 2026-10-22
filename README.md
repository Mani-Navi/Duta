<div align="center">

# 👁️ Duta (دوتا) — دو نگاه، یک حقیقت
### پلتفرم هوشمند تجمیع، خوشه‌بندی و سنجش اعتبار اخبار فارسی
**Automated Persian News Aggregation, Multi-Source Clustering & Credibility Verification Platform**

[![Live Website](https://img.shields.io/badge/Live-duta.ir-007AFF?style=for-the-badge&logo=safari&logoColor=white)](https://duta.ir)
[![Java 21](https://img.shields.io/badge/Java-21_(Virtual_Threads)-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white)](https://openjdk.org/projects/jdk/21/)
[![Spring Boot 3.3](https://img.shields.io/badge/Spring_Boot-3.3.0-6DB33F?style=for-the-badge&logo=springboot&logoColor=white)](https://spring.io/projects/spring-boot)
[![React 19](https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Lighthouse SEO](https://img.shields.io/badge/Lighthouse_SEO-100%2F100-34C759?style=for-the-badge&logo=lighthouse&logoColor=white)](https://duta.ir)
[![Security Headers](https://img.shields.io/badge/Security_Headers-Grade_A-10B981?style=for-the-badge&logo=cloudflare&logoColor=white)](https://securityheaders.com/?q=https://duta.ir)

</div>

---

## 📖 معرفی پروژه (Overview)

**Duta (دوتا)** — برگرفته از واژه اوستایی به معنای *«پیام‌رسان و فرستاده»* — یک پلتفرم هوشمند تجمیع خبر (News Aggregator) و راستی‌آزمایی خودکار است که با هدف کمک به مخاطبان فارسی‌زبان برای **تشخیص سریع اخبار معتبر از شایعه** طراحی و پیاده‌سازی شده است.

این سیستم هر ۵ دقیقه به‌صورت موازی ده‌ها فید خبری را پایش کرده، اخبار مرتبط با یک رویداد واحد را در یک **خوشه (Cluster)** تجمیع می‌کند و بر پایه تعداد و سابقه اعتبار منابع مستقل پوشش‌دهنده، به هر خبر یک **امتیاز اعتبار زنده (۰ تا ۱۰۰٪)** اختصاص می‌دهد.

---

## ✨ ویژگی‌های کلیدی (Key Features)

- **🧠 خوشه‌بندی هوشمند اخبار (Jaccard Similarity Clustering):** شناسایی و ادغام اخبار مشابه منتشرشده در بازه ۶ ساعته از خبرگزاری‌های مختلف با الگوریتم شباهت جاکارد ($\ge 25\%$) و نمایش تنها یک کارت نماینده در فید اصلی.
- **🛡️ سنجش اعتبار بیزین (Bayesian-Inspired Credibility Scoring):** محاسبه امتیاز اعتبار هر رویداد بر پایه میانگین وزنی توان دوم اعتبار منابع ($Credibility^2$) به همراه پاداش تایید توسط منابع مستقل یکتا:
  - 🟢 **تأیید شده ($\ge 80\%$):** پوشش مستقل توسط منابع معتبر.
  - 🟠 **در حال بررسی ($50\% - 79\%$):** پوشش محدود یا نیازمند تایید منابع بیشتر.
  - 🔴 **نامعتبر ($< 50\%$):** فاقد تایید توسط منابع شناخته‌شده.
- **🏷️ دسته‌بندی خودکار مبتنی بر مرز کلمه (NLP Word-Boundary Classifier):** تشخیص خودکار دسته‌بندی خبر (*سیاسی، اقتصادی، ورزشی، تکنولوژی، جهانی، سرگرمی*) و تشخیص آنی **«خبر فوری»** با نرمال‌سازی حروف فارسی/عربی و نیم‌فاصله.
- **💱 تیکر زنده بازار (Non-Blocking Live Market Ticker):** نمایش لحظه‌ای نرخ دلار آزاد و طلای ۱۸ عیار با اسکرپینگ پس‌زمینه و پاسخ‌دهی `0ms` از روی حافظه.
- **🤖 بهینه‌سازی کامل برای موتورهای جستجو و هوش مصنوعی (SEO & GEO):**
  - پشتیبانی بومی از استاندارد [`/llms.txt`](https://duta.ir/llms.txt) برای موتورهای هوش مصنوعی (*ChatGPT Search, Perplexity, Claude, Google AI Overviews*).
  - سرویس رندرینگ سمت سرور (`duta-prerender`) برای خزنده‌ها به همراه اسکیمای ترکیبی `NewsArticle` + `ClaimReview` (Fact-Check) و `NewsMediaOrganization`.
  - سایت‌مپ ترکیبی [`/sitemap.xml`](https://duta.ir/sitemap.xml) منطبق بر قانون ۴۸ ساعت Google News و آرشیو ۳۰ روزه وب.

---

## 🏗️ معماری سیستم و مقیاس‌پذیری (System Architecture & Scalability)

این پلتفرم برای تحمل ترافیک‌های وایرال خبری (تا **۱٬۰۰۰٬۰۰۰ کاربر**) با حداقل مصرف RAM و CPU بهینه‌سازی شده است:

```mermaid
flowchart TB
    User([👤 کاربر مرورگر / موبایل])
    Bot([🤖 Googlebot / GPTBot / TelegramBot])

    subgraph Server["☁️ سرور ابری Duta (https://duta.ir)"]
        Nginx["⚡ Nginx Reverse Proxy\n(HTTP/2, Gzip, Keepalive Pools, Real-IP Mapping)"]
        SPA["⚛️ React 19 + Vite 6 SPA\n(GPU Animations, 2KB Native SVG Icons)"]
        Prerender["🔍 Prerender SSR (:4000)\n(OpenGraph + ClaimReview JSON-LD)"]

        subgraph Backend["☕ Spring Boot 3.3 + Java 21 (:8080 — Virtual Threads)"]
            RateLimit["🛡️ Caffeine Rate Limiter\n(120 req/min per Real IP)"]
            Cache["🚀 6-Tier Caffeine Cache\n(articles, detail, clusters, seo, sitemap)"]
            Engine["🧠 Core Intelligence\n(Classifier, Jaccard Clusterer, Bayesian Scorer)"]
            Scheduler["⏱️ Parallel RSS Workers (5 Threads)\n+ LRU Seen-URLs Filter (95% DB Query Reduction)"]
        end

        DB[("🐘 PostgreSQL 16\n(FK Indexed & Auto-Cleaned 30d)")]
    end

    User -->|HTTPS| Nginx
    Bot -->|HTTPS| Nginx
    Nginx -->|"$is_bot = 0"| SPA
    Nginx -->|"$is_bot = 1 (/article/*)"| Prerender
    Prerender -->|"/api/articles/seo/{slug}"| Cache
    SPA -->|"/api/*"| RateLimit
    RateLimit --> Cache
    Cache <-->|JOIN FETCH| DB
    Scheduler --> Engine
    Engine --> DB
    Scheduler -.->|"@CacheEvict"| Cache

    شاخص‌های مهندسی پرفورمنس:
لایه	تکنیک پیاده‌سازی‌شده	دستاورد فنی
Java 21 Concurrency	فعال‌سازی spring.threads.virtual.enabled=true (Project Loom)	مدیریت ده‌ها هزار کانکشن هم‌زمان با کاهش ۹۰٪ مصرف رم تردها
Multi-Tier Caching	کش ۶ لایه Caffeine (articles, article_detail, clusters, seo, sitemap)	پاسخ‌دهی < 1ms به اخبار وایرال با ۰ کوئری دیتابیس
RSS Ingestion Filter	کش درون‌حافظه‌ای seenUrlsCache (۵۰۰۰ لینک اخیر) و tokenCache	کاهش ۹۵٪ کوئری‌های تکراری دیتابیس و عملیات Regex در هر سیکل ۵ دقیقه‌ای
Database & ORM	ایندکس روی تمام کلیدهای خارجی (cluster_id, source_id) + LEFT JOIN FETCH	حذف کامل مشکل N+1 در Hibernate و پاکسازی خودکار کلسترهای یتیم (Orphan Clusters)
Nginx & Kernel I/O	استخر upstream keepalive + open_file_cache + sendfile	حذف خطای اتمام پورت‌های TCP (TIME_WAIT) و سرو فایل‌ها از RAM هسته لینوکس
Frontend Bundle	جایگزینی فونت آیکون ۲ مگابایتی با زیرمجموعه ۲ کیلوبایتی SVG Mask + انیمیشن GPU	کسب نمره 100/100 در SEO و حذف بار پردازشی انیمیشن‌ها از روی CPU موبایل

🔌 مرجع وب‌سرویس‌ها (REST API Reference)
متد	مسیر (Endpoint)	توضیح	کشینگ
GET	/api/articles?page=0&size=20	دریافت اخبار نماینده کلسترها (صفحه اصلی)	Caffeine (articles)
GET	/api/articles/category?name={cat}&page=0&size=20	فیلتر اخبار بر اساس دسته‌بندی	Caffeine (articles)
GET	/api/articles/breaking?page=0&size=20	دریافت اخبار فوری (breaking = true)	Caffeine (articles)
GET	/api/articles/search?keyword={q}&page=0&size=20	جستجوی مبتنی بر مرز کلمه در تیتر و منبع	Dynamic
GET	/api/articles/slug/{slug}	دریافت جزئیات خبر با اسلاگ فارسی	Caffeine (article_detail)
GET	/api/clusters/{id}/articles	دریافت لیست تمامی منابع پوشش‌دهنده کلستر	Caffeine (clusters)
GET	/api/prices	دریافت نرخ لحظه‌ای دلار و طلای ۱۸ عیار	Volatile Memory (0ms)
GET	/api/articles/seo/{slug}	متادیتای غنی‌شده برای رندرینگ ربات‌ها و GEO	Caffeine (seo)
GET	/sitemap.xml	سایت‌مپ ترکیبی Google News (48h) + آرشیو ۳۰ روزه	Caffeine (sitemap)
GET	/llms.txt	راهنمای ساختاریافته Markdown برای موتورهای هوش مصنوعی	Nginx Native
POST	/api/articles/fetch-now	تریگر دستی واکشی RSS (محافظت‌شده با X-Admin-Key)	@CacheEvict
POST	/api/articles/reclassify	دسته‌بندی مجدد دسته‌ای اخبار (محافظت‌شده با X-Admin-Key)	@CacheEvict

📚 مستندات مهندسی نرم‌افزار (Project Documentation)
تمامی مستندات تحلیل سیستم، معماری و تاریخچه تغییرات مهندسی در پوشه docs/ قرار دارند:
📄 مستندات موارد کاربرد (UCS-001 تا UCS-006 — نسخه v1.2)
🛠️ مستندات تغییرات مهندسی و بهینه‌سازی (CHG-001 تا CHG-009)
🗄️ شناسنامه دیتابیس، مرجع API و نیازمندی‌های غیرعملکردی (DBS-001, API-001, NFR-001)
🚀 راه‌اندازی و استقرار (Getting Started)

۱. اجرای بک‌اند (Spring Boot 3.3 / Java 21)
cd Backend/V.1.0
export POSTGRES_URL=jdbc:postgresql://localhost:5432/nitt_db
export POSTGRES_USERNAME=postgres
export POSTGRES_PASSWORD=postgres
export ADMIN_SECRET=your_secure_admin_key
./mvnw clean spring-boot:run

۲. اجرای فرانت‌اند (React 19 / Vite 6)
cd Frontend/V.1.0/newsgrid-frontend
npm install
npm run dev


👤 طراح، تحلیلگر و توسعه‌دهنده (Author)
مانی مردآزاد ناوی (Mani Mardazad Navi)
🌐 وب‌سایت زنده: https://duta.ir
📧 ایمیل ارتباطی: info@duta.ir
💻 گیت‌هاب: @Mani-Navi