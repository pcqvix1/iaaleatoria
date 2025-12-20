
const CACHE_NAME = 'gemini-gpt-v2';
const CDN_CACHE = 'gemini-gpt-cdn-v1';
const API_BASE_URL = '/api';

// Arquivos fundamentais para o "App Shell"
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json'
];

// Instalação: Cache dos arquivos estáticos críticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Ativação: Limpeza de caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== CDN_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptação de requisições
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. ESTRATÉGIA: NETWORK ONLY (Apenas Rede)
  // Nunca cachear chamadas de API ou autenticação
  if (url.pathname.startsWith('/api') || event.request.method !== 'GET') {
    return; // Deixa o navegador fazer a requisição padrão (sem cache)
  }

  // 2. ESTRATÉGIA: CACHE FIRST (Cache Primeiro)
  // Para bibliotecas externas (CDNs), fontes e ícones do Google.
  // Como as URLs são versionadas (ex: react@19.2.0), é seguro cachear "para sempre".
  if (
    url.hostname.includes('cdn.tailwindcss.com') ||
    url.hostname.includes('esm.sh') ||
    url.hostname.includes('unpkg.com') ||
    url.hostname.includes('cdnjs.cloudflare.com') ||
    url.hostname.includes('cdn.sheetjs.com') ||
    url.hostname.includes('aistudiocdn.com') ||
    url.hostname.includes('gstatic.com') || // Ícones
    url.hostname.includes('fonts.googleapis.com')
  ) {
    event.respondWith(
      caches.open(CDN_CACHE).then((cache) => {
        return cache.match(event.request).then((response) => {
          if (response) return response;
          return fetch(event.request).then((networkResponse) => {
            // Só cacheia se a resposta for válida
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
             // Fallback opcional para imagens se offline
             return new Response('', { status: 408, statusText: 'Offline' });
          });
        });
      })
    );
    return;
  }

  // 3. ESTRATÉGIA: STALE WHILE REVALIDATE (Cache, depois atualiza)
  // Para arquivos locais da aplicação (.tsx, .ts, .js, .css).
  // Carrega instantaneamente do cache, mas vai na rede buscar versão nova em background.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        }).catch(() => {
            // Se estiver offline e não tiver cache, retorna null (browser trata)
            // Para navegação HTML, poderíamos retornar uma página offline.html aqui
            return cachedResponse; 
        });

        // Retorna o cache se existir, senão espera a rede
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }
});
