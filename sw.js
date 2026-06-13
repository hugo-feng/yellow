const CACHE_NAME = 'yellow-app-cache'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim())
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  
  // 只拦截应用自身的资源请求
  if (url.pathname === '/' || url.pathname === '/index.html' || url.pathname.endsWith('.html') || url.pathname.includes('/assets/') || url.pathname === '/version.json') {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        // 对根路径也尝试匹配 index.html
        if (url.pathname === '/') {
          const indexCached = await cache.match('/index.html')
          if (indexCached) return indexCached
        }
        
        const cached = await cache.match(event.request)
        if (cached) {
          // 后台更新缓存
          fetch(event.request, { cache: 'no-cache' }).then(resp => {
            if (resp.ok) cache.put(event.request, resp.clone())
          }).catch(() => {})
          return cached
        }
        
        // 走网络
        try {
          const resp = await fetch(event.request)
          if (resp.ok) cache.put(event.request, resp.clone())
          return resp
        } catch {
          return new Response('', { status: 502 })
        }
      })
    )
  }
})
