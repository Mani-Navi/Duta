const express = require('express');
const axios = require('axios');
const app = express();

const BACKEND_URL = "http://nitt-backend:8080/api/articles/slug";

app.get('/article/:slug', async (req, res) => {
    try {
        const slug = req.params.slug;
        const response = await axios.get(`${BACKEND_URL}/${encodeURIComponent(slug)}`, { timeout: 5000 });
        const article = response.data;

        const title = article.title || "خبر جدید";
        const sourceName = article.source?.name || "Duta";
        const siteUrl = `https://duta.ir/article/${slug}`;

        const html = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>${title} | Duta</title>
    <meta name="description" content="${title} — پوشش داده شده در ${sourceName}">
    
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="Duta — دو نگاه، یک حقیقت">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="منبع: ${sourceName}">
    <meta property="og:url" content="${siteUrl}">
    <meta property="og:locale" content="fa_IR">

    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="منبع: ${sourceName}">

    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        "headline": "${title}",
        "datePublished": "${article.publishedAt || ''}",
        "author": {"@type": "Organization", "name": "${sourceName}"},
        "publisher": {"@type": "Organization", "name": "Duta", "url": "https://duta.ir"}
    }
    </script>
</head>
<body>
    <h1>${title}</h1>
    <p>منبع: ${sourceName}</p>
    <a href="${siteUrl}">مشاهده در Duta</a>
</body>
</html>`;

        res.set('Content-Type', 'text/html; charset=utf-8');
        res.status(200).send(html);
    } catch (error) {
        res.status(404).send(`<!DOCTYPE html><html><head><title>Duta</title></head><body><h1>Duta — دو نگاه، یک حقیقت</h1></body></html>`);
    }
});

app.listen(4000, () => console.log("Prerender container running on port 4000"));
