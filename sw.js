// ================================================================
// Service Worker - حصون الإيمان PWA
// يضمن عمل التطبيق بدون إنترنت بعد أول تحميل
// ================================================================

const CACHE_NAME = 'husunaliman-v1';

// الملفات المطلوب تخزينها للعمل أوف لاين
const ASSETS_TO_CACHE = [
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  // الخطوط والأيقونات - تُخزَّن بعد أول تحميل
  'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/webfonts/fa-brands-400.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/webfonts/fa-regular-400.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/webfonts/fa-solid-900.woff2'
];

// ================================================================
// تثبيت: تخزين الملفات الأساسية
// ================================================================
self.addEventListener('install', (event) => {
  console.log('[SW] Installing حصون الإيمان...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // تخزين الملفات المحلية أولاً (المضمونة)
      return cache.addAll(['./index.html', './manifest.json'])
        .then(() => {
          // محاولة تخزين الملفات الخارجية (قد تفشل بدون إنترنت)
          const externalAssets = ASSETS_TO_CACHE.filter(url => url.startsWith('http'));
          return Promise.allSettled(
            externalAssets.map(url => 
              fetch(url).then(res => cache.put(url, res)).catch(() => {})
            )
          );
        });
    }).then(() => {
      console.log('[SW] Installation complete');
      return self.skipWaiting();
    })
  );
});

// ================================================================
// تفعيل: حذف الكاش القديم
// ================================================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ================================================================
// اعتراض الطلبات: Cache First للملفات المحلية، Network First للخارجية
// ================================================================
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // تجاهل طلبات غير GET
  if (event.request.method !== 'GET') return;

  // تجاهل طلبات chrome-extension وما شابهها
  if (!url.protocol.startsWith('http')) return;

  // استراتيجية: Cache First (الكاش أولاً، ثم الشبكة)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // وُجد في الكاش — إرجاعه فوراً
        return cachedResponse;
      }

      // لم يوجد في الكاش — جلب من الشبكة وتخزين
      return fetch(event.request.clone())
        .then((networkResponse) => {
          // تخزين الاستجابة الناجحة فقط
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            networkResponse.type !== 'error'
          ) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // لا شبكة ولا كاش - إرجاع صفحة الخطأ الأوف لاين
          if (event.request.destination === 'document') {
            return caches.match('./index.html');
          }
          // للموارد الأخرى (صور، خطوط...) إرجاع فارغ
          return new Response('', { status: 408, statusText: 'Offline' });
        });
    })
  );
});

// ================================================================
// استقبال رسائل من التطبيق (مثلاً: تحديث قسري)
// ================================================================
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
