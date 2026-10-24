const test=require("node:test");
const assert=require("node:assert/strict");
const {nextAfter,nextAgain,fromLocalInput,toLocalInput}=require("../recurrence.js");
function local(y,m,d,h=0,min=0){return new Date(y,m-1,d,h,min);}

test("AGAIN avant 9 h choisit 9 h aujourd'hui",()=>{
  assert.deepEqual(toLocalInput(nextAgain(local(2026,10,24,8,59))),{date:"2026-10-24",time:"09:00"});
});
test("AGAIN à 9 h choisit 18 h 30",()=>{
  assert.deepEqual(toLocalInput(nextAgain(local(2026,10,24,9,0))),{date:"2026-10-24",time:"18:30"});
});
test("AGAIN à 18 h 30 choisit le lendemain 9 h",()=>{
  assert.deepEqual(toLocalInput(nextAgain(local(2026,10,24,18,30))),{date:"2026-10-25",time:"09:00"});
});
test("Le 31 mensuel saute février",()=>{
  const anchor=local(2027,1,31,17,15);
  assert.deepEqual(toLocalInput(nextAfter(anchor,"monthly",anchor)),{date:"2027-03-31",time:"17:15"});
});
test("Le 29 février annuel ne se déclenche que lors d'une année bissextile",()=>{
  const anchor=local(2024,2,29,12,0);
  assert.deepEqual(toLocalInput(nextAfter(anchor,"yearly",anchor)),{date:"2028-02-29",time:"12:00"});
});
test("Les jours inexistants ne sont pas acceptés",()=>{
  assert.equal(fromLocalInput("2026-02-30","10:00"),null);
  assert.equal(fromLocalInput("2026-12-31","25:00"),null);
});
test("La récurrence d'origine ne doit pas être dépassée par une date antérieure",()=>{
  const anchor=local(2026,12,15,10);
  assert.deepEqual(toLocalInput(nextAfter(anchor,"monthly",local(2026,10,24,18,30))),{date:"2026-12-15",time:"10:00"});
});
test("Un événement simple n'a pas d'occurrence après sa date",()=>{
  const anchor=local(2026,10,24,10);
  assert.equal(nextAfter(anchor,"none",anchor),null);
});