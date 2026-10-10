/* ---------- my money tracker ---------- */
var CATS = {
  in:["Pocket money","Gift","Earned (chores, jobs)","Money I already had","Other"],
  out:["Food and snacks","Games and apps","Clothes and shoes","Going out","Gifts for others","School stuff","Phone and data","Travel","Other"]
};
var DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
function loadMM(){
  var m = load("money", null) || {cur:guessCur(), tx:[], goals:[]};
  m.tx = m.tx || []; m.goals = m.goals || []; m.budget = m.budget || 0;
  m.auto = m.auto || {pct:0, goal:""}; m.recur = m.recur || {amt:0, freq:"", day:0, last:""};
  return m;
}
var MM = loadMM();
var mmType = "in", mmMonth = null;
RELOADERS.push(function(){ MM = loadMM(); });
function saveMM(){ save("money", MM); }
function today(){ var d=new Date(); return isoDay(d); }
function isoDay(d){ return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
function monthLabel(m){ var p=m.split("-"); return new Date(+p[0], +p[1]-1, 1).toLocaleDateString("en-GB",{month:"long",year:"numeric"}); }
function shiftMonth(m,k){ var p=m.split("-"), d=new Date(+p[0], +p[1]-1+k, 1); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0"); }
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
function sum(a){ return a.reduce(function(s,t){ return s+t.amt; },0); }
function r2(n){ return Math.round(n*100)/100; }
function goalTotal(){ return MM.goals.reduce(function(s,x){ return s+x.saved; },0); }
function mmBalance(){
  return sum(MM.tx.filter(function(t){return t.type==="in";})) - sum(MM.tx.filter(function(t){return t.type==="out";})) - goalTotal();
}
// Pay yourself first: move a share of money coming in straight into a goal.
function autoSave(amt){
  var a = MM.auto; if(!a || !(a.pct > 0)) return 0;
  var g = MM.goals.filter(function(x){ return x.id === a.goal; })[0] || MM.goals.filter(function(x){ return x.saved < x.target; })[0];
  if(!g) return 0;
  var put = Math.min(r2(amt*a.pct/100), Math.max(0, r2(g.target - g.saved)));
  if(put <= 0) return 0;
  g.saved = r2(g.saved + put);
  return {amt:put, goal:g.name};
}
// Adds regular pocket money for every matching day since it was last added.
function applyRecurring(){
  var r = MM.recur; if(!r || !r.freq || !(r.amt > 0) || !r.last) return 0;
  var d = new Date(r.last+"T00:00:00"), end = today(), added = 0;
  for(var i=0;i<400;i++){
    d.setDate(d.getDate()+1); var iso = isoDay(d); if(iso > end) break;
    var hit = r.freq === "week" ? d.getDay() === +r.day : d.getDate() === +r.day;
    if(hit){ MM.tx.push({id:uid(), ts:Date.now()+i, type:"in", amt:r.amt, cat:"Pocket money", nw:null, note:"Regular pocket money", date:iso, auto:true}); autoSave(r.amt); added++; }
  }
  r.last = end;
  if(added) saveMM();
  return added;
}
function nextRecurringDate(){
  var r = MM.recur, d = new Date(); if(!r.freq) return "";
  for(var i=1;i<=62;i++){ d.setDate(d.getDate()+1); if(r.freq==="week" ? d.getDay()===+r.day : d.getDate()===+r.day) return d.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"}); }
  return "";
}
function setType(t){
  mmType=t;
  $("mm-in").setAttribute("aria-pressed", t==="in"); $("mm-out").setAttribute("aria-pressed", t==="out");
  $("mm-cat").innerHTML = CATS[t].map(function(c){ return "<option>"+esc(c)+"</option>"; }).join("");
  $("mm-nw-wrap").hidden = t!=="out";
  $("mm-note").placeholder = t==="in" ? "e.g. Weekly pocket money" : "e.g. Burger with friends";
}
var lastFreq = null;
function fillDayOptions(){
  var f = $("mm-rfreq").value, sel = $("mm-rday"), v = f === lastFreq ? sel.value : "";
  lastFreq = f;
  sel.hidden = !f;
  sel.innerHTML = f === "week" ? DAYS.map(function(d,i){ return '<option value="'+i+'">on '+d+'</option>'; }).join("")
    : Array.from({length:28}, function(_,i){ var n=i+1, s=(n%10===1&&n!==11)?"st":(n%10===2&&n!==12)?"nd":(n%10===3&&n!==13)?"rd":"th"; return '<option value="'+n+'">on the '+n+s+'</option>'; }).join("");
  if(v && sel.querySelector('option[value="'+v+'"]')) sel.value = v;
}
$("mm-rfreq").onchange = fillDayOptions;
function fillSettings(){
  $("mm-cur").value = MM.cur;
  $("mm-budget").value = MM.budget || "";
  $("mm-autopct").value = String(MM.auto.pct || 0);
  $("mm-autogoal").innerHTML = MM.goals.length ? MM.goals.map(function(g){ return '<option value="'+esc(g.id)+'">'+esc(g.name)+'</option>'; }).join("") : '<option value="">your first goal (add one)</option>';
  if(MM.auto.goal) $("mm-autogoal").value = MM.auto.goal;
  $("mm-ramt").value = MM.recur.amt || "";
  $("mm-rfreq").value = MM.recur.freq || "";
  fillDayOptions();
  if(MM.recur.freq) $("mm-rday").value = String(MM.recur.day);
}

function renderMoney(){
  if(!mmMonth) mmMonth = today().slice(0,7);
  var added = applyRecurring();
  if(!$("mm-date").value) $("mm-date").value = today();
  if(!$("mm-cat").options.length) setType(mmType);
  $("mm-intro").textContent = ME ? "Keep track of the pocket money you get and what you spend it on. It's saved to your account, so it's on all your devices."
    : "Keep track of the pocket money you get and what you spend it on. It's saved on this device only. Sign in to keep it everywhere.";
  if(added) setMsg($("mm-msg"), "Added your regular pocket money ("+added+" time"+(added>1?"s":"")+").", "good");
  var bal = mmBalance(), inGoals = goalTotal();
  var mtx = MM.tx.filter(function(t){ return t.date.slice(0,7)===mmMonth; });
  var mIn = sum(mtx.filter(function(t){return t.type==="in";})), mOut = sum(mtx.filter(function(t){return t.type==="out";}));
  $("mm-stats").innerHTML = stat('<span class="'+(bal<0?"down":"")+'">'+cm(bal)+'</span>',"Money you have to spend") +
    stat(cm(inGoals),"Put aside for goals") + stat('<span class="up">'+cm(mIn)+'</span>',"In during "+monthLabel(mmMonth)) +
    stat('<span class="down">'+cm(mOut)+'</span>',"Spent during "+monthLabel(mmMonth));
  $("mm-month").textContent = monthLabel(mmMonth);
  $("mm-next").disabled = mmMonth >= today().slice(0,7);

  var outs = mtx.filter(function(t){return t.type==="out";}), by = {};
  outs.forEach(function(t){ by[t.cat]=(by[t.cat]||0)+t.amt; });
  var cats = Object.keys(by).sort(function(a,b){ return by[b]-by[a]; });
  var html = "";
  if(MM.budget > 0){
    var used = mOut/MM.budget, isNow = mmMonth === today().slice(0,7), now = new Date();
    var daysLeft = isNow ? new Date(now.getFullYear(), now.getMonth()+1, 0).getDate() - now.getDate() + 1 : 0;
    var left = MM.budget - mOut;
    html += '<p style="margin:0 0 2px"><b>'+cm(mOut)+'</b> of your '+cm(MM.budget)+' budget</p><div class="meter"><div style="width:'+Math.min(100,used*100)+'%;background:'+(used>1?"var(--down)":used>0.85?"var(--hl)":"var(--up)")+'"></div></div>'+
      '<p class="muted small" style="margin:0 0 14px">'+(left < 0 ? "Over budget by "+cm(-left)+"." : isNow ? cm(left)+" left for "+daysLeft+" more day"+(daysLeft===1?"":"s")+": about "+cm(r2(left/daysLeft))+" a day." : cm(left)+" under budget.")+'</p>';
  }
  if(!mtx.length){
    html += '<p class="muted">Nothing logged in '+monthLabel(mmMonth)+' yet.'+(MM.tx.length?'':' Start by adding the pocket money you get, then add things you buy.')+'</p>';
  } else if(!outs.length){
    html += '<p class="muted">No spending logged this month. Add what you buy to see where your money goes.</p>';
  } else {
    var top = by[cats[0]];
    html += cats.map(function(c){ return '<div class="cat-row"><span>'+esc(c)+'</span><div class="cat-bar"><div style="width:'+(by[c]/top*100).toFixed(1)+'%"></div></div><span class="amt">'+cm(by[c])+' · '+Math.round(by[c]/mOut*100)+'%</span></div>'; }).join("");
    var wants = sum(outs.filter(function(t){return t.nw==="want";})), needs = mOut-wants;
    html += '<p class="muted" style="margin:12px 0 4px">Needs vs wants</p><div class="meter" style="display:flex"><div style="width:'+(needs/mOut*100)+'%;background:var(--up);border-radius:0"></div><div style="width:'+(wants/mOut*100)+'%;background:var(--hl);border-radius:0"></div></div>'+
      '<div class="legend"><span style="--c:var(--up)">Needs '+cm(needs)+'</span><span style="--c:var(--hl)">Wants '+cm(wants)+'</span></div>';
  }
  var tip = "";
  if(mtx.length){
    if(mIn>0 && mOut>mIn) tip = "You spent "+cm(mOut-mIn)+" more than you got this month. That only works while you have savings to fall back on.";
    else if(outs.length && by[cats[0]]/mOut>0.4 && cats.length>1) tip = Math.round(by[cats[0]]/mOut*100)+"% of your spending went on "+cats[0].toLowerCase()+". Is that what you'd choose if you planned it ahead?";
    else if(mIn>0 && (mIn-mOut)/mIn>=0.2) tip = "You kept "+Math.round((mIn-mOut)/mIn*100)+"% of what came in this month. Saving 20% or more is a great habit.";
    else if(mIn>0) tip = "You kept "+Math.round(Math.max(0,mIn-mOut)/mIn*100)+"% of what came in. Try turning on automatic saving below, so some goes aside as soon as you get it.";
  }
  if(tip) html += '<div class="tip"><b>Tip.</b> '+esc(tip)+'</div>';
  $("mm-breakdown").innerHTML = html;

  var list = MM.tx.slice().sort(function(a,b){ return a.date<b.date?1:a.date>b.date?-1:(b.ts||0)-(a.ts||0); }).slice(0,80);
  $("mm-tx").innerHTML = list.length ? list.map(function(t){
    var d = new Date(t.date+"T00:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short"});
    return '<li><div class="what"><b>'+esc(t.note||t.cat)+'</b><small>'+d+' · '+esc(t.cat)+(t.type==="out"?' · '+(t.nw==="need"?"need":"want"):'')+'</small></div>'+
      '<span class="amt '+(t.type==="in"?"up":"down")+'">'+(t.type==="in"?"+":"−")+cm(t.amt)+'</span><button class="x" data-del="'+esc(t.id)+'" aria-label="Delete this entry">×</button></li>';
  }).join("") : '<li class="muted">Your entries will show up here.</li>';

  $("mm-goals").innerHTML = MM.goals.length ? MM.goals.map(function(g){
    var pc = Math.min(100, g.saved/g.target*100), done = g.saved>=g.target-0.001, plan = "";
    if(!done && g.date){
      var weeks = Math.max(0, (new Date(g.date+"T00:00:00") - new Date())/(7*86400000));
      plan = weeks >= 1 ? "Save about "+cm(Math.ceil((g.target-g.saved)/weeks))+" a week to reach it by "+new Date(g.date+"T00:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short"})+"."
        : "Your target date is very close: "+cm(r2(g.target-g.saved))+" to go.";
    }
    return '<div class="goal"><div class="row" style="justify-content:space-between"><b>'+esc(g.name)+'</b><span>'+cm(g.saved)+' of '+cm(g.target)+'</span></div>'+
      '<div class="meter"><div style="width:'+pc+'%;background:'+(done?"var(--up)":"var(--blue)")+'"></div></div>'+
      (done ? '<p style="margin:0 0 8px" class="up"><b>You reached it!</b> When you buy it, remove the goal and log the purchase under money out.</p>'
            : '<p class="muted" style="margin:0 0 8px;font-size:.9rem">'+cm(r2(g.target-g.saved))+' to go. '+esc(plan)+'</p>')+
      '<div class="row"><input type="number" min="0" step="any" inputmode="decimal" placeholder="Amount" aria-label="Amount for '+esc(g.name)+'" id="ga-'+esc(g.id)+'">'+
      '<button class="btn alt small" data-gput="'+esc(g.id)+'">Put in</button><button class="btn alt small" data-gtake="'+esc(g.id)+'">Take out</button><button class="x" data-gdel="'+esc(g.id)+'" aria-label="Remove goal">×</button></div></div>';
  }).join("") : '<p class="muted">Add something you\'re saving for. Money you put toward a goal is kept separate from your spending money.</p>';
  if(!$("mm-settings").open) fillSettings();
}
$("mm-in").onclick=function(){ setType("in"); };
$("mm-out").onclick=function(){ setType("out"); };
$("mm-add").onclick=function(){
  var amt = parseFloat($("mm-amt").value), msg=$("mm-msg");
  if(!(amt>0)){ setMsg(msg,"Enter an amount above zero.","err"); return; }
  var date = $("mm-date").value || today();
  if(date>today()){ setMsg(msg,"That date is in the future. Pick today or an earlier day.","err"); return; }
  var nwEl = document.querySelector('input[name="mm-nw"]:checked');
  amt = r2(amt);
  MM.tx.push({id:uid(), ts:Date.now(), type:mmType, amt:amt, cat:$("mm-cat").value, nw: mmType==="out" ? (nwEl?nwEl.value:"want") : null, note:$("mm-note").value.trim().slice(0,60), date:date});
  var auto = mmType==="in" ? autoSave(amt) : 0;
  saveMM();
  var text = (mmType==="in"?"Added ":"Logged ")+cm(amt)+(mmType==="in"?" coming in.":" spent.");
  if(auto) text += " "+cm(auto.amt)+" went straight to "+auto.goal+".";
  if(mmType==="out" && mmBalance()<0) text += " Heads up: that's more than you've logged coming in. If you had money before, add it under Money in → Money I already had.";
  setMsg(msg, text, "good");
  $("mm-amt").value=""; $("mm-note").value="";
  mmMonth = date.slice(0,7);
  renderMoney();
};
$("mm-amt").addEventListener("keydown", function(e){ if(e.key==="Enter") $("mm-add").click(); });
$("mm-tx").addEventListener("click", function(e){
  var b=e.target.closest("[data-del]"); if(!b) return;
  MM.tx = MM.tx.filter(function(t){ return t.id!==b.dataset.del; }); saveMM(); renderMoney();
});
$("mm-gadd").onclick=function(){
  var n=$("mm-gname").value.trim().slice(0,40), t=parseFloat($("mm-gtarget").value), d=$("mm-gdate").value, msg=$("mm-gmsg");
  if(!n){ setMsg(msg,"Give your goal a name.","err"); return; }
  if(!(t>0)){ setMsg(msg,"Enter how much it costs.","err"); return; }
  if(d && d <= today()){ setMsg(msg,"Pick a date in the future, or leave it empty.","err"); return; }
  var g = {id:uid(), name:n, target:r2(t), saved:0, date:d||""};
  MM.goals.push(g); if(!MM.auto.goal) MM.auto.goal = g.id; saveMM();
  $("mm-gname").value=""; $("mm-gtarget").value=""; $("mm-gdate").value="";
  setMsg(msg,"Goal added. Put money in whenever you can, or turn on automatic saving.","good");
  renderMoney();
};
$("mm-goals").addEventListener("click", function(e){
  var b=e.target.closest("[data-gput],[data-gtake],[data-gdel]"); if(!b) return;
  var id=b.dataset.gput||b.dataset.gtake||b.dataset.gdel, g=MM.goals.filter(function(x){return x.id===id;})[0], msg=$("mm-gmsg");
  if(!g) return;
  if(b.dataset.gdel){
    if(g.saved>0 && !confirm("Remove this goal? The "+cm(g.saved)+" in it goes back to your spending money.")) return;
    MM.goals = MM.goals.filter(function(x){return x.id!==id;}); if(MM.auto.goal===id) MM.auto.goal = MM.goals[0] ? MM.goals[0].id : "";
    saveMM(); setMsg(msg,""); renderMoney(); return;
  }
  var a=parseFloat($("ga-"+id).value);
  if(!(a>0)){ setMsg(msg,"Type an amount next to the goal first.","err"); return; }
  if(b.dataset.gput){
    var bal=mmBalance(); if(a>bal+0.001){ setMsg(msg,"You only have "+cm(Math.max(0,bal))+" to spend right now.","err"); return; }
    g.saved=r2(g.saved+a); setMsg(msg,"Put "+cm(a)+" toward "+g.name+".","good");
  } else {
    if(a>g.saved+0.001){ setMsg(msg,"There's only "+cm(g.saved)+" in that goal.","err"); return; }
    g.saved=r2(g.saved-a); setMsg(msg,"Took "+cm(a)+" out of "+g.name+".","good");
  }
  saveMM(); renderMoney();
});
$("mm-save-settings").onclick = function(){
  var msg = $("mm-smsg"), b = parseFloat($("mm-budget").value), ra = parseFloat($("mm-ramt").value), f = $("mm-rfreq").value;
  if(f && !(ra>0)){ setMsg(msg,"Enter how much regular pocket money you get.","err"); return; }
  MM.cur = $("mm-cur").value;
  MM.budget = b>0 ? r2(b) : 0;
  MM.auto = {pct: +$("mm-autopct").value, goal: $("mm-autogoal").value};
  var changed = f !== MM.recur.freq || +$("mm-rday").value !== +MM.recur.day || r2(ra||0) !== MM.recur.amt;
  MM.recur = f ? {amt:r2(ra), freq:f, day:+$("mm-rday").value, last: changed ? today() : (MM.recur.last || today())} : {amt:0, freq:"", day:0, last:""};
  saveMM(); calcCur = null;
  var parts = ["Saved."];
  if(MM.auto.pct && !MM.goals.length) parts.push("Add a goal so automatic saving has somewhere to go.");
  if(MM.recur.freq) parts.push("Next pocket money will be added on "+nextRecurringDate()+".");
  setMsg(msg, parts.join(" "), "good");
  renderMoney();
};
$("mm-prev").onclick=function(){ mmMonth=shiftMonth(mmMonth,-1); renderMoney(); };
$("mm-next").onclick=function(){ mmMonth=shiftMonth(mmMonth,1); renderMoney(); };
$("mm-clear").onclick=function(){
  if(!confirm("Delete all your money entries, goals and settings"+(ME?" (on every device)":"")+"? This can't be undone.")) return;
  MM = {cur:MM.cur, tx:[], goals:[], budget:0, auto:{pct:0,goal:""}, recur:{amt:0,freq:"",day:0,last:""}}; saveMM(); setMsg($("mm-smsg"),"Cleared.","good"); renderMoney();
};
RENDER.money = renderMoney;
