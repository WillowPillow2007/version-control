const CACHE_NAME = 'quoridor-cache-v1';
const URLS_TO_CACHE = [
    '/',
    '/index.html',
    '/menu.html',
    '/game.html',
    '/style.css',
    '/script.js',
    '/src/Player.js',
    '/src/menu.js',
    '/src/menu.css',
    '/assets/icon-small.png',
    '/assets/icon-medium.png',
    '/assets/demo-image-1.png',
    '/assets/demo-vid.webm',
    '/assets/wooden-texture.jpg',
    '/manifest.json'  // Add manifest.json to cache
];

// Install event: caching resources
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(URLS_TO_CACHE);
        })
    );
});

// Fetch event: serving cached content when offline
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            // If the request is for manifest.json, serve it from the cache if available
            if (event.request.url.endsWith('manifest.json')) {
                return response || fetch(event.request); // Use cache first, then fetch if not in cache
            }
            return response || fetch(event.request); // Default: cache first, network fallback
        })
    );
});

// Activate event: clean up old caches and clear current cache
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);  // Clean up old caches
                    }
                })
            ).then(() => {
                // Clear current cache
                return caches.open(CACHE_NAME).then((cache) => {
                    return cache.keys().then((keys) => {
                        return Promise.all(
                            keys.map((key) => {
                                return cache.delete(key);
                            })
                        );
                    });
                });
            });
        })
    );
});