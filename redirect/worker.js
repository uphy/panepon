// 旧名称の URL（panepon.*.workers.dev）に置く転送用の Worker。パスとクエリを保ったまま新 URL へ 301 で飛ばす。
// /sw.js だけは自壊する Service Worker を返す。旧アプリをホーム画面に追加していると、Service Worker が
// precache から旧アプリを出し続けて転送に届かないので、更新で取りに来る sw.js を置き換えて登録を外させる。
const NEW_ORIGIN = "https://swaprise.yuhi-ishikura.workers.dev";

const KILL_SWITCH_SW = `
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) await caches.delete(k);
    await self.registration.unregister();
    for (const c of await self.clients.matchAll({ type: "window" })) c.navigate(c.url);
  })());
});
`;

export default {
  fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/sw.js") {
      return new Response(KILL_SWITCH_SW, {
        headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "no-store" },
      });
    }
    return Response.redirect(NEW_ORIGIN + url.pathname + url.search, 301);
  },
};
