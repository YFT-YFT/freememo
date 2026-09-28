// ペンテキ Service Worker
// 方針：
//  ・アプリ本体（HTML / manifest / アイコン等の同一オリジンのファイル）は「ネットワーク優先」。
//    → 更新ボタンを1回押せば、オンラインである限り常に最新のHTMLが読み込まれる。
//    → オフライン（ネットワーク失敗）のときだけ、最後に取得できた版をキャッシュから返す。
//  ・外部ライブラリ（cdnjs等、バージョン固定のURL）は「キャッシュ優先」でオフラインでも動くようにする。
//  ・ノートの中身（localStorageの描画データ・ページ構成）には一切触れない。
const CACHE_NAME = 'penteki-shell-v176';

self.addEventListener('install', () => { self.skipWaiting(); });

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  if (url.origin === self.location.origin) {
    // ネットワーク優先（HTTPキャッシュも再検証させる）
    event.respondWith((async () => {
      try {
        const res = await fetch(req, { cache: 'no-cache' });
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      } catch (e) {
        const cached = await caches.match(req, { ignoreSearch: true });
        if (cached) return cached;
        if (req.mode === 'navigate') {
          const any = await caches.match(url.pathname) || await caches.match('./');
          if (any) return any;
        }
        throw e;
      }
    })());
  } else {
    // 外部ライブラリ：キャッシュ優先
    event.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      const res = await fetch(req);
      if (res && (res.ok || res.type === 'opaque')) {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {});
      }
      return res;
    })());
  }
});
