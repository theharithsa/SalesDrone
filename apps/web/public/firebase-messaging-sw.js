// A single worker owns background display. Private API responses are never cached.
importScripts('https://www.gstatic.com/firebasejs/12.4.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.4.0/firebase-messaging-compat.js');
firebase.initializeApp({apiKey:'AIzaSyCHqWlqPaz1J117_vdm8NkH3koqcOGvkzw',authDomain:'sales-drone-avinya.firebaseapp.com',projectId:'sales-drone-avinya',messagingSenderId:'510928501696',appId:'1:510928501696:web:51489a43bc139eab55e625'});
const messaging=firebase.messaging();
messaging.onBackgroundMessage(payload=>{const d=payload.data||{};return self.registration.showNotification(d.title||'SalesDrone by AvinyaTech',{body:d.body||'A reminder is due.',icon:'/icon-192.png',badge:'/icon-192.png',tag:d.deliveryId||'salesdrone',data:{url:d.url||'/tasks'}});});
self.addEventListener('notificationclick',event=>{event.notification.close();const target=new URL(event.notification.data?.url||'/tasks',self.location.origin);if(target.origin!==self.location.origin)return;event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(async windows=>{for(const c of windows){if(new URL(c.url).origin===target.origin){await c.navigate(target.href);return c.focus();}}return clients.openWindow(target.href);}));});
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
