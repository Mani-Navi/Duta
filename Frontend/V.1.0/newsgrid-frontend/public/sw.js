/* Duta (https://duta.ir) — Native Web Push & Local Notification Service Worker (UCS-012) */

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
    let payload = {
        title: 'خبر فوری در Duta',
        body: 'رویداد مهم جدیدی در حوزه‌های انتخابی شما منتشر شد.',
        url: 'https://duta.ir/'
    };

    if (event.data) {
        try {
            const parsed = event.data.json();
            payload = { ...payload, ...parsed };
        } catch {
            payload.body = event.data.text();
        }
    }

    const options = {
        body: payload.body,
        icon: '/duta-logo.svg',
        badge: '/duta-logo.svg',
        dir: 'rtl',
        lang: 'fa-IR',
        tag: payload.tag || 'duta-breaking',
        renotify: true,
        data: { url: payload.url || 'https://duta.ir/' }
    };

    event.waitUntil(
        self.registration.showNotification(payload.title, options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = event.notification.data?.url || '/';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (const client of windowClients) {
                if ('focus' in client) {
                    client.focus();
                    if ('navigate' in client) {
                        return client.navigate(targetUrl);
                    }
                    return;
                }
            }
            if (self.clients.openWindow) {
                return self.clients.openWindow(targetUrl);
            }
        })
    );
});