const CACHE="bos-remind-v4";
const FILES=["./","./index.html","./style.css","./app.js","./recurrence.js","./manifest.webmanifest","./icon.svg","./icons/icon-192.png","./icons/icon-512.png"];
self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith("bos-remind-")&&key!==CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    try{
      const response=await fetch(event.request,{cache:"no-store"});
      if(response.ok)cache.put(event.request,response.clone());
      return response;
    }catch(_){
      return await cache.match(event.request,{ignoreSearch:true})||Response.error();
    }
  })());
});
self.addEventListener("push",event=>{
  event.waitUntil((async()=>{
    let message={};
    try{message=event.data?event.data.json():{};}catch(_){}
    if(!message.id||typeof message.id!=="string")return;
    await self.registration.showNotification(String(message.title||"BOS REMIND"),{
      body:String(message.body||"Votre rappel est arrivé."),
      icon:"./icon.svg",badge:"./icon.svg",silent:true,requireInteraction:true,
      tag:"bos-remind-"+message.id,data:{id:message.id},
      actions:[{action:"done",title:"DONE"},{action:"again",title:"AGAIN"}]
    });
  })());
});
self.addEventListener("notificationclick",event=>{
  event.notification.close();
  const id=event.notification.data&&event.notification.data.id;
  const path=new URL("./",self.registration.scope);
  if(id&&["done","again"].includes(event.action)){
    path.searchParams.set("action",event.action);path.searchParams.set("id",id);
  }
  event.waitUntil((async()=>{
    const clientsList=await clients.matchAll({type:"window",includeUncontrolled:true});
    const app=clientsList.find(c=>c.url.startsWith(self.registration.scope));
    if(app){
      await app.navigate(path.href);
      return app.focus();
    }
    return clients.openWindow(path.href);
  })());
});