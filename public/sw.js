// Service Worker — Web Push (Etapa 7D)
// Recebe as notificações (push) e trata o clique abrindo/focando a aba certa.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_e) {
    data = { body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Sabor Express";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icon.svg",
    badge: "/icon.svg",
    tag: data.tag,
    renotify: !!data.tag,
    data: { url: data.url || "/" },
    requireInteraction: !!data.requireInteraction,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if (client.url.includes(url) && "focus" in client) return client.focus();
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
      })
  );
});
