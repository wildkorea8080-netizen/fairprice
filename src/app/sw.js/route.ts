const SERVICE_WORKER = `
// Fairprice push service worker.
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "페어프라이스 특가", {
      body: payload.body || "",
      data: { url: payload.url || "/" },
      icon: "/favicon.ico",
      tag: payload.url || "fairprice-deal",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";

  // Focus an existing tab on this origin rather than opening a duplicate.
  event.waitUntil(
    self.clients.matchAll({ includeUncontrolled: true, type: "window" }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(target) && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
`.trimStart();

/**
 * Served from a route rather than public/ because this project has no public
 * directory - robots.txt, ads.txt and the Naver verification file are all
 * routes too. A service worker must be served from the origin root to control
 * the whole scope, which /sw.js satisfies.
 */
export const dynamic = "force-static";

export function GET() {
  return new Response(SERVICE_WORKER, {
    headers: {
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Content-Type": "application/javascript; charset=utf-8",
      "Service-Worker-Allowed": "/",
    },
  });
}
