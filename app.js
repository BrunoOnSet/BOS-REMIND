(function(){
  "use strict";
  const STORAGE_KEY="bos-remind-data-v1";
  const THEME_KEY="bos-remind-theme";
  const $=id=>document.getElementById(id);
  const list=$("reminderList"),dialog=$("reminderDialog"),form=$("reminderForm");
  let editingId=null,filter="active",installPrompt=null;
  let reminders=load();

  function load(){
    try{
      const data=JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]");
      if(!Array.isArray(data))return [];
      return data.filter(r=>r&&typeof r.id==="string"&&typeof r.title==="string"&&
        ["none","monthly","yearly"].includes(r.frequency)&&Number.isFinite(Date.parse(r.dueAt))&&
        Number.isFinite(Date.parse(r.anchor))).map(r=>({id:r.id,title:r.title,frequency:r.frequency,
          dueAt:r.dueAt,anchor:r.anchor,completed:Boolean(r.completed),notifiedAt:r.notifiedAt||null}));
    }catch(_){return [];}
  }
  function save(){
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(reminders));window.dispatchEvent(new Event("bos-remind-saved"));return true;}
    catch(_){alert("Impossible d'enregistrer les rappels. Vérifiez l'espace de stockage du navigateur.");return false;}
  }
  const escapeHTML=value=>String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const displayDate=value=>new Intl.DateTimeFormat("fr-FR",{weekday:"short",day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(value));
  const frequencyLabel=f=>f==="monthly"?"Tous les mois":f==="yearly"?"Tous les ans":"Ponctuel";
  const overdue=r=>!r.completed&&Date.parse(r.dueAt)<=Date.now();
  function render(){
    const pending=reminders.filter(overdue);
    const future=reminders.filter(r=>!r.completed&&!overdue(r));
    $("futureCount").textContent=String(future.length);
    $("pendingCount").textContent=String(pending.length);
    $("repeatCount").textContent=String(reminders.filter(r=>!r.completed&&r.frequency!=="none").length);
    let rows=reminders.filter(r=>filter==="active"?!r.completed:filter==="pending"?overdue(r):r.completed);
    rows.sort((a,b)=>Number(overdue(b))-Number(overdue(a))||Date.parse(a.dueAt)-Date.parse(b.dueAt));
    list.textContent="";
    if(!rows.length){
      const empty=document.createElement("div");empty.className="empty";
      empty.innerHTML='<div class="empty-icon" aria-hidden="true">◎</div><h3>'+
        (filter==="pending"?"Aucun rappel en attente":filter==="done"?"Aucun rappel terminé":"Aucun rappel pour le moment")+
        '</h3><p>'+(filter==="active"?"Ajoutez un rappel pour commencer.":"Vos rappels apparaîtront ici.")+'</p>';
      list.appendChild(empty);return;
    }
    for(const r of rows){
      const due=overdue(r),card=document.createElement("article");
      card.className="reminder-item";
      card.innerHTML='<div class="reminder-main"><div class="reminder-copy"><h3 class="reminder-title">'+
        escapeHTML(r.title)+'</h3><p class="reminder-date">'+escapeHTML(displayDate(r.dueAt))+
        ' · '+frequencyLabel(r.frequency)+'</p></div><span class="pill'+(due?' pending':'')+'">'+
        (r.completed?"Terminé":due?"En attente":"À venir")+'</span></div><div class="reminder-actions"></div>';
      const actions=card.querySelector(".reminder-actions");
      const addAction=(label,action,cls)=>{
        const button=document.createElement("button");button.type="button";
        button.className="action "+(cls||"");button.textContent=label;
        button.dataset.action=action;button.dataset.id=r.id;actions.appendChild(button);
      };
      if(due){addAction("DONE","done","done");addAction("AGAIN","again","accent");}
      if(!r.completed)addAction("Modifier","edit");
      addAction("Supprimer","delete");
      list.appendChild(card);
    }
  }
  function setTheme(theme){
    document.documentElement.dataset.theme=theme;
    $("themeButton").textContent=theme==="dark"?"LIGHT":"DARK";
    document.querySelector('meta[name="theme-color"]').content=theme==="dark"?"#101315":"#F4F5F5";
    localStorage.setItem(THEME_KEY,theme);
  }
  function openEditor(id){
    editingId=id||null;
    form.reset();$("formError").hidden=true;
    const r=reminders.find(item=>item.id===id);
    const source=r?new Date(r.anchor):new Date(Date.now()+3600000);
    const parts=BOSDates.toLocalInput(source);
    $("reminderDate").value=parts.date;$("reminderTime").value=parts.time;
    $("reminderDate").min=BOSDates.toLocalInput(new Date()).date;
    $("reminderTitle").value=r?r.title:"";
    $("monthly").checked=Boolean(r&&r.frequency==="monthly");
    $("yearly").checked=Boolean(r&&r.frequency==="yearly");
    $("dialogTitle").textContent=r?"Modifier le rappel":"Nouveau rappel";
    $("saveButton").textContent=r?"Enregistrer les modifications":"Créer le rappel";
    dialog.showModal();
    // Sur mobile, éviter l’ouverture immédiate du clavier qui réduit la place du dialogue.
    if(!window.matchMedia("(max-width: 540px)").matches)$("reminderTitle").focus();
  }
  function closeEditor(){dialog.close();editingId=null;}
  function createId(){return globalThis.crypto&&crypto.randomUUID?crypto.randomUUID():"r-"+Date.now()+"-"+Math.random().toString(36).slice(2);}
  function persist(){if(save())render();}
  function doDone(id){
    const r=reminders.find(item=>item.id===id);if(!r||r.completed)return;
    if(r.frequency==="none")r.completed=true;
    else{
      const next=BOSDates.nextAfter(r.anchor,r.frequency,new Date());
      if(!next){alert("Impossible de calculer la prochaine occurrence.");return;}
      r.dueAt=next.toISOString();
    }
    r.notifiedAt=null;persist();
  }
  function doAgain(id){
    const r=reminders.find(item=>item.id===id);if(!r||r.completed)return;
    r.dueAt=BOSDates.nextAgain(new Date()).toISOString();
    r.notifiedAt=null;persist();
  }
  form.addEventListener("submit",event=>{
    event.preventDefault();
    const title=$("reminderTitle").value.trim();
    const date=BOSDates.fromLocalInput($("reminderDate").value,$("reminderTime").value);
    const error=$("formError");
    if(!title||!date||date.getTime()<=Date.now()){
      error.textContent="Saisissez un titre et une date/heure dans le futur.";error.hidden=false;return;
    }
    const frequency=$("monthly").checked?"monthly":$("yearly").checked?"yearly":"none";
    const anchor=date.toISOString();
    const existing=reminders.find(r=>r.id===editingId);
    if(existing)Object.assign(existing,{title,anchor,dueAt:anchor,frequency,completed:false,notifiedAt:null});
    else reminders.push({id:createId(),title,anchor,dueAt:anchor,frequency,completed:false,notifiedAt:null});
    if(!save()){return;}
    closeEditor();render();
  });
  list.addEventListener("click",event=>{
    const button=event.target.closest("button[data-action]");
    if(!button)return;
    const id=button.dataset.id,action=button.dataset.action;
    if(action==="edit")openEditor(id);
    if(action==="done")doDone(id);
    if(action==="again")doAgain(id);
    if(action==="delete"){
      if(!confirm("Supprimer définitivement ce rappel et toutes ses répétitions ?"))return;
      reminders=reminders.filter(r=>r.id!==id);persist();
    }
  });
  document.querySelectorAll(".filter").forEach(button=>button.addEventListener("click",()=>{
    filter=button.dataset.filter;
    document.querySelectorAll(".filter").forEach(b=>{
      const active=b===button;b.classList.toggle("active",active);b.setAttribute("aria-pressed",String(active));
    });
    render();
  }));
  $("newButton").addEventListener("click",()=>openEditor(null));
  $("closeDialog").addEventListener("click",closeEditor);
  dialog.addEventListener("click",e=>{if(e.target===dialog)closeEditor();});
  $("monthly").addEventListener("change",e=>{if(e.target.checked)$("yearly").checked=false;});
  $("yearly").addEventListener("change",e=>{if(e.target.checked)$("monthly").checked=false;});
  // La date conserve le sélecteur Android natif, ouvert depuis toute la zone.
  const dateField=$("reminderDate");
  function openDatePicker(){
    dateField.focus({preventScroll:true});
    if(typeof dateField.showPicker==="function"){
      try{dateField.showPicker();}catch(_){ /* comportement natif de repli */ }
    }
  }
  dateField.addEventListener("click",openDatePicker);
  dateField.closest("label").addEventListener("click",event=>{
    if(event.target===dateField)return;
    event.preventDefault();
    openDatePicker();
  });

  // Le cadran natif des heures peut dépasser sur certains Android.
  // Un sélecteur BOS intégré, sans clavier, remplace uniquement ce cadran.
  const timeField=$("reminderTime");
  const timeDialog=$("timeDialog");
  const hourSelect=$("timeHours");
  const minuteSelect=$("timeMinutes");
  const pad2=n=>String(n).padStart(2,"0");
  for(let hour=0;hour<24;hour++)hourSelect.add(new Option(pad2(hour),pad2(hour)));
  for(let minute=0;minute<60;minute++)minuteSelect.add(new Option(pad2(minute),pad2(minute)));
  function updateTimePreview(){
    $("timePreview").textContent=hourSelect.value+":"+minuteSelect.value;
  }
  function openTimePicker(){
    if(timeDialog.open)return;
    const match=/^([01][0-9]|2[0-3]):([0-5][0-9])$/.exec(timeField.value);
    hourSelect.value=match?match[1]:"09";
    minuteSelect.value=match?match[2]:"00";
    updateTimePreview();
    timeDialog.showModal();
  }
  timeField.addEventListener("click",openTimePicker);
  timeField.addEventListener("keydown",event=>{
    if(event.key==="Enter"||event.key===" "){
      event.preventDefault();
      openTimePicker();
    }
  });
  timeField.closest("label").addEventListener("click",event=>{
    if(event.target===timeField)return;
    event.preventDefault();
    openTimePicker();
  });
  hourSelect.addEventListener("change",updateTimePreview);
  minuteSelect.addEventListener("change",updateTimePreview);
  $("confirmTimeDialog").addEventListener("click",()=>{
    timeField.value=hourSelect.value+":"+minuteSelect.value;
    timeField.dispatchEvent(new Event("change",{bubbles:true}));
    timeDialog.close();
  });
  $("cancelTimeDialog").addEventListener("click",()=>timeDialog.close());
  $("closeTimeDialog").addEventListener("click",()=>timeDialog.close());
  timeDialog.addEventListener("click",event=>{
    if(event.target===timeDialog)timeDialog.close();
  });
  $("themeButton").addEventListener("click",()=>setTheme(document.documentElement.dataset.theme==="dark"?"light":"dark"));
  setTheme(localStorage.getItem(THEME_KEY)==="dark"?"dark":"light");

  function notificationState(){
    const supported="Notification" in window&&"serviceWorker" in navigator&&window.isSecureContext;
    const granted=supported&&Notification.permission==="granted";
    $("notificationStatus").textContent=!supported?
      "Les notifications nécessitent Chrome et une connexion HTTPS.":
      granted?(window.BOSPush?.active?"Notifications en arrière-plan actives · serveur connecté":"Notifications autorisées · connexion serveur en cours"):
      Notification.permission==="denied"?"Notifications bloquées dans les réglages du navigateur.":
      "Notifications non autorisées pour le moment.";
    $("enableNotifications").hidden=!supported||(granted&&Boolean(window.BOSPush?.active));
    $("enableNotifications").textContent=granted?"Réessayer la connexion":"Autoriser les notifications";
    $("testNotification").disabled=!granted;
  }
  let registrationPromise=null;
  function ensureWorker(){
    if(!("serviceWorker" in navigator))return Promise.reject(new Error("Service Worker non pris en charge"));
    if(!registrationPromise)registrationPromise=navigator.serviceWorker.register("./sw.js").catch(err=>{registrationPromise=null;throw err;});
    return registrationPromise;
  }
  async function show(title,body,id){
    const reg=await ensureWorker();
    const options={body,tag:id?"bos-remind-"+id:"bos-remind-test",silent:true,requireInteraction:true,
      icon:"./icon.svg",badge:"./icon.svg"};
    if(id){
      options.data={id};
      options.actions=[{action:"done",title:"DONE"},{action:"again",title:"AGAIN"}];
    }
    await reg.showNotification(title,options);
  }
  async function notifyDue(){
    if(window.BOSPush?.active)return;
    if(!("Notification" in window)||Notification.permission!=="granted")return;
    const due=reminders.filter(r=>overdue(r)&&r.notifiedAt!==r.dueAt);
    for(const r of due){
      try{
        await show(r.title,displayDate(r.dueAt),r.id);
        r.notifiedAt=r.dueAt;
        save();
      }catch(err){console.warn("Notification non envoyée",err);break;}
    }
    render();
  }
  $("enableNotifications").addEventListener("click",async()=>{
    if(!("Notification" in window))return;
    try{
      await ensureWorker();
      await Notification.requestPermission();
      notificationState();await notifyDue();
      window.dispatchEvent(new Event("bos-remind-permission"));
    }catch(err){alert("Impossible d'activer les notifications : "+err.message);}
  });
  $("testNotification").addEventListener("click",async()=>{
    try{await show("BOS REMIND","Notification de test · aucun son, aucune vibration.");}
    catch(err){alert("Test impossible : "+err.message);}
  });
  if("serviceWorker" in navigator&&window.isSecureContext){
    ensureWorker().then(reg=>{reg.update().catch(()=>{});}).catch(console.warn);
  }
  window.addEventListener("beforeinstallprompt",event=>{
    event.preventDefault();installPrompt=event;$("installButton").hidden=false;
  });
  $("installButton").addEventListener("click",async()=>{
    if(!installPrompt)return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt=null;$("installButton").hidden=true;
  });
  window.addEventListener("appinstalled",()=>{$("installButton").hidden=true;});
  function handleLaunchAction(){
    const url=new URL(window.location.href),action=url.searchParams.get("action"),id=url.searchParams.get("id");
    if(!id||!["done","again"].includes(action))return;
    if(action==="done")doDone(id);else doAgain(id);
    url.searchParams.delete("action");url.searchParams.delete("id");
    history.replaceState(null,"",url.pathname+url.search+url.hash);
  }
  handleLaunchAction();
  notificationState();render();notifyDue();
  window.addEventListener("bos-remind-push-state",notificationState);
  setInterval(()=>{render();notifyDue();},30000);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden){render();notifyDue();}});
  window.addEventListener("storage",e=>{if(e.key===STORAGE_KEY){reminders=load();render();}});
})();