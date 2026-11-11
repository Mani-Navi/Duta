/**
 * Duta (@Duta_News) — Zero-Proxy Cloudflare Worker Bridge for Telegram API & Channel Scraper
 * Deploy for free on Cloudflare Workers (100,000 free requests/day).
 *
 * Routes:
 * 1. /bot<TOKEN>/*       -> Proxies to https://api.telegram.org/bot<TOKEN>/*
 * 2. /file/bot<TOKEN>/*  -> Proxies to https://api.telegram.org/file/bot<TOKEN>/*
 * 3. /tg-scrape/<HANDLE> -> Fetches https://t.me/s/<HANDLE> HTML for public channel scraping
 */

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        // Optional Secret Key protection if configured in Worker Environment Variables
        if (env && env.BRIDGE_SECRET) {
            const clientSecret = request.headers.get("X-Duta-Bridge-Key");
            if (clientSecret !== env.BRIDGE_SECRET) {
                return new Response(JSON.stringify({ ok: false, error: "Forbidden Bridge Access" }), {
                    status: 403,
                    headers: { "Content-Type": "application/json" }
                });
            }
        }

        // Route 1: Public Telegram Web Channel Scraper (/tg-scrape/:channel)
        if (url.pathname.startsWith("/tg-scrape/")) {
            const channel = url.pathname.replace("/tg-scrape/", "").replace(/[^a-zA-Z0-9_]/g, "");
            if (!channel) {
                return new Response("Missing channel handle", { status: 400 });
            }

            const targetUrl = `https://t.me/s/${channel}${url.search}`;
            const resp = await fetch(targetUrl, {
                method: "GET",
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "fa-IR,fa;q=0.9,en-US;q=0.8,en;q=0.7"
                }
            });

            const body = await resp.text();
            return new Response(body, {
                status: resp.status,
                headers: {
                    "Content-Type": "text/html; charset=utf-8",
                    "Cache-Control": "no-store"
                }
            });
        }

        // Route 2: Official Telegram Bot API Proxy (/bot... or /file/bot...)
        if (url.pathname.startsWith("/bot") || url.pathname.startsWith("/file/bot")) {
            const telegramUrl = `https://api.telegram.org${url.pathname}${url.search}`;

            const newHeaders = new Headers(request.headers);
            newHeaders.delete("Host");
            newHeaders.delete("X-Duta-Bridge-Key");

            const init = {
                method: request.method,
                headers: newHeaders,
                redirect: "follow"
            };

            if (request.method !== "GET" && request.method !== "HEAD") {
                init.body = request.body;
            }

            const tgResponse = await fetch(telegramUrl, init);
            const responseHeaders = new Headers(tgResponse.headers);
            return new Response(tgResponse.body, {
                status: tgResponse.status,
                headers: responseHeaders
            });
        }

        return new Response(
            JSON.stringify({
                service: "Duta Telegram Cloudflare Bridge",
                status: "active",
                channel: "@Duta_News"
            }),
            {
                status: 200,
                headers: { "Content-Type": "application/json; charset=utf-8" }
            }
        );
    }
};