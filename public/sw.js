const CACHE_NAME = `quoridor-cache-v1`;
const URLS_TO_CACHE = [
    '/',
    '/menu.html',
    '/game.html',
    '/css/style.css',
    '/js/script.js',
    '/js/Player.js',
    '/js/menu.js',
    '/css/menu.css',
    '/assets/icon-small.png',
    '/assets/icon-medium.png',
    '/assets/demo-image-1.png',
    '/assets/demo-vid.webm',
    '/assets/wooden-texture.jpg',
    '/manifest.json',
];

// Install event: cache the resources
self.addEventListener('install', (event) => {
    event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll(URLS_TO_CACHE).then(() => {
        console.log('Cache installed successfully!');
        });
    })
    );
});

// Fetch event: serve cached content when offline
self.addEventListener('fetch', (event) => {
    console.log(`Fetch event triggered for ${event.request.url}`);
    event.respondWith(
        caches.match(event.request).then((response) => {
        console.log(`Cached response found for ${event.request.url}: ${response}`);
        return response || fetch(event.request).catch((error) => {
            console.error('Error fetching resource:', error);
            // If the request is for an HTML page, return the cached game page
            if (event.request.url.endsWith('.html')) {
            console.log('Falling back to cached game page...');
            return caches.match('/menu.html');
            } else {
            // If the request is for a non-HTML resource, return a cached response or a fallback response
            return caches.match(event.request).then((response) => {
                return response || fetch(event.request);
            });
            }
        });
        })
    );
});

// Activate event: clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Activate event triggered!');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
        return Promise.all(
            cacheNames.map((cache) => {
            if (cache !== CACHE_NAME) {
                console.log(`Deleting old cache: ${cache}`);
                return caches.delete(cache);
            }
            })
        );
        })
    );
});