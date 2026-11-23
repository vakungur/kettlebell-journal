"use strict";

const scope = self.registration.scope;
const prefix = `kettlebell-journal:${scope}:`;
const cacheName = prefix + "v1";
const assets = new Set([
  "index.html", "style.css", "app.js", "manifest.json", "icon-192.png", "icon-512.png"
].map(path => new URL(path, scope).href));
const home = new URL("index.html", scope).href;

self.addEventListener("install", event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(
    [...assets].map(url => new Request(url, { cache: "reload" }))
  )));
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(prefix) && name !== cacheName)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  url.search = "";
  const navigation = request.mode === "navigate" && (url.href === scope || url.href === home);
  if (!navigation && !assets.has(request.url)) return;
  // HTML и зависимости одной версии берутся из одного кэша.
  event.respondWith(caches.open(cacheName).then(async cache => {
    const cached = await cache.match(navigation ? home : request);
    return cached ?? fetch(request);
  }));
});
