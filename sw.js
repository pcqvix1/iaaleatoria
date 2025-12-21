
const CACHE_NAME = 'gemini-gpt-v1';
const API_BASE_URL = '/api';

// Install event: Cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // We cache the root and the icon. 
      // Dynamic assets (like the TSX files) will be cached at runtime via the fetch handler.
      return cache.addAll([
        '/',
        '/index.html',
        '/manifest.json'
      ]);
    })
  );
  self.skipWaiting();
});

// Activate event: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event: Network-first for HTML, Stale-while-revalidate for assets, Network-only for API
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. API Calls: Network Only
  // We don't want to cache API responses (chat history, streaming answers, auth)
  if (url.pathname.startsWith(API_BASE_URL)) {
    return; // Fallback to browser default (network)
  }

  // 2. Navigation Requests (HTML): Network First, fallback to Cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }

  // 3. Static Assets (JS, CSS, Images, Fonts): Stale-While-Revalidate
  // This includes the CDN libraries used in index.html
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Clone the response before using it because it can only be consumed once
        const responseClone = networkResponse.clone();
        
        // Cache the new response
        caches.open(CACHE_NAME).then((cache) => {
           // Check if valid response (basic check)
           if (networkResponse.status === 200) {
             try {
                cache.put(event.request, responseClone);
             } catch (e) {
                // Ignore errors for opaque responses or unsupported schemes
             }
           }
        });
        return networkResponse;
      }).catch(err => {
         // Network failed, nothing to do here if we don't have cache
      });

      return cachedResponse || fetchPromise;
    })
  );
});
