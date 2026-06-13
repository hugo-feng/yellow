const CACHE_VERSION = 'v1.9.4'
const CACHE_NAME = 'yellow-' + CACHE_VERSION

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  if (url.origin !== location.origin) return

  if (url.pathname === '/version.json') {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' }).catch(() => caches.match(event.request))
    )
    return
  }

  if (url.pathname === '/' || url.pathname === '/index.html' || url.pathname.includes('/assets/') || url.pathname.includes('/books/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request)
        if (cached) {
          fetch(event.request, { cache: 'no-cache' }).then(resp => {
            if (resp.ok) cache.put(event.request, resp.clone())
          }).catch(() => {})
          return cached
        }
        const resp = await fetch(event.request)
        if (resp.ok) cache.put(event.request, resp.clone())
        return resp
      })
    )
  }
})
