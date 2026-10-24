import { createClient } from 'npm:@supabase/supabase-js@2.49.8';
import webpush from 'npm:web-push@3.6.7';
const headers={'Access-Control-Allow-Origin':'https://brunoonset.github.io','Access-Control-Allow-Headers':'content-type,x-bos-device,x-bos-token,authorization','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Content-Type':'application/json'};
const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers});
const db=createClient(Deno.env.get('SUPABASE_URL'),Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false}});
const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(n=>n.toString(16).padStart(2,'0')).join('');
const uuid=s=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const authenticate=async req=>{
const id=req.headers.get('x-bos-device')||'',token=req.headers.get('x-bos-token')||'';
if(!uuid(id)||token.length<32||token.length>256)return null;
const {data}=await db.from('bos_remind_devices').select('token_hash').eq('id',id).maybeSingle();
return data&&data.token_hash===await digest(token)?id:null;
};
Deno.serve(async req=>{
if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
try{
const url=new URL(req.url),route=url.pathname.split('/').pop();
const {data:cfg,error:cfgErr}=await db.from('bos_remind_config').select('vapid_private,vapid_public,cron_secret').eq('id',1).single();
if(cfgErr||!cfg)return reply({error:'Configuration manquante'},503);
if(req.method==='GET'&&route==='config')return reply({vapidPublic:cfg.vapid_public});
if(req.method==='POST'&&route==='dispatch'){
if(req.headers.get('authorization')!=='Bearer '+cfg.cron_secret)return reply({error:'Accès refusé'},401);
webpush.setVapidDetails('mailto:notification@brunoguillard.com',cfg.vapid_public,cfg.vapid_private.key);
const {data:pending,error:err}=await db.from('bos_remind_tasks').select('device_id,item_id,title,due_at').eq('completed',false).lte('due_at',new Date().toISOString()).is('notified_at',null).order('due_at',{ascending:true}).limit(70);
if(err)throw err;let sent=0,failed=0;
for(const task of pending||[]){
const {data:device}=await db.from('bos_remind_devices').select('subscription').eq('id',task.device_id).maybeSingle();
if(!device?.subscription)continue;
const {data:claim,error:claimErr}=await db.from('bos_remind_tasks').update({notified_at:task.due_at}).eq('device_id',task.device_id).eq('item_id',task.item_id).eq('due_at',task.due_at).is('notified_at',null).select('item_id');
if(claimErr||!claim?.length)continue;
try{
await webpush.sendNotification(device.subscription,JSON.stringify({id:task.item_id,title:task.title,body:'BOS REMIND · Votre rappel'}),{TTL:86400,urgency:'normal'});sent++;
}catch(error){
failed++;const status=error?.statusCode;
if(status===404||status===410)await db.from('bos_remind_devices').update({subscription:null}).eq('id',task.device_id);
else await db.from('bos_remind_tasks').update({notified_at:null}).eq('device_id',task.device_id).eq('item_id',task.item_id).eq('due_at',task.due_at);
}
}
return reply({sent,failed});
}
if(req.method!=='POST')return reply({error:'Méthode invalide'},405);
const raw=await req.text();if(raw.length>240000)return reply({error:'Taille excessive'},413);
const body=JSON.parse(raw||'{}');
if(route==='register'){
const id=req.headers.get('x-bos-device')||'',token=req.headers.get('x-bos-token')||'';
if(!uuid(id)||token.length<32||token.length>256)return reply({error:'Identifiant d’installation invalide'},400);
if(typeof body.subscription?.endpoint!=='string'||!body.subscription.endpoint.startsWith('https://')||!body.subscription.keys?.p256dh||!body.subscription.keys?.auth)return reply({error:'Abonnement Web Push incomplet'},400);
const {data:existing}=await db.from('bos_remind_devices').select('token_hash').eq('id',id).maybeSingle();
const tokenHash=await digest(token);
if(existing&&existing.token_hash!==tokenHash)return reply({error:'Appareil déjà enregistré'},403);
const {error}=await db.from('bos_remind_devices').upsert({id,token_hash:tokenHash,subscription:body.subscription,updated_at:new Date().toISOString()});
if(error)throw error;return reply({registered:true});
}
const device=await authenticate(req);if(!device)return reply({error:'Appareil non reconnu'},401);
if(route==='sync'){
if(!Array.isArray(body.reminders)||body.reminders.length>300)return reply({error:'Nombre de rappels excessif'},400);
const rows=[];
for(const task of body.reminders){
if(typeof task.id!=='string'||!task.id||task.id.length>150||typeof task.title!=='string'||!task.title.trim()||task.title.length>140||!['none','monthly','yearly'].includes(task.frequency)||!Number.isFinite(Date.parse(task.anchor))||!Number.isFinite(Date.parse(task.dueAt)))return reply({error:'Rappel invalide'},400);
rows.push({device_id:device,item_id:task.id,title:task.title,anchor:task.anchor,due_at:task.dueAt,frequency:task.frequency,completed:Boolean(task.completed),notified_at:task.notifiedAt===task.dueAt?task.notifiedAt:null,updated_at:new Date().toISOString()});
}
const {data:previous,error:prevError}=await db.from('bos_remind_tasks').select('item_id,due_at,notified_at').eq('device_id',device);
if(prevError)throw prevError;
for(const row of rows){
const previousRow=(previous||[]).find(p=>p.item_id===row.item_id);
if(previousRow?.due_at===row.due_at&&previousRow.notified_at===row.due_at)row.notified_at=previousRow.notified_at;
}
if(rows.length){const {error}=await db.from('bos_remind_tasks').upsert(rows,{onConflict:'device_id,item_id'});if(error)throw error;}
const ids=new Set(rows.map(r=>r.item_id));
for(const old of previous||[]){if(!ids.has(old.item_id)){const {error}=await db.from('bos_remind_tasks').delete().eq('device_id',device).eq('item_id',old.item_id);if(error)throw error;}}
return reply({synced:rows.length});
}
return reply({error:'Route inconnue'},404);
}catch(e){console.error('BOS REMIND',e);return reply({error:'Erreur serveur'},500);}
});