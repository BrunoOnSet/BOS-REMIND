(function(){
"use strict";
// Chaque installation possède une identité non transférable. Ne jamais mettre le token dans GitHub.
const API="https://busesheskvlgpuewlskj.supabase.co/functions/v1/bos-remind";
const STORAGE="bos-remind-data-v1",ID_KEY="bos-remind-device-id",TOKEN_KEY="bos-remind-device-token";
const state=window.BOSPush={active:false,registered:false};
let pending=false,working=false;
function bytes(n){const a=new Uint8Array(n);crypto.getRandomValues(a);return a;}
function b64url(str){return str.replace(/-/g,"+").replace(/_/g,"/");}
function publicKey(value){const raw=atob(b64url(value));return Uint8Array.from(raw,c=>c.charCodeAt(0));}
function getIdentity(){
 let id=localStorage.getItem(ID_KEY),token=localStorage.getItem(TOKEN_KEY);
 if(!id||!token){
  id=crypto.randomUUID();
  token=Array.from(bytes(32),b=>b.toString(16).padStart(2,"0")).join("");
  localStorage.setItem(ID_KEY,id);localStorage.setItem(TOKEN_KEY,token);
 }
 return {id,token};
}
async function request(path,data,auth=true){
 const headers={"content-type":"application/json"};
 if(auth){const {id,token}=getIdentity();headers["x-bos-device"]=id;headers["x-bos-token"]=token;}
 const response=await fetch(API+"/"+path,{method:data===undefined?"GET":"POST",headers,body:data===undefined?undefined:JSON.stringify(data),cache:"no-store"});
 let payload;try{payload=await response.json()}catch(_){payload={};}
 if(!response.ok)throw Error(payload.error||"Erreur HTTP "+response.status);
 return payload;
}
function status(message){
 const target=document.getElementById("pushStatus");
 if(target)target.textContent=message;
 window.dispatchEvent(new Event("bos-remind-push-state"));
}
async function sync(){
 if(!state.active)return;
 const items=JSON.parse(localStorage.getItem(STORAGE)||"[]");
 await request("sync",{reminders:Array.isArray(items)?items:[]});
}
async function flush(){
 if(!state.active||working){pending=true;return;}
 working=true;
 try{do{pending=false;await sync();}while(pending);}
 catch(e){console.warn("BOS REMIND synchronisation",e);status("Connexion serveur interrompue. Vos rappels restent sur ce téléphone ; ils seront synchronisés au prochain retour en ligne.");}
 finally{working=false;}
}
async function start(askPermission){
 if(!navigator.serviceWorker||!window.PushManager||!window.Notification||!window.isSecureContext){
  status("Ce navigateur ne permet pas les notifications en arrière-plan.");return;
 }
 if(askPermission&&Notification.permission!=="granted")await Notification.requestPermission();
 if(Notification.permission!=="granted"){status("Autorisez les notifications pour activer les rappels lorsque l’application est fermée.");return;}
 try{
  const config=await request("config",undefined,false);
  const registration=await navigator.serviceWorker.register("./sw.js");
  await navigator.serviceWorker.ready;
  let subscription=await registration.pushManager.getSubscription();
  if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:publicKey(config.vapidPublic)});
  await request("register",{subscription:subscription.toJSON()});
  state.active=true;state.registered=true;
  await flush();
  status("Notifications en arrière-plan activées. Vos rappels sont enregistrés sur le serveur BOS REMIND et vérifiés chaque minute.");
 }catch(e){
  state.active=false;
  console.warn("BOS REMIND Push",e);
  status("Activation des notifications en arrière-plan impossible : "+e.message+". Réessayez avec le bouton « Autoriser les notifications ».");
 }
}
window.addEventListener("bos-remind-saved",()=>{pending=true;void flush()});
window.addEventListener("bos-remind-permission",()=>{void start(true)});
window.addEventListener("online",()=>{void start(false)});
document.addEventListener("visibilitychange",()=>{if(!document.hidden)void start(false)});
if(Notification.permission==="granted")void start(false);
})();