/* Logique pure, locale : aucune dépendance à l'interface. */
(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  root.BOSDates=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  function isValidLocal(date){return date instanceof Date&&!Number.isNaN(date.getTime());}
  function localDate(value){
    const date=new Date(value);
    if(!isValidLocal(date))throw new Error("Date invalide");
    return date;
  }
  function makeLocal(y,m,d,h,min){
    const result=new Date(y,m-1,d,h,min,0,0);
    return result.getFullYear()===y&&result.getMonth()===m-1&&result.getDate()===d&&result.getHours()===h&&result.getMinutes()===min?result:null;
  }
  function nextAfter(anchor,frequency,after){
    const initial=localDate(anchor);
    const now=localDate(after);
    if(frequency==="none")return initial>now?initial:null;
    const d=initial.getDate(),m=initial.getMonth()+1,h=initial.getHours(),min=initial.getMinutes();
    if(frequency==="monthly"){
      // Les mois ne possédant pas le numéro de jour (29,30,31) sont ignorés.
      let y=now.getFullYear(),month=now.getMonth()+1;
      for(let i=0;i<1200;i++){
        const candidate=makeLocal(y,month,d,h,min);
        if(candidate&&candidate>now&&candidate>=initial)return candidate;
        month++;
        if(month>12){month=1;y++;}
      }
    }
    if(frequency==="yearly"){
      for(let y=Math.max(now.getFullYear(),initial.getFullYear());y<=now.getFullYear()+400;y++){
        const candidate=makeLocal(y,m,d,h,min);
        if(candidate&&candidate>now&&candidate>=initial)return candidate;
      }
    }
    return null;
  }
  function nextAgain(after){
    const now=localDate(after);
    for(let delta=0;delta<3;delta++){
      const day=new Date(now.getFullYear(),now.getMonth(),now.getDate()+delta);
      for(const slot of [[9,0],[18,30]]){
        const candidate=makeLocal(day.getFullYear(),day.getMonth()+1,day.getDate(),slot[0],slot[1]);
        if(candidate&&candidate>now)return candidate;
      }
    }
    throw new Error("Impossible de trouver un prochain créneau");
  }
  function toLocalInput(date){
    const d=localDate(date);const pad=v=>String(v).padStart(2,"0");
    return {date:d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate()),time:pad(d.getHours())+":"+pad(d.getMinutes())};
  }
  function fromLocalInput(date,time){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(time))return null;
    const [year,month,day]=date.split("-").map(Number),[hour,minute]=time.split(":").map(Number);
    return makeLocal(year,month,day,hour,minute);
  }
  return Object.freeze({nextAfter,nextAgain,toLocalInput,fromLocalInput});
});