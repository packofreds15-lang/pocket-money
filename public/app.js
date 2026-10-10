/* Pocket Money app. Built from src/ by tools/build_site.py: edit the files in src/, not this one. */
(function(){
"use strict";
/* ===== 00-core.js ===== */
/* ---------- helpers ---------- */
function $(id){ return document.getElementById(id); }
function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
function money(n, dp){ dp = dp==null ? 0 : dp; var s = Math.abs(n).toLocaleString("en-US",{minimumFractionDigits:dp,maximumFractionDigits:dp}); return (n<0?"−$":"$")+s; }
function pct(n, dp){ dp = dp==null?1:dp; return (n>0?"+":n<0?"−":"")+Math.abs(n*100).toFixed(dp)+"%"; }
function cls(n){ return n>0.00001?"up":n<-0.00001?"down":""; }
function stat(v,l){ return '<div class="card stat"><div class="v">'+v+'</div><div class="l">'+l+'</div></div>'; }
function setMsg(el, text, kind){ el.textContent = text || ""; el.className = "msg" + (kind ? " "+kind : ""); }
function fmtDate(sec){ return new Date(sec*1000).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}); }

/* ---------- storage, with sync to your account when signed in ---------- */
var SYNC_KEYS = ["lessons","quiz","pf","money","watchlist","prefs"];
function rawGet(k){ try{ return localStorage.getItem("i4t:"+k); }catch(e){ return null; } }
function rawSet(k,v){ try{ if(v==null) localStorage.removeItem("i4t:"+k); else localStorage.setItem("i4t:"+k, v); }catch(e){} }
function load(k, d){ var v = rawGet(k); if(!v) return d; try{ return JSON.parse(v); }catch(e){ return d; } }
var syncMeta = load("_meta", {});
function save(k, v){
  rawSet(k, JSON.stringify(v));
  if(SYNC_KEYS.indexOf(k) >= 0){ syncMeta[k] = Date.now(); rawSet("_meta", JSON.stringify(syncMeta)); queuePush(k); }
}
var pushQueue = {}, pushTimer = null;
function queuePush(k){ if(!ME || ME.needsProfile) return; pushQueue[k] = 1; clearTimeout(pushTimer); pushTimer = setTimeout(flushPush, 1200); }
function flushPush(){
  var keys = Object.keys(pushQueue); pushQueue = {};
  return Promise.all(keys.map(function(k){
    var v = load(k, null); if(v == null) return null;
    return api("PUT", "/api/state/"+k, {value: v, updatedAt: syncMeta[k] || Date.now()}).catch(function(){ pushQueue[k] = 1; });
  }));
}
window.addEventListener("pagehide", function(){ if(Object.keys(pushQueue).length) flushPush(); });

var RELOADERS = [];
function reloadAll(){ RELOADERS.forEach(function(f){ try{ f(); }catch(e){} }); go(currentPage, currentArg, true); }
function pullState(){
  return api("GET", "/api/state").then(function(r){
    var changed = false;
    SYNC_KEYS.forEach(function(k){
      var s = r.state[k], localAt = syncMeta[k], hasLocal = rawGet(k) != null;
      if(s && (!hasLocal || !localAt || s.updatedAt >= localAt)){
        var txt = JSON.stringify(s.value);
        if(txt !== rawGet(k)){ rawSet(k, txt); changed = true; }
        syncMeta[k] = s.updatedAt;
      } else if(hasLocal){ pushQueue[k] = 1; }
    });
    rawSet("_meta", JSON.stringify(syncMeta));
    if(Object.keys(pushQueue).length) flushPush();
    if(changed) reloadAll();
  }).catch(function(){});
}
function clearDeviceData(){
  SYNC_KEYS.forEach(function(k){ rawSet(k, null); });
  syncMeta = {}; rawSet("_meta", null);
}

/* ---------- talking to the server ---------- */
var API = { ok:false, cfg:{} }, ME = null;
function api(method, path, body){
  var opts = { method: method, credentials: "same-origin", headers: { "x-pm": "1" } };
  if(body !== undefined){ opts.headers["content-type"] = "application/json"; opts.body = JSON.stringify(body); }
  return fetch(path, opts).then(function(r){
    return r.json().catch(function(){ return {}; }).then(function(j){
      if(!r.ok){ var e = new Error(j.message || "Request failed"); e.status = r.status; e.code = j.error; throw e; }
      return j;
    });
  });
}
function detectApi(){
  var ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
  var t = setTimeout(function(){ ctl && ctl.abort(); }, 6000);
  return fetch("/api/config", { credentials:"same-origin", signal: ctl ? ctl.signal : undefined }).then(function(r){
    clearTimeout(t);
    if(!r.ok || (r.headers.get("content-type")||"").indexOf("json") < 0) return false;
    return r.json().then(function(j){ if(typeof j.google !== "boolean") return false; API.ok = true; API.cfg = j; return true; });
  }).catch(function(){ clearTimeout(t); return false; });
}
function loadMe(){
  if(!API.ok){ renderMeButton(); return Promise.resolve(null); }
  return api("GET","/api/me").then(function(r){ ME = r.user; renderMeButton(); return ME; }).catch(function(){ renderMeButton(); return null; });
}
var tracked = {};
function trackPage(p){
  if(!API.ok || tracked[p]) return; tracked[p] = 1;
  api("POST","/api/track",{page:p}).catch(function(){});
}

/* ---------- pages and navigation ---------- */
var PAGES = ["home","learn","money","portfolio","research","quiz","guide","about","contact","account","admin","privacy","terms","cookies","disclaimer"];
var RENDER = {};
var currentPage = "home", currentArg = "";
function go(p, arg, noScroll){
  if(PAGES.indexOf(p) < 0) p = "home";
  var target = "#" + p + (arg ? "/" + arg : "");
  if(location.hash !== target && !(p === "home" && !location.hash)){ try{ history.pushState(null, "", target); }catch(e){} }
  show(p, arg || "", noScroll);
}
function show(p, arg, noScroll){
  currentPage = p; currentArg = arg;
  PAGES.forEach(function(x){ $("page-"+x).classList.toggle("active", x===p); });
  document.querySelectorAll("nav.tabs button, nav.bottom-nav button").forEach(function(b){
    if(b.dataset.go===p) b.setAttribute("aria-current","page"); else b.removeAttribute("aria-current");
  });
  if(RENDER[p]) RENDER[p](arg);
  document.title = (p === "home" ? "Pocket Money" : (TITLES[p] || p) + " · Pocket Money");
  trackPage(p);
  if(!noScroll) window.scrollTo(0,0);
}
var TITLES = {learn:"Lessons",money:"My money",portfolio:"Practice portfolio",research:"Research",quiz:"Quiz",guide:"Cheat sheet",
  about:"About",contact:"Contact",account:"Your account",admin:"Admin",privacy:"Privacy policy",terms:"Terms of use",cookies:"Cookies",disclaimer:"Disclaimer"};
function routeFromHash(){
  var h = (location.hash || "#home").slice(1), parts = h.split("/"), p = parts[0], arg = parts.slice(1).join("/");
  if(p !== "login"){ var d = document.getElementById("login-dlg"); if(d && d.open) d.close(); }
  if(p === "login"){ try{ history.replaceState(null,"","#home"); }catch(e){} show("home",""); openLogin("message", arg); return; }
  show(PAGES.indexOf(p) >= 0 ? p : "home", decodeURIComponent(arg || ""));
}
window.addEventListener("popstate", routeFromHash);
window.addEventListener("hashchange", routeFromHash);
document.addEventListener("click", function(e){
  var t = e.target.closest("[data-go]");
  if(t){ e.preventDefault(); if(t.dataset.track) setTrack(t.dataset.track); go(t.dataset.go, t.dataset.arg || ""); return; }
  var l = e.target.closest("[data-open-login]");
  if(l){ e.preventDefault(); openLogin(l.dataset.openLogin); }
});

/* ---------- header account button ---------- */
function renderMeButton(){
  var b = $("me-btn");
  if(ME && !ME.needsProfile){
    var n = ME.name || ME.email.split("@")[0];
    b.className = "me-btn desk";
    b.innerHTML = '<span class="av" aria-hidden="true">'+esc(n.charAt(0).toUpperCase())+'</span>'+esc(n);
  } else { b.className = "me-btn signin desk"; b.textContent = "Sign in"; }
  var band = $("home-account-band"); if(band) band.hidden = !!ME;
}
$("me-btn").onclick = function(){ if(ME) go("account"); else openLogin("signin"); };

/* ---------- cookie notice + install as app ---------- */
if(!rawGet("cookie_ok")) $("cookie").hidden = false;
$("cookie-ok").onclick = function(){ rawSet("cookie_ok","1"); $("cookie").hidden = true; };
var deferredInstall = null;
window.addEventListener("beforeinstallprompt", function(e){ e.preventDefault(); deferredInstall=e; $("install-btn").classList.add("show"); });
window.addEventListener("appinstalled", function(){ deferredInstall=null; $("install-btn").classList.remove("show"); });
$("install-btn").onclick=function(){ if(!deferredInstall) return; deferredInstall.prompt(); deferredInstall.userChoice.finally(function(){ deferredInstall=null; $("install-btn").classList.remove("show"); }); };
if("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost") && !/claude|claudeusercontent/.test(location.hostname)){
  window.addEventListener("load", function(){ navigator.serviceWorker.register("sw.js").catch(function(){}); });
}

/* ===== 10-charts-home.js ===== */
/* ---------- currency ---------- */
var CUR = {INR:{sym:"₹",loc:"en-IN"},USD:{sym:"$",loc:"en-US"},GBP:{sym:"£",loc:"en-GB"},EUR:{sym:"€",loc:"en-IE"}};
function guessCur(){ try{ var l=(navigator.language||"").toLowerCase(), tz=(Intl.DateTimeFormat().resolvedOptions().timeZone||"");
  if(/-in$/.test(l) || /Calcutta|Kolkata/.test(tz)) return "INR"; if(/-gb$/.test(l)) return "GBP"; if(/-(de|fr|es|it|nl|ie|pt|at|be|fi)$/.test(l)) return "EUR"; if(/-us$/.test(l)) return "USD"; }catch(e){} return "INR"; }
function curCode(){ var m = load("money", null); return (m && CUR[m.cur]) ? m.cur : guessCur(); }
function cm(n, code){ var c = CUR[code || curCode()] || CUR.INR, dp = Math.abs(n%1)>0.001 ? 2 : 0;
  return (n<0?"−":"")+c.sym+Math.abs(n).toLocaleString(c.loc,{minimumFractionDigits:dp,maximumFractionDigits:2}); }
function bigMoney(n, code){ // short form for large amounts: ₹1.2 crore / $3.4B
  code = code || "USD"; var c = CUR[code] || {sym:code+" "}, a = Math.abs(n), s = n<0?"−":"";
  if(code === "INR"){ if(a>=1e7) return s+c.sym+(a/1e7).toLocaleString("en-IN",{maximumFractionDigits:a>=1e9?0:1})+" crore"; if(a>=1e5) return s+c.sym+(a/1e5).toFixed(1)+" lakh"; return s+c.sym+Math.round(a).toLocaleString("en-IN"); }
  if(a>=1e12) return s+c.sym+(a/1e12).toFixed(2)+"T"; if(a>=1e9) return s+c.sym+(a/1e9).toFixed(1)+"B"; if(a>=1e6) return s+c.sym+(a/1e6).toFixed(1)+"M"; return s+c.sym+Math.round(a).toLocaleString("en-US");
}

/* ---------- charts ---------- */
function lineChart(series, opt){
  opt=opt||{}; var W=640,H=opt.h||240,pl=opt.pl||56,pr=12,pt=12,pb=26;
  var all=[]; series.forEach(function(s){ all=all.concat(s.d); });
  var mn=Math.min.apply(null,all), mx=Math.max.apply(null,all);
  if(mx===mn){ mx+=1; mn-=1; }
  var pad=(mx-mn)*0.08; mn-=pad; mx+=pad; if(opt.min0) mn=Math.max(mn,0);
  var n=Math.max.apply(null,series.map(function(s){return s.d.length;}));
  function X(i){ return pl+(n<=1?0:(i/(n-1))*(W-pl-pr)); }
  function Y(v){ return pt+(1-(v-mn)/(mx-mn))*(H-pt-pb); }
  var g="";
  for(var k=0;k<=3;k++){
    var v=mn+(mx-mn)*k/3, y=Y(v);
    g+='<line x1="'+pl+'" x2="'+(W-pr)+'" y1="'+y+'" y2="'+y+'" stroke="var(--line)"/>';
    g+='<text x="'+(pl-6)+'" y="'+(y+4)+'" text-anchor="end" font-size="11" fill="var(--muted)">'+esc(opt.fmt?opt.fmt(v):v.toFixed(0))+'</text>';
  }
  if(opt.xlabels){ opt.xlabels.forEach(function(l){ var a = l.i===0?"start":l.i>=n-1?"end":"middle"; g+='<text x="'+X(l.i)+'" y="'+(H-6)+'" text-anchor="'+a+'" font-size="11" fill="var(--muted)">'+esc(l.t)+'</text>'; }); }
  series.forEach(function(s){
    var d=s.d.map(function(v,i){ return (i?"L":"M")+X(i).toFixed(1)+" "+Y(v).toFixed(1); }).join(" ");
    g+='<path d="'+d+'" fill="none" stroke="'+s.c+'" stroke-width="'+(s.w||2.5)+'" stroke-linejoin="round" stroke-linecap="round"'+(s.dash?' stroke-dasharray="5 5"':'')+'/>';
  });
  return '<svg class="chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(opt.label||"Line chart")+'">'+g+'</svg>';
}
function barChart(labels, groups, opt){
  var W=640,H=opt.h||220,pl=opt.pl||60,pr=10,pt=10,pb=28;
  var mx=0, mn=0; groups.forEach(function(g){ g.d.forEach(function(v){ if(v==null) return; mx=Math.max(mx,v); mn=Math.min(mn,v); }); });
  if(mx===0 && mn===0) mx=1;
  mx*=1.1; if(mn<0) mn*=1.2;
  function Y(v){ return pt+(1-(v-mn)/(mx-mn))*(H-pt-pb); }
  var slot=(W-pl-pr)/labels.length, bw=slot*0.7/groups.length, s="";
  for(var k=0;k<=3;k++){ var v=mn+(mx-mn)*k/3; s+='<line x1="'+pl+'" x2="'+(W-pr)+'" y1="'+Y(v)+'" y2="'+Y(v)+'" stroke="var(--line)"/><text x="'+(pl-6)+'" y="'+(Y(v)+4)+'" text-anchor="end" font-size="11" fill="var(--muted)">'+esc(opt.fmt(v))+'</text>'; }
  labels.forEach(function(l,i){
    groups.forEach(function(g,j){
      var v=g.d[i]; if(v==null) return;
      var x=pl+slot*i+slot*0.15+bw*j, y0=Y(0), y1=Y(v);
      s+='<rect x="'+x+'" y="'+Math.min(y0,y1)+'" width="'+Math.max(2,bw-3)+'" height="'+Math.max(1,Math.abs(y1-y0))+'" rx="3" fill="'+(v<0?"var(--down)":g.c)+'"/>';
    });
    s+='<text x="'+(pl+slot*i+slot/2)+'" y="'+(H-8)+'" text-anchor="middle" font-size="12" fill="var(--muted)">'+esc(l)+'</text>';
  });
  s+='<line x1="'+pl+'" x2="'+(W-pr)+'" y1="'+Y(0)+'" y2="'+Y(0)+'" stroke="var(--ink)"/>';
  return '<svg class="chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(opt.label)+'">'+s+'</svg>';
}
function rng(seed){ return function(){ seed|=0; seed=seed+0x6D2B79F5|0; var t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function gauss(r){ var u=1-r(), v=r(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); }

/* ---------- home: compound growth calculator ---------- */
function futureValue(monthly, years, rate){
  var r = rate/12, v = 0, out = [];
  for(var m=1;m<=years*12;m++){ v = (v+monthly)*(1+r); if(m%12===0) out.push(v); }
  return out;
}
var calcCur = null;
function setupCalc(){
  var code = curCode(); if(code === calcCur) return; calcCur = code;
  var a = $("c-amt");
  if(code === "INR"){ a.min=100; a.max=10000; a.step=100; a.value=500; } else { a.min=10; a.max=500; a.step=10; a.value=50; }
}
function renderCalc(){
  setupCalc();
  var amt = +$("c-amt").value, age = +$("c-age").value, years = 65-age;
  $("c-amt-v").textContent = cm(amt);
  $("c-age-v").textContent = age;
  var vals = futureValue(amt, years, 0.07);
  var max = futureValue(+$("c-amt").max, 52, 0.07).pop();
  var html = "";
  for(var y=0;y<years;y+=1){
    if(years>30 && y%2===1 && y!==years-1) continue;
    var dep = amt*12*(y+1), val = vals[y];
    html += '<div style="height:'+(val/max*100).toFixed(2)+'%;background:linear-gradient(to top,var(--line) '+(dep/val*100).toFixed(1)+'%,var(--blue) '+(dep/val*100).toFixed(1)+'%)"></div>';
  }
  $("c-bars").innerHTML = html;
  var final = vals[vals.length-1], put = amt*12*years, code = curCode();
  $("c-result").textContent = code==="INR" ? bigMoney(final,"INR") : cm(Math.round(final));
  var later = age+10 <= 64 ? futureValue(amt, years-10, 0.07).pop() : null;
  var f = function(v){ return code==="INR" ? bigMoney(v,"INR") : cm(Math.round(v)); };
  $("c-sub").textContent = "by age 65, from "+f(put)+" of your own money."+(later ? " Waiting ten years to start would leave you with about "+f(later)+"." : "");
}
$("c-amt").addEventListener("input", renderCalc);
$("c-age").addEventListener("input", renderCalc);
RENDER.home = function(){ renderCalc(); };
RELOADERS.push(function(){ calcCur = null; });

/* ===== 30-learn.js ===== */
/* ---------- lessons: two tracks ---------- */
var TRACKS = {
 money: [
 {t:"Where money comes from", body:
  '<p>Money usually comes from three places: <mark>earning</mark> it (a part-time job, chores, selling something you made), <mark>receiving</mark> it (pocket money, birthday money) and <mark>growing</mark> it (interest and investing, which later lessons cover).</p>'+
  '<p>However you get it, it\'s limited. Every time you spend money on one thing, you give up the chance to use it for something else. Economists call the thing you give up the <mark>opportunity cost</mark>.</p>'+
  '<p>Thinking about opportunity cost doesn\'t mean never spending. It means spending on purpose, on the things that matter most to you.</p>',
  key:"Money is limited, so every choice has a cost: the next-best thing you could have had instead.",
  q:{p:"You have ₹500. You want a ₹400 game and a ₹300 T‑shirt. What's the opportunity cost of buying the game?",o:["Nothing, because you wanted the game","The T‑shirt you can't afford now","₹400"],a:1,
     e:"Buying the game uses money you could have spent on the T‑shirt. What you give up is the opportunity cost."},
  tryit:'<p class="try"><button class="btn alt" data-go="money">Log the money you get in My money</button></p>'},
 {t:"Needs and wants", body:
  '<p>A <mark>need</mark> is something you must have to live, stay safe or do what\'s expected of you: food, school supplies, bus fare. A <mark>want</mark> is something nice to have: new headphones, a game skin, a second hoodie.</p>'+
  '<p>The same thing can be both. You need shoes, but choosing a ₹6,000 brand over a ₹1,500 pair that does the same job is a want. The extra ₹4,500 is the want part.</p>'+
  '<p>Wants aren\'t bad. They\'re just the part of your money to plan carefully once your needs are covered.</p>',
  key:"Cover needs first, then choose your wants on purpose.",
  q:{p:"Which of these is a want?",o:["Bus fare to school","A notebook for class","A second pair of trendy trainers"],a:2,
     e:"You can get to school and do your work without a second pair of trainers, so it's a want."},
  tryit:'<p class="try"><button class="btn alt" data-go="money">Tag your spending as needs or wants</button></p>'},
 {t:"Making a budget", body:
  '<p>A <mark>budget</mark> is a plan for your money that you make <em>before</em> you spend it. A simple one for pocket money has three parts: <mark>spend, save and share</mark>.</p>'+
  '<p>For example, from ₹1,000 you might plan ₹700 to spend, ₹200 to save and ₹100 for gifts or giving. Pick percentages that suit you, then compare your plan with what you actually spent. If you keep running out early, change either your habits or your plan.</p>'+
  '<p>The most useful habit is to <mark>pay yourself first</mark>: put your savings aside the moment money arrives, rather than saving whatever happens to be left at the end of the month.</p>',
  key:"Plan first, spend second, and save at the start rather than the end.",
  q:{p:"You get ₹1,000 and want to save 20%. When is the best time to set it aside?",o:["As soon as you get it","At the end of the month, if anything's left","Only when you see something expensive you want"],a:0,
     e:"Saving first means it actually happens. Money left \"for later\" usually gets spent."},
  tryit:'<p class="try"><button class="btn alt" data-go="money">Set a budget and automatic saving</button></p>'},
 {t:"Saving for a goal", body:
  '<p>Saving is easier when you know what you\'re saving for. Make your goal specific: <em>what</em> it is, <em>how much</em> it costs and <em>when</em> you want it.</p>'+
  '<p>Then divide. Headphones that cost ₹2,400 in 12 weeks means saving ₹200 a week. If that\'s too much, push the date back, choose a cheaper option, or find a way to earn a little extra.</p>'+
  '<p>Waiting for something you want is called <mark>delayed gratification</mark>. It\'s hard at first and gets easier with practice, and it\'s exactly the skill investing needs.</p>',
  key:"Goal amount ÷ number of weeks = how much to save each week.",
  q:{p:"You want a ₹3,000 bicycle in 10 weeks. How much do you need to save each week?",o:["₹30","₹300","₹3,000"],a:1,
     e:"₹3,000 ÷ 10 weeks = ₹300 a week."},
  tryit:'<p class="try"><button class="btn alt" data-go="money">Add a goal with a date</button></p>'},
 {t:"Smart spending", body:
  '<p>Shops and apps are designed to make you spend. A few habits help you spend well:</p>'+
  '<p><b>Compare.</b> Check the price of the same thing in a couple of places. For food and toiletries, compare the <mark>price per gram or millilitre</mark>; the bigger pack isn\'t always cheaper.</p>'+
  '<p><b>Wait a day on wants.</b> If you still want it tomorrow, go ahead. Lots of impulse buys don\'t survive the wait. "Only 2 left!" and countdown timers exist to rush you.</p>'+
  '<p><b>Multiply small repeat costs by 12.</b> ₹99 a month for a subscription or game pass is ₹1,188 a year.</p>',
  key:"Compare prices, wait a day before buying wants, and think about yearly cost.",
  q:{p:"A 200 g pack costs ₹50 and a 500 g pack costs ₹140. Which is cheaper per gram?",o:["The 200 g pack","The 500 g pack","They cost the same per gram"],a:0,
     e:"₹50 ÷ 200 g = ₹0.25 per gram. ₹140 ÷ 500 g = ₹0.28 per gram. Here the smaller pack is the better deal."}},
 {t:"Banks and interest", body:
  '<p>A bank keeps your money safe and lets you pay and get paid digitally. In a <mark>savings account</mark>, the bank also pays you <mark>interest</mark>: a small percentage of your balance, in return for using your money while it\'s deposited. A <mark>fixed deposit</mark> usually pays more, but you agree to leave the money there for a set time.</p>'+
  '<p>In India, a parent or guardian can open a savings account for a child of any age. Under RBI rules from 2025, children aged 10 and over can also open and run their own savings account, with limits the bank sets. These accounts can never go below zero.</p>'+
  '<p>Interest also earns interest over time. That\'s compound growth, the same idea that makes investing so powerful.</p>',
  key:"Banks keep money safe and pay a little interest. Investing can grow money faster, but with more risk.",
  q:{p:"Why does a bank pay you interest on your savings?",o:["It's a gift","It's paying to use your money while it's deposited","The government gives everyone free money"],a:1,
     e:"Banks lend deposited money to others and charge them interest. They share part of that with savers."}},
 {t:"Digital money and staying safe", body:
  '<p>UPI, cards and wallets make paying easy, and that makes it easy for scammers too. These rules never change:</p>'+
  '<p><b>Never share your OTP, UPI PIN or card details</b> with anyone, even someone who says they\'re from a bank, an app or the police.</p>'+
  '<p><b>You never need your PIN to receive money.</b> If an app asks for your PIN, money is leaving your account. A "collect request" also asks <em>you</em> to pay, so don\'t approve requests you don\'t recognise. Scanning a QR code is for paying, not receiving.</p>'+
  '<p><b>Get help numbers from the official app or website.</b> Fake customer-care numbers are common in search results. If something feels urgent or too good to be true, stop and ask a trusted adult.</p>'+
  '<p>Some UPI apps let a parent add a child to their own account with spending limits, using a feature called <mark>UPI Circle</mark>.</p>',
  key:"No genuine person or company will ever ask for your OTP or PIN. Entering your PIN always means money is going out.",
  q:{p:"A message says you've won ₹5,000 and asks you to enter your UPI PIN to receive it. What's happening?",o:["You'll receive ₹5,000","It's a scam: entering your PIN sends money out","Entering the PIN just confirms who you are"],a:1,
     e:"You never need a PIN to receive money. This is one of the most common UPI scams."}},
 {t:"Borrowing and debt", body:
  '<p>Borrowing means using someone else\'s money now and paying it back later, usually with extra on top, called <mark>interest</mark>. Borrowing for something important, like education, can make sense. Borrowing for wants is risky, because interest makes them cost more.</p>'+
  '<p>Credit cards are the classic example. If you don\'t pay the full bill on time, Indian card companies often charge around 3–3.75% interest <em>a month</em>, which is roughly 36–45% a year. "Buy now, pay later" offers work in a similar way: easy to start, expensive if you miss payments.</p>'+
  '<p>A simple rule: if you can\'t afford a want without borrowing, save up for it instead.</p>',
  key:"Interest makes borrowed things cost more. Save first and borrow only for things that really matter.",
  q:{p:"Credit card interest of 3.5% a month is roughly how much a year?",o:["3.5%","About 42%","About 10%"],a:1,
     e:"3.5% × 12 months = 42% a year, and interest on unpaid interest pushes it even higher."}}
 ],
 invest: [
 {t:"What is a stock?", body:
  '<p>A company that wants to grow can split its ownership into millions of tiny pieces called <mark>shares</mark> (or stocks) and sell them. If you buy one, you own a very small part of that business.</p>'+
  '<p>Think of a café worth ₹10 lakh split into 1 lakh shares. Each share is worth about ₹10. If the café opens a second branch and becomes worth ₹20 lakh, each share is now worth about ₹20.</p>'+
  '<p>Shares are bought and sold on a <mark>stock exchange</mark>, like India\'s NSE and BSE or the New York Stock Exchange. Some companies also pay shareholders part of their profits, called a <mark>dividend</mark>.</p>',
  key:"Owning a share means owning a piece of a real business. Its value follows how well that business does over time.",
  q:{p:"If you own a share of a company, what do you own?",o:["A loan you gave to the company","A small part of the company","A coupon for the company's products"],a:1,
     e:"A share is part‑ownership. A loan to a company is a bond, which is a different kind of investment."},
  tryit:'<p class="try"><button class="btn alt" data-go="research">Look up a real company</button></p>'},
 {t:"How investing works", body:
  '<p>Investing means putting money into something you expect to grow in value, instead of spending it now. People invest through a <mark>brokerage account</mark>: an app or website that lets you buy and sell shares. In India, under-18s need a parent or guardian to run one for them.</p>'+
  '<p>A share\'s price changes every day because of <mark>supply and demand</mark>. If more people want to buy than sell, the price rises. People want to buy when they expect the company to earn more in the future, so good news tends to push prices up and bad news pushes them down.</p>'+
  '<p>You make money in two ways: the price rises above what you paid (a <mark>capital gain</mark>), or the company pays you dividends. You lose money if you sell for less than you paid.</p>',
  key:"Prices move on expectations about the future, not only on what a company did last year.",
  q:{p:"A company announces a hit new product. What usually happens to its share price?",o:["It tends to rise, because more people want to buy","It must fall, because the company spent money","Nothing, prices only change once a year"],a:0,
     e:"Good news raises expectations of future profits, so more people want to buy the shares, pushing the price up."}},
 {t:"Risk and return", body:
  '<p><mark>Return</mark> is how much you gain or lose, usually shown as a percentage. <mark>Risk</mark> is the chance that you get less than you expected, or lose money.</p>'+
  '<p>The two are linked. A savings account is very safe but pays little. Shares of large, established companies can grow more but can also drop. A brand‑new startup might multiply your money or go to zero. The higher the possible return, the higher the risk you have to accept.</p>'+
  '<p>That\'s why "guaranteed high returns" is a warning sign. If something promises big gains with no risk, it is almost always misleading or a scam.</p>',
  key:"There is no such thing as high return with no risk. Decide how much risk you can live with before chasing returns.",
  q:{p:"Someone online promises 20% returns every month, guaranteed. What's the best response?",o:["Invest a little to test it","Treat it as a likely scam","Invest a lot before it's gone"],a:1,
     e:"Guaranteed high returns don't exist. Pressure to act fast is another classic scam sign."}},
 {t:"Diversification", body:
  '<p><mark>Diversification</mark> means spreading your money across many investments so that one bad result can\'t wipe you out. It\'s the "don\'t put all your eggs in one basket" rule.</p>'+
  '<p>If you put everything into one company and it has a scandal, you could lose half your money overnight. If that company is one of twenty you own, the same scandal barely dents your total. Spreading across <em>industries</em> matters too: owning five car companies isn\'t very diversified, because they all suffer if car sales slump.</p>'+
  '<p>An <mark>index fund</mark> is the easiest way to diversify. It holds many companies at once, such as all 50 in India\'s Nifty 50 or all 500 in America\'s S&amp;P 500, so one purchase gives you a slice of all of them.</p>',
  key:"Diversification lowers the risk of any single company hurting you. It can't remove the risk of the whole market falling.",
  q:{p:"Which portfolio is the most diversified?",o:["Five technology companies","One index fund covering 500 companies","All your money in the company you like best"],a:1,
     e:"An index fund spreads your money across hundreds of companies in many industries."},
  tryit:'<p class="try"><button class="btn alt" data-go="portfolio">Try it in the practice portfolio</button> Buy just one company, skip ahead a year, then start over and spread your money out. Compare.</p>'},
 {t:"Volatility", body:
  '<p><mark>Volatility</mark> describes how much and how quickly a price swings up and down. A low‑volatility share moves gently; a high‑volatility one can jump 15% in a week and fall 20% the next.</p>'+
  '<p>Volatility isn\'t the same as losing money. A bumpy investment can still end up higher after many years. But it\'s harder to live with, and if you might need the money at a bad moment, you could be forced to sell low.</p>'+
  '<p>The two lines below end at about the same place. Which one would be more stressful to own?</p>',
  key:"Volatility is the bumpiness of the ride. The bumpier the ride, the longer you should plan to hold on.",
  q:{p:"A share fell 15% this month. What does that tell you on its own?",o:["The company is failing","It is volatile, but you need more research to judge it","You should sell immediately"],a:1,
     e:"One month's move tells you about volatility, not about the long‑term value of the business."},
  tryit:"VOL"},
 {t:"Compound growth", body:
  '<p><mark>Compound growth</mark> is when your gains start earning gains of their own. Invest ₹1,000 at 7% a year and you have ₹1,070 after year one. In year two you earn 7% on ₹1,070, not just on ₹1,000. Each year the amount that\'s growing gets bigger.</p>'+
  '<p>At first the effect is small. After a few decades it becomes huge, which is why starting early matters more than starting with a lot. A handy shortcut is the <mark>rule of 72</mark>: divide 72 by the yearly return to see roughly how many years it takes to double. At 7%, that\'s about 10 years.</p>',
  key:"Time does the heavy lifting. The earlier you start, the more years compounding has to work.",
  q:{p:"Using the rule of 72, about how long does money take to double at 8% a year?",o:["About 5 years","About 9 years","About 20 years"],a:1,
     e:"72 ÷ 8 = 9, so roughly nine years."},
  tryit:'<p class="try"><button class="btn alt" data-go="home">Play with the growth calculator</button></p>'},
 {t:"Long‑term vs short‑term", body:
  '<p><mark>Short‑term</mark> investing (days to months) tries to profit from quick price moves. It\'s really hard to do well: prices over short periods are close to random, fees and taxes add up, and most people who try it do worse than the market.</p>'+
  '<p><mark>Long‑term</mark> investing (five years or more) means buying good businesses or index funds and holding them while they grow. Over long periods, broad stock markets have historically risen far more often than they\'ve fallen, though there have been painful years along the way.</p>'+
  '<p>A good rule: money you need soon, for a phone, a trip or university fees next year, should not be in the stock market.</p>',
  key:"The longer you can wait, the more the market's ups and downs tend to even out.",
  q:{p:"You need money for a school trip in three months. Where should it go?",o:["A high‑volatility stock","A savings account","A new cryptocurrency"],a:1,
     e:"Money needed soon should be somewhere that won't drop right before you need it."}},
 {t:"Researching a company", body:
  '<p>Before buying a share, investors ask a few simple questions. <b>What does the company do,</b> and could you explain it to a friend? <b>Is it growing?</b> Look at whether its <mark>revenue</mark> (all the money customers paid it) is rising year after year. <b>Is it making a profit?</b> <mark>Profit</mark> is what\'s left after all its costs.</p>'+
  '<p>Then think about <b>risk</b>: how bumpy has its share price been, how big is the company, and what could go wrong for businesses in its industry?</p>'+
  '<p>No single number tells you whether to buy. Research is about understanding a business well enough that you won\'t panic when its price moves.</p>',
  key:"Understand the business, check growth and profit, and know the risks before you put any money in.",
  q:{p:"A company's revenue rose but it made a loss. What does that mean?",o:["Customers paid it more, but its costs were even higher","It's definitely about to close","Its share price must go up"],a:0,
     e:"Revenue is money in; profit is what's left after costs. Fast-growing companies often spend heavily and make losses for a while."},
  tryit:'<p class="try"><button class="btn alt" data-go="research">Research a real company</button></p>'}
 ]
};

function loadLessonState(){
  var s = load("lessons", null);
  if(!s) return {track:"money", cur:{money:0, invest:0}, done:{}};
  if(typeof s.cur === "number"){ // older version: investing lessons only
    var done = {}; Object.keys(s.done||{}).forEach(function(k){ if(s.done[k]) done["invest-"+k] = true; });
    s = {track:"money", cur:{money:0, invest:s.cur}, done:done};
  }
  s.cur = s.cur || {money:0, invest:0}; s.done = s.done || {}; s.track = TRACKS[s.track] ? s.track : "money";
  return s;
}
var lessonState = loadLessonState();
RELOADERS.push(function(){ lessonState = loadLessonState(); });
function setTrack(t){ if(TRACKS[t]){ lessonState.track = t; save("lessons", lessonState); } }

function renderLessonList(){
  var t = lessonState.track, list = TRACKS[t];
  document.querySelectorAll("[data-track-btn]").forEach(function(b){ b.setAttribute("aria-pressed", b.dataset.trackBtn === t); });
  var n = list.filter(function(_,i){ return lessonState.done[t+"-"+i]; }).length;
  $("track-progress").style.width = (n/list.length*100)+"%";
  $("track-progress-label").textContent = n+" of "+list.length+" done";
  $("lesson-list").innerHTML = list.map(function(l,i){
    var d = lessonState.done[t+"-"+i];
    return '<li class="'+(d?"done":"")+'"><button data-lesson="'+i+'" aria-current="'+(i===lessonState.cur[t])+'"><span class="n">'+(d?"✓":(i+1))+'</span>'+esc(l.t)+'</button></li>';
  }).join("");
}
function renderLesson(){
  var t = lessonState.track, list = TRACKS[t], i = Math.min(lessonState.cur[t]||0, list.length-1), l = list[i];
  var extra = "";
  if(l.tryit==="VOL") extra = '<div class="card try">'+volDemo()+'<div class="legend"><span style="--c:var(--up)">Steady share</span><span style="--c:var(--down)">Volatile share</span></div></div>';
  else if(l.tryit) extra = l.tryit;
  var last = i === list.length-1;
  var nextBtn = !last ? '<button class="btn" id="l-next">Next lesson</button>'
    : t === "money" ? '<button class="btn" id="l-track">Start the investing lessons</button>'
    : '<button class="btn" data-go="quiz">Take the quiz</button>';
  $("lesson").innerHTML = '<article><p class="muted">'+(t==="money"?"Money basics":"Investing")+' · lesson '+(i+1)+' of '+list.length+'</p><h2>'+esc(l.t)+'</h2>'+l.body+extra+
   '<div class="key"><b>Key idea.</b> '+esc(l.key)+'</div>'+
   '<div class="check-q"><h3>Quick check</h3><p>'+esc(l.q.p)+'</p><div class="opts">'+
   l.q.o.map(function(o,j){ return '<button class="opt" data-ans="'+j+'">'+esc(o)+'</button>'; }).join("")+
   '</div><p class="feedback" id="lesson-fb" role="status"></p></div>'+
   '<div class="lesson-nav"><button class="btn alt" id="l-prev" '+(i===0?"disabled":"")+'>Previous lesson</button>'+nextBtn+'</div></article>';
  document.querySelectorAll("#lesson .opt").forEach(function(b){
    b.addEventListener("click", function(){
      var j=+b.dataset.ans, ok = j===l.q.a;
      document.querySelectorAll("#lesson .opt").forEach(function(x){ x.classList.remove("right","wrong"); });
      b.classList.add(ok?"right":"wrong");
      $("lesson-fb").innerHTML = (ok?"<b>Right.</b> ":"<b>Not quite.</b> ")+esc(l.q.e);
      if(ok && !lessonState.done[t+"-"+i]){ lessonState.done[t+"-"+i]=true; save("lessons",lessonState); renderLessonList(); }
    });
  });
  var move = function(d){ lessonState.cur[t] = i+d; save("lessons",lessonState); renderLessonList(); renderLesson(); window.scrollTo(0,0); };
  $("l-prev").onclick = function(){ move(-1); };
  if($("l-next")) $("l-next").onclick = function(){ move(1); };
  if($("l-track")) $("l-track").onclick = function(){ setTrack("invest"); renderLessonList(); renderLesson(); window.scrollTo(0,0); };
}
$("lesson-list").addEventListener("click", function(e){
  var b=e.target.closest("[data-lesson]"); if(!b) return;
  lessonState.cur[lessonState.track]=+b.dataset.lesson; save("lessons",lessonState); renderLessonList(); renderLesson();
});
document.querySelectorAll("[data-track-btn]").forEach(function(b){
  b.onclick = function(){ setTrack(b.dataset.trackBtn); renderLessonList(); renderLesson(); };
});
function volDemo(){
  var r = rng(77), a=[100], b=[100];
  for(var i=1;i<36;i++){ a.push(a[i-1]*(1+0.006+0.015*gauss(r))); b.push(b[i-1]*(1+0.006+0.11*gauss(r))); }
  var endA=a[35]; b = b.map(function(v,i){ return v*Math.pow(endA/b[35], i/35); });
  return lineChart([{d:a,c:"var(--up)"},{d:b,c:"var(--down)"}],{h:200,fmt:function(v){return "₹"+v.toFixed(0);},label:"A steady share and a volatile share ending at the same price"});
}
RENDER.learn = function(){ renderLessonList(); renderLesson(); };

/* ===== 40-sim.js ===== */
/* ---------- practice market (made-up companies, simulated prices) ---------- */
var CO = [
 {s:"IDX",n:"Whole Market Index Fund",ind:"Index fund",p0:50,drift:0,beta:1,vol:0,
  bg:"Not a company but a fund that owns small pieces of 500 large companies across every industry. When you buy one share, you own a tiny slice of all of them.",
  rev:null, risks:["Falls when the whole market falls, as in a recession","You won't beat the market, because you are the market","Still volatile over months, even though it's diversified"]},
 {s:"LUMN",n:"Lumen Snacks",ind:"Food and drinks",p0:42,drift:0.004,beta:0.5,vol:0.03,
  bg:"Makes crisps, cereal bars and flavoured water sold in supermarkets in 30 countries. People buy snacks in good times and bad, so sales are steady.",
  rev:[4200,4410,4580,4700], prof:[380,400,410,430], risks:["Slow growth: people only eat so many snacks","Rising ingredient costs squeeze profits","Health trends could hurt sugary products"]},
 {s:"PXFG",n:"Pixelforge Games",ind:"Video games",p0:88,drift:0.007,beta:1.3,vol:0.09,
  bg:"A game studio best known for one hugely popular online shooter. Makes money from game sales and in‑game purchases.",
  rev:[610,980,1450,1320], prof:[40,190,360,210], risks:["Depends heavily on one hit game","A delayed or flopped release can crash sales","Players move on to new games quickly"]},
 {s:"VOLT",n:"Voltway Motors",ind:"Electric cars",p0:34,drift:0.006,beta:1.6,vol:0.14,
  bg:"A young electric car maker growing fast but still spending more than it earns while it builds factories.",
  rev:[180,420,910,1600], prof:[-320,-280,-150,-60], risks:["Not yet profitable","Big competitors are entering the market","Factory delays and recalls","Needs to keep raising money"]},
 {s:"CLDN",n:"CloudNest Software",ind:"Software",p0:120,drift:0.008,beta:1.2,vol:0.07,
  bg:"Sells online storage and collaboration tools to schools and businesses on monthly subscriptions.",
  rev:[1100,1380,1720,2090], prof:[90,160,250,340], risks:["Share price already assumes lots of growth","Strong competition from tech giants","A data breach would damage trust"]},
 {s:"GRID",n:"GreenGrid Energy",ind:"Utilities",p0:28,drift:0.004,beta:0.4,vol:0.025,
  bg:"Runs wind and solar farms and sells electricity to cities under long contracts. Pays a regular dividend.",
  rev:[2300,2380,2460,2540], prof:[310,320,330,345], risks:["Government rules can change prices it may charge","Rising interest rates make its debt costlier","Slow, steady growth only"]},
 {s:"STRD",n:"Stride Athletic",ind:"Clothing",p0:64,drift:0.005,beta:1.0,vol:0.06,
  bg:"Designs trainers and sportswear sold online and in its own stores. Popular with teenagers thanks to athlete partnerships.",
  rev:[3100,3350,3290,3600], prof:[260,300,240,320], risks:["Fashion trends change fast","Sales drop when people have less to spend","Depends on factories overseas"]},
 {s:"MEDC",n:"MediCore Health",ind:"Healthcare",p0:76,drift:0.005,beta:0.6,vol:0.045,
  bg:"Makes common medicines and medical devices used in hospitals. Also researches new treatments.",
  rev:[5200,5350,5600,5750], prof:[720,690,760,790], risks:["New medicines can fail in testing","Patents expire, letting cheaper copies compete","Lawsuits over side effects"]},
 {s:"HRBR",n:"Harbor Bank",ind:"Banking",p0:46,drift:0.005,beta:1.1,vol:0.055,
  bg:"A regional bank offering savings accounts, loans and mortgages to families and small businesses.",
  rev:[2700,2820,3050,3120], prof:[540,560,640,610], risks:["Loses money if many borrowers can't repay","Hit hard in recessions","Heavily regulated"]}
];
var BY = {}; CO.forEach(function(c){ BY[c.s]=c; });
var NEWS = {
 LUMN:[["Lumen Snacks launches a best‑selling protein bar",1],["Wheat prices spike, squeezing Lumen Snacks' profits",-1]],
 PXFG:[["Pixelforge's new game breaks launch‑day sales records",1],["Pixelforge delays its next big game by a year",-1]],
 VOLT:[["Voltway lands a huge order for delivery vans",1],["Voltway recalls 20,000 cars over a battery fault",-1]],
 CLDN:[["CloudNest signs a deal with a national school system",1],["CloudNest suffers a major outage and a data leak",-1]],
 GRID:[["GreenGrid wins a long contract to power a new city district",1],["Storm damage takes GreenGrid wind farms offline",-1]],
 STRD:[["Stride Athletic's new trainer goes viral",1],["Stride Athletic warns sales are slowing",-1]],
 MEDC:[["MediCore's new treatment is approved by regulators",1],["MediCore medicine fails a major trial",-1]],
 HRBR:[["Harbor Bank reports record profits",1],["Harbor Bank sets aside money for unpaid loans",-1]]
};
var MARKET_NEWS = [["Worries about a recession spread; most shares fall",-1],["Strong jobs report lifts the whole market",1],["Interest rates cut; investors cheer",1],["Global trade tensions rattle markets",-1]];
var HIST = 24;
var prices = {}, events = [];
CO.forEach(function(c){ prices[c.s]=[c.p0]; });
function simMonth(t){
  var r = rng(9000+t*31), mkt = 0.006+0.04*gauss(r), ev = [];
  if(r()<0.08){ var mnw = MARKET_NEWS[Math.floor(r()*MARKET_NEWS.length)]; mkt += mnw[1]*(0.04+r()*0.05); ev.push({h:mnw[0],s:mnw[1]}); }
  var shock = {};
  if(r()<0.45){
    var pool = CO.slice(1), c = pool[Math.floor(r()*pool.length)], item = NEWS[c.s][Math.floor(r()*2)];
    shock[c.s] = item[1]*(0.07+r()*0.14)*(c.vol/0.07+0.4)/1.4;
    ev.push({h:item[0],s:item[1],sym:c.s});
  }
  CO.forEach(function(c){
    var ret = c.s==="IDX" ? mkt : c.drift + c.beta*(mkt-0.006) + c.vol*gauss(r) + (shock[c.s]||0);
    ret = Math.max(ret,-0.6);
    var a = prices[c.s]; a[t] = Math.max(0.5, a[t-1]*(1+ret));
  });
  events[t]=ev;
}
function ensure(t){ var have = prices.IDX.length; for(var i=have;i<=t;i++) simMonth(i); }
function price(s,t){ ensure(t); return prices[s][t]; }
ensure(HIST);
function volLabel(s,t){
  ensure(t); var a=prices[s], rs=[];
  for(var i=Math.max(1,t-11);i<=t;i++) rs.push(a[i]/a[i-1]-1);
  var m=rs.reduce(function(x,y){return x+y;},0)/rs.length;
  var sd=Math.sqrt(rs.reduce(function(x,y){return x+(y-m)*(y-m);},0)/rs.length)*Math.sqrt(12);
  return {sd:sd, label: sd<0.15?"Low":sd<0.3?"Medium":"High"};
}

/* ---------- practice portfolio ---------- */
var START_CASH = 10000;
function fresh(){ return {cash:START_CASH, h:{}, cost:{}, t:HIST, start:HIST, hist:[START_CASH], bench:[START_CASH]}; }
function loadPf(){ var p = load("pf", null) || fresh(); if(!p.cost) p.cost = {}; return p; }
var pf = loadPf();
RELOADERS.push(function(){ pf = loadPf(); });
function pfValue(t){ var v=pf.cash; for(var s in pf.h) v+=pf.h[s]*price(s,t); return v; }
function savePf(){ save("pf",pf); }

function renderPortfolio(){
  ensure(pf.t);
  var val = pfValue(pf.t), gain = val/START_CASH-1, months = pf.t-pf.start;
  $("pf-stats").innerHTML = stat(money(val),"Total value") +
    stat('<span class="'+cls(gain)+'">'+pct(gain)+'</span>',"Change since you started") +
    stat(money(pf.cash),"Cash not invested") +
    stat(months===0?"Start":(months>=12? Math.floor(months/12)+"y "+(months%12)+"m" : months+" months"),"Time passed");
  var labels=[{i:0,t:"Start"}]; if(pf.hist.length>1) labels.push({i:pf.hist.length-1,t:"Now"});
  $("pf-chart").innerHTML = pf.hist.length<2
    ? '<p class="muted" style="padding:40px 0;text-align:center">Buy something, then skip ahead a month to start your chart.</p>'
    : lineChart([{d:pf.bench,c:"var(--muted)",w:2,dash:true},{d:pf.hist,c:"var(--blue)",w:3}],{fmt:function(v){return "$"+(v/1000).toFixed(1)+"k";},xlabels:labels,label:"Portfolio value compared with the index fund"});
  var rows = Object.keys(pf.h).filter(function(s){return pf.h[s]>1e-9;});
  if(!rows.length){ $("pf-holdings").innerHTML='<p class="muted">You don\'t own anything yet. Pick a company in "Buy or sell" to make your first purchase.</p>'; }
  else{
    $("pf-holdings").innerHTML='<table><thead><tr><th>Company</th><th class="num">Shares</th><th class="num">Value</th><th class="num">Share of total</th><th class="num">Gain or loss</th></tr></thead><tbody>'+
     rows.map(function(s){
       var v=pf.h[s]*price(s,pf.t), cost=pf.cost[s]||v, g=v-cost;
       return '<tr><td><b>'+s+'</b> <span class="muted">'+esc(BY[s].n)+'</span></td><td class="num">'+pf.h[s].toFixed(3)+'</td><td class="num">'+money(v)+'</td><td class="num">'+(v/val*100).toFixed(0)+'%</td><td class="num '+cls(g)+'">'+money(g)+' ('+pct(g/cost)+')</td></tr>';
     }).join("")+'</tbody></table>';
  }
  var inds={}, biggest=0;
  rows.forEach(function(s){ var v=pf.h[s]*price(s,pf.t); inds[BY[s].ind]=1; biggest=Math.max(biggest,v/val); });
  var hasIdx = rows.indexOf("IDX")>=0 && pf.h.IDX*price("IDX",pf.t)/val>0.3;
  var nInd = Object.keys(inds).length;
  var score = rows.length===0?0: hasIdx? Math.min(100, 70+ (1-biggest)*30) : Math.min(100, nInd*14 + (1-biggest)*30);
  var col = score<40?"var(--down)":score<70?"var(--hl)":"var(--up)";
  var tip;
  if(!rows.length) tip="Once you buy something, this shows how spread out your money is.";
  else if(hasIdx) tip="Your index fund already holds hundreds of companies, so you're well spread out.";
  else if(biggest>0.5) tip="More than half your money is in one company. If it has a bad month, your whole portfolio will feel it.";
  else if(nInd<3) tip="You're in only "+nInd+" industr"+(nInd===1?"y":"ies")+". Adding different industries lowers your risk.";
  else tip="Nicely spread across "+nInd+" industries. No single company can hurt you too much.";
  if(pf.cash/val>0.5 && rows.length) tip+=" Also, "+Math.round(pf.cash/val*100)+"% of your money is sitting in cash, which doesn't grow.";
  $("pf-div").innerHTML='<div class="meter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+Math.round(score)+'" aria-label="Diversification score"><div style="width:'+score+'%;background:'+col+'"></div></div>'+
    '<p style="margin:0" class="muted">'+nInd+' industr'+(nInd===1?'y':'ies')+' · largest position '+(biggest*100).toFixed(0)+'%</p><p style="margin:8px 0 0">'+esc(tip)+'</p>';
  var ev = months>0 ? (events[pf.t]||[]) : [];
  var idxMove = months>0 ? price("IDX",pf.t)/price("IDX",pf.t-1)-1 : 0;
  $("pf-news").innerHTML = months===0 ? '<li class="muted">News appears each time you skip ahead.</li>' :
    (ev.length? ev.map(function(e){ var mv = e.sym ? (price(e.sym,pf.t)/price(e.sym,pf.t-1)-1) : idxMove;
      return '<li><b>'+esc(e.h)+'</b><br><span class="'+cls(mv)+'">'+(e.sym?e.sym:"Whole market")+' '+pct(mv)+' this month</span></li>'; }).join("")
     : '<li>A quiet month with no big headlines. The index fund moved <span class="'+cls(idxMove)+'">'+pct(idxMove)+'</span>.</li>');
  var sel=$("t-sym"), cur=sel.value;
  sel.innerHTML = CO.map(function(c){ return '<option value="'+c.s+'">'+c.s+' · '+esc(c.n)+'</option>'; }).join("");
  if(cur) sel.value=cur;
  tradeInfo();
}
function tradeInfo(){
  var s=$("t-sym").value, p=price(s,pf.t), own=(pf.h[s]||0)*p;
  $("t-info").textContent = "Price "+money(p,2)+" per share · "+BY[s].ind+(own>0.005?" · you own "+money(own):"");
}
$("t-sym").addEventListener("change", tradeInfo);
function trade(buy, all){
  var s=$("t-sym").value, p=price(s,pf.t), amt=+$("t-amt").value, msg=$("t-msg");
  if(all){ amt=(pf.h[s]||0)*p; buy=false; }
  if(!(amt>0)){ msg.textContent="Enter an amount above $0."; return; }
  if(buy){
    if(amt>pf.cash+0.005){ msg.textContent="You only have "+money(pf.cash,2)+" in cash. Lower the amount or sell something first."; return; }
    amt=Math.min(amt,pf.cash);
    pf.h[s]=(pf.h[s]||0)+amt/p; pf.cost[s]=(pf.cost[s]||0)+amt; pf.cash-=amt;
    msg.textContent="Bought "+money(amt,2)+" of "+s+".";
  } else {
    var own=(pf.h[s]||0)*p;
    if(own<0.005){ msg.textContent="You don't own any "+s+" to sell."; return; }
    if(amt>own+0.005){ msg.textContent="You only own "+money(own,2)+" of "+s+"."; return; }
    var frac=Math.min(1,amt/own);
    pf.cost[s]=(pf.cost[s]||0)*(1-frac); pf.h[s]*=(1-frac); pf.cash+=Math.min(amt,own);
    if(frac>=0.9999){ delete pf.h[s]; delete pf.cost[s]; }
    msg.textContent="Sold "+money(Math.min(amt,own),2)+" of "+s+".";
  }
  pf.hist[pf.hist.length-1]=pfValue(pf.t);
  savePf(); renderPortfolio();
}
$("t-buy").onclick=function(){ trade(true); };
$("t-sell").onclick=function(){ trade(false); };
$("t-sellall").onclick=function(){ trade(false,true); };
function advance(n){
  for(var i=0;i<n;i++){
    pf.t++; ensure(pf.t);
    pf.hist.push(pfValue(pf.t));
    pf.bench.push(START_CASH*price("IDX",pf.t)/price("IDX",pf.start));
  }
  savePf(); renderPortfolio();
  $("t-msg").textContent="";
}
$("pf-next").onclick=function(){ advance(1); };
$("pf-year").onclick=function(){ advance(12); };
$("pf-reset").onclick=function(){
  if(!confirm("Start over with a fresh $10,000? Your current portfolio will be cleared.")) return;
  var keepT = pf.t; pf=fresh(); pf.t = pf.start = keepT;
  savePf(); renderPortfolio(); $("t-msg").textContent="Fresh start: $10,000 in cash.";
};
RENDER.portfolio = renderPortfolio;

/* ===== 50-research.js ===== */
/* ---------- research: real companies ---------- */
var IDX = null, IDX_LOADING = null, SEARCH = null;
var rsMarket = "", rsSector = "", rsShown = 25;
var SIZE_INFO = {
  mega:{label:"Mega company", range:"worth over $200 billion"}, large:{label:"Large company", range:"worth $10–200 billion"},
  mid:{label:"Mid-size company", range:"worth $2–10 billion"}, small:{label:"Small company", range:"worth $300 million–2 billion"},
  micro:{label:"Micro company", range:"worth $50–300 million"}, nano:{label:"Very small company", range:"worth under $50 million"}, "":{label:"Size unknown", range:""}
};
var SECTOR_RISKS = {
  "Information Technology":["Technology changes fast, so today's leaders can be overtaken","Big rivals compete hard on price and talent","Many depend on a few large customers or on chip supply chains"],
  "Communication Services":["Depends on advertising, which drops when the economy slows","Users can switch to new apps quickly","Governments are tightening rules on data and online content"],
  "Consumer Discretionary":["People cut back on these purchases when money is tight","Trends and tastes change quickly","Strong competition squeezes prices"],
  "Consumer Staples":["Slow growth, since people only buy so much of everyday goods","Rising costs for ingredients and packaging squeeze profits","Shoppers may switch to cheaper store brands"],
  "Health Care":["New medicines and devices can fail in testing","Governments control many prices and approvals","Lawsuits and safety recalls"],
  "Financials":["Loses money if borrowers can't repay loans","Hit hard in recessions and by interest-rate changes","Heavily regulated"],
  "Industrials":["Sales rise and fall with the economy","Big projects can run late or over budget","Exposed to costs of fuel, metals and parts"],
  "Energy":["Profits swing with oil and gas prices","The world is shifting to cleaner energy","Accidents and environmental rules"],
  "Utilities":["Governments often set the prices they can charge","Large debts become costlier when interest rates rise","Usually slow, steady growth only"],
  "Materials":["Prices for metals and chemicals swing a lot","Sales rise and fall with building and manufacturing","Environmental rules and costs"],
  "Real Estate":["Sensitive to interest rates","Property values and rents can fall in downturns","Often carry a lot of debt"]
};
var ALIASES = {"spacex":["SPCX"],"starlink":["SPCX"],"google":["GOOGL"],"youtube":["GOOGL"],"facebook":["META"],"instagram":["META"],"whatsapp":["META"],
  "zomato":["ETERNAL.NS"],"blinkit":["ETERNAL.NS"],"tata motors":["TMPV.NS","TMCV.NS"],"airtel":["BHARTIARTL.NS"],"sbi":["SBIN.NS"],"state bank":["SBIN.NS"],
  "hul":["HINDUNILVR.NS"],"dmart":["DMART.NS"],"lic":["LICI.NS"],"tanishq":["TITAN.NS"],"flipkart":["WMT"],"myntra":["WMT"],"xbox":["MSFT"],"playstation":["SONY"],
  "coca cola":["KO"],"coke":["KO"],"pepsi":["PEP"],"jio":["RELIANCE.NS"],"l&t":["LT.NS"],"mahindra":["M&M.NS"],"chatgpt":[],"tiktok":[]};
var ALIAS_NOTES = {"youtube":"YouTube is owned by Alphabet (Google).","instagram":"Instagram is owned by Meta.","whatsapp":"WhatsApp is owned by Meta.","facebook":"Facebook is owned by Meta.",
  "blinkit":"Blinkit is owned by Eternal (formerly Zomato).","zomato":"Zomato's parent company renamed itself Eternal in 2025.","flipkart":"Flipkart is majority-owned by Walmart.","myntra":"Myntra is part of Flipkart, which is majority-owned by Walmart.",
  "xbox":"Xbox is made by Microsoft.","playstation":"PlayStation is made by Sony.","jio":"Jio isn't listed on its own; it's part of Reliance Industries.","starlink":"Starlink is part of SpaceX.","tata motors":"Tata Motors split into two listed companies in 2025: passenger vehicles and commercial vehicles.",
  "chatgpt":"ChatGPT is made by OpenAI, which isn't listed on a stock exchange.","tiktok":"TikTok is owned by ByteDance, which isn't listed on a stock exchange."};

function loadIndex(){
  if(IDX) return Promise.resolve(IDX);
  if(!IDX_LOADING) IDX_LOADING = fetch("data/index.json").then(function(r){ return r.json(); }).then(function(d){
    IDX = d; IDX.by = {};
    SEARCH = d.rows.map(function(r){ IDX.by[r[0]] = r; return {r:r, s:r[1].toLowerCase(), y:r[0].toLowerCase(), n:r[2].toLowerCase()}; });
    var sel = $("rs-sector");
    sel.innerHTML = '<option value="">All sectors</option>' + d.sectors.map(function(s,i){ return s && s!=="Other" ? '<option value="'+i+'">'+esc(s)+'</option>' : ""; }).join("");
    return IDX;
  }).catch(function(e){ IDX_LOADING = null; throw e; });
  return IDX_LOADING;
}
var CRC = (function(){ var t=[]; for(var n=0;n<256;n++){ var c=n; for(var k=0;k<8;k++) c = c&1 ? 0xEDB88320^(c>>>1) : c>>>1; t[n]=c>>>0; } return t; })();
function crc32(s){ var b = new TextEncoder().encode(s), c = 0xFFFFFFFF; for(var i=0;i<b.length;i++) c = CRC[(c^b[i])&255]^(c>>>8); return (c^0xFFFFFFFF)>>>0; }
var descCache = {};
function loadDesc(sym){
  var shard = ("0"+(crc32(sym)%64)).slice(-2);
  if(!descCache[shard]) descCache[shard] = fetch("data/desc/"+shard+".json").then(function(r){ return r.json(); }).catch(function(){ delete descCache[shard]; return {}; });
  return descCache[shard].then(function(d){ return d[sym] || null; });
}

function searchCompanies(q){
  q = q.trim().toLowerCase();
  var out = [], seen = {};
  if(!q) return out;
  var alias = ALIASES[q];
  if(alias) alias.forEach(function(y){ var r = IDX.by[y]; if(r && !seen[y]){ seen[y]=1; out.push({r:r, score:-1}); } });
  for(var i=0;i<SEARCH.length;i++){
    var e = SEARCH[i], r = e.r, sc;
    if(rsMarket && r[3] !== rsMarket) continue;
    if(rsSector !== "" && r[5] !== +rsSector) continue;
    if(e.s === q || e.y === q) sc = 0;
    else if(e.s.indexOf(q) === 0) sc = 1;
    else if(e.n.indexOf(q) === 0) sc = 2;
    else if(e.n.indexOf(" "+q) >= 0) sc = 3;
    else if(q.length >= 3 && e.n.indexOf(q) >= 0) sc = 4;
    else continue;
    if(!seen[r[0]]){ seen[r[0]] = 1; out.push({r:r, score:sc, i:i}); }
  }
  out.sort(function(a,b){ return a.score-b.score || (a.i||0)-(b.i||0); });
  return out.map(function(x){ return x.r; });
}
function resultRow(r){
  var size = IDX.sizes[r[7]] || "";
  return '<button class="result" data-co="'+esc(r[0])+'"><span class="tk">'+esc(r[1])+'</span><span class="nm"><b>'+esc(r[2])+'</b><small>'+esc(IDX.sectors[r[5]]||"")+(size?' · '+esc(SIZE_INFO[size].label):'')+'</small></span><span class="flag">'+(r[3]==="IN"?"India · ":"US · ")+esc(r[4])+'</span></button>';
}
function chipsFor(list){
  return list.map(function(y){ var r = IDX.by[y]; return r ? '<button class="chip" data-co="'+esc(y)+'">'+esc(r[2].replace(/ (Inc\.|Corporation|Limited|Ltd\.|Corp\.|Company|Platforms|Holdings).*$/,""))+'</button>' : ""; }).join("");
}
function renderSearch(){
  var body = $("rs-body");
  if(!IDX){ body.innerHTML = '<p class="loading">Loading 8,800+ companies…</p>'; loadIndex().then(renderSearch).catch(function(){ body.innerHTML = '<p class="empty">The company list couldn\'t load. Check your connection and try again.</p>'; }); return; }
  var q = $("rs-q").value;
  if(!q.trim()){
    var wl = load("watchlist", []);
    body.innerHTML =
      (wl.length ? '<h3>Your watchlist</h3><div class="quick">'+chipsFor(wl)+'</div>' : '')+
      '<h3>Popular in the US</h3><div class="quick">'+chipsFor(IDX.popular.US)+'</div>'+
      '<h3>Popular in India</h3><div class="quick">'+chipsFor(IDX.popular.IN)+'</div>'+
      '<div class="card" style="margin-top:22px;max-width:860px"><h3>Practice market</h3><p class="muted">The made-up companies from the practice portfolio, with simple numbers to learn from.</p><div class="practice-list">'+
      CO.map(function(c){ return '<button data-practice="'+c.s+'"><b>'+esc(c.n)+'</b><small>'+esc(c.ind)+'</small></button>'; }).join("")+'</div></div>'+
      '<p class="note">Company list: every stock on the NYSE, Nasdaq and NYSE American (from Nasdaq\'s stock screener, '+esc(fmtIsoDate(IDX.asof))+') and on India\'s NSE, with descriptions from the open-source FinanceDatabase. Being listed here or under "popular" isn\'t a recommendation.</p>';
    return;
  }
  var res = searchCompanies(q), qq = q.trim().toLowerCase(), note = ALIAS_NOTES[qq];
  var html = note ? '<p class="tip" style="max-width:860px;margin:0 0 12px">'+esc(note)+'</p>' : "";
  if(!res.length){
    html += '<div class="empty"><p><b>No listed company matches "'+esc(q.trim())+'".</b></p><p>Check the spelling, try the company\'s official name, or remove the filters. Some well-known companies are <b>private</b>: their shares aren\'t sold on a stock exchange, so you can\'t buy them and they don\'t appear here.</p></div>';
  } else {
    html += '<p class="muted small">'+res.length.toLocaleString()+' match'+(res.length===1?'':'es')+'</p><div class="results">'+res.slice(0, rsShown).map(resultRow).join("")+'</div>'+
      (res.length > rsShown ? '<p><button class="btn alt" id="rs-more">Show more</button></p>' : '');
  }
  body.innerHTML = html;
  if($("rs-more")) $("rs-more").onclick = function(){ rsShown += 25; renderSearch(); };
}
function fmtIsoDate(s){ var p = String(s).split("-"); return new Date(+p[0], +p[1]-1, +p[2]).toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"}); }
var rsTimer = null;
$("rs-q").addEventListener("input", function(){ rsShown = 25; clearTimeout(rsTimer); rsTimer = setTimeout(renderSearch, 120); });
$("rs-q").addEventListener("keydown", function(e){ if(e.key === "Enter"){ var first = document.querySelector("#rs-body .result"); if(first) first.click(); } });
document.querySelectorAll("[data-mkt]").forEach(function(b){ b.onclick = function(){
  rsMarket = b.dataset.mkt; document.querySelectorAll("[data-mkt]").forEach(function(x){ x.setAttribute("aria-pressed", x===b); }); rsShown = 25; renderSearch(); }; });
$("rs-sector").onchange = function(){ rsSector = this.value; rsShown = 25; renderSearch(); };
$("page-research").addEventListener("click", function(e){
  var c = e.target.closest("[data-co]"); if(c){ go("research", c.dataset.co); return; }
  var p = e.target.closest("[data-practice]"); if(p){ go("research", "practice-"+p.dataset.practice); }
});

/* ---------- one real company ---------- */
function weeklyStats(points){
  var c = points.map(function(p){ return p[1]; }), n = c.length, last = c[n-1];
  var yearAgo = n > 52 ? c[n-53] : null, rets = [];
  for(var i=1;i<n;i++) rets.push(Math.log(c[i]/c[i-1]));
  var m = rets.reduce(function(a,b){ return a+b; },0)/rets.length;
  var sd = Math.sqrt(rets.reduce(function(a,b){ return a+(b-m)*(b-m); },0)/rets.length)*Math.sqrt(52);
  var peak = c[0], dd = 0; c.forEach(function(v){ peak = Math.max(peak, v); dd = Math.min(dd, v/peak-1); });
  return { last:last, y1: yearAgo ? last/yearAgo-1 : null, all: last/c[0]-1, years: (points[n-1][0]-points[0][0])/31557600, vol: sd,
    volBand: sd < 0.25 ? "Low" : sd < 0.45 ? "Medium" : "High", drawdown: dd };
}
function priceFmt(cur){ var sym = cur==="INR"?"₹":cur==="USD"?"$":cur==="GBP"?"£":cur==="EUR"?"€":(cur?cur+" ":""); return function(v){ return sym + (v>=1000 ? Math.round(v).toLocaleString(cur==="INR"?"en-IN":"en-US") : v.toFixed(v>=100?0:2)); }; }
function renderCompany(sym){
  var host = $("rs-detail");
  if(!IDX){ host.innerHTML = '<p class="loading">Loading…</p>'; loadIndex().then(function(){ if(currentArg===sym) renderCompany(sym); }); return; }
  var r = IDX.by[sym];
  if(!r){ host.innerHTML = '<div class="crumbs"><button data-go="research">← Back to search</button></div><p class="empty">We couldn\'t find that company.</p>'; return; }
  var sector = IDX.sectors[r[5]] || "", industry = IDX.industries[r[6]] || "", size = IDX.sizes[r[7]] || "", wl = load("watchlist", []), inWl = wl.indexOf(sym) >= 0;
  var adr = /\(ADR\)/.test(r[2]);
  host.innerHTML =
    '<div class="crumbs"><button data-go="research">← Back to search</button></div>'+
    '<div class="co-head"><div><h2 style="margin-bottom:4px">'+esc(r[2])+'</h2><p class="muted" style="margin:0">'+esc(r[1])+' · '+esc(r[4])+(r[3]==="IN"?" (India)":" (US)")+(r[8]?' · <span class="pill">S&amp;P 500</span>':'')+'</p></div>'+
    '<button class="star" id="co-star" aria-pressed="'+inWl+'">'+(inWl?"★ On your watchlist":"☆ Add to watchlist")+'</button></div>'+
    '<div class="facts"><div><b>'+esc(sector||"–")+'</b><span>Sector</span></div><div><b>'+esc(industry||"–")+'</b><span>Industry</span></div>'+
    '<div><b>'+esc(SIZE_INFO[size].label)+'</b><span>'+esc(SIZE_INFO[size].range ? SIZE_INFO[size].range+" (in US dollars)" : "Not enough data")+'</span></div>'+
    (r[9] ? '<div><b>'+esc(r[9])+'</b><span>Listed on the stock market since</span></div>' : '')+'</div>'+
    '<div class="card" id="co-about"><h3>What the company does</h3><p class="loading" style="text-align:left;padding:0">Loading…</p></div>'+
    '<div class="co-grid"><div class="stack"><div class="card" id="co-price"><h3>Share price</h3><p class="loading">Loading…</p></div><div class="card" id="co-fin"><h3>Revenue and profit</h3><p class="loading">Loading…</p></div></div>'+
    '<div class="stack"><div class="card" id="co-notes"><h3>What to notice</h3><ul class="risks" id="co-notes-list"></ul></div>'+
    '<div class="card"><h3>Common risks in this sector</h3><ul class="risks">'+(SECTOR_RISKS[sector]||["Every business faces competition, changing customer tastes and economic slowdowns"]).map(function(x){ return "<li>"+esc(x)+"</li>"; }).join("")+'</ul></div>'+
    '<div class="tip" style="margin:0"><b>Questions to ask.</b> Could you explain what this company does to a friend? Is its revenue growing? Is it making a profit? Would you be OK if the share price fell 30% next year?</div></div></div>'+
    '<p class="note">Prices and financial figures come from Yahoo Finance and are delayed at least 30 days. Descriptions come from FinanceDatabase and may be out of date: check the company\'s own annual report. This is for learning, not a recommendation.</p>';
  $("co-star").onclick = function(){
    var w = load("watchlist", []), i = w.indexOf(sym);
    if(i >= 0) w.splice(i,1); else w.unshift(sym);
    save("watchlist", w.slice(0,50));
    this.setAttribute("aria-pressed", i < 0); this.textContent = i < 0 ? "★ On your watchlist" : "☆ Add to watchlist";
  };
  var notes = [];
  if(size === "mega" || size === "large") notes.push("It's one of the larger companies on the market. Big companies tend to be steadier, but can grow more slowly.");
  if(size === "small" || size === "micro" || size === "nano") notes.push("It's a small company. Small companies can grow fast, but their share prices often swing a lot and some fail.");
  if(r[3] === "IN") notes.push("It's listed on India's National Stock Exchange, so its share price is in rupees.");
  if(adr) notes.push("This is a US listing of a company based in another country (called an ADR).");
  if(r[8]) notes.push("It's in the S&P 500, an index of 500 large US companies, so many index funds own it.");
  var addNotes = function(more){ notes = notes.concat(more); $("co-notes-list").innerHTML = notes.map(function(n){ return "<li>"+esc(n)+"</li>"; }).join("") || "<li>No extra notes yet.</li>"; };
  addNotes([]);

  loadDesc(sym).then(function(d){
    if(currentArg !== sym) return;
    var where = d && d.c ? '<p class="muted small" style="margin:0">Based in '+esc(d.c)+'</p>' : "";
    var site = d && d.w && /^https?:\/\//.test(d.w) ? ' <a href="'+esc(d.w)+'" target="_blank" rel="noopener noreferrer">Company website</a>' : "";
    $("co-about").innerHTML = '<h3>What the company does</h3>'+(d && d.d ? '<p>'+esc(d.d)+'</p>' : '<p class="muted">We don\'t have a description for this company yet.</p>')+where+(site?'<p style="margin:6px 0 0">'+site+'</p>':'');
  });
  if(API.ok) api("POST","/api/track/company",{symbol:sym}).catch(function(){});
  if(!API.ok){
    var off = '<p class="muted">Price charts and financial figures load on the live Pocket Money site.</p>';
    $("co-price").innerHTML = '<h3>Share price</h3>'+off; $("co-fin").innerHTML = '<h3>Revenue and profit</h3>'+off; return;
  }
  fetch("/api/stock/"+encodeURIComponent(sym)+"/prices").then(function(x){ return x.json(); }).then(function(p){
    if(currentArg !== sym) return;
    if(!p.ok){ $("co-price").innerHTML = '<h3>Share price</h3><p class="muted">Price history isn\'t available for this company right now.</p>'; return; }
    var st = weeklyStats(p.points), f = priceFmt(p.currency), pts = p.points;
    var yrLabel = function(t){ return new Date(t*1000).toLocaleDateString("en-GB",{month:"short",year:"numeric"}); };
    $("co-price").innerHTML = '<h3>Share price</h3>'+
      lineChart([{d:pts.map(function(x){return x[1];}),c:"var(--blue)"}],{h:220,fmt:f,xlabels:[{i:0,t:yrLabel(pts[0][0])},{i:pts.length-1,t:yrLabel(pts[pts.length-1][0])}],label:"Share price over "+Math.round(st.years)+" years"})+
      '<div class="facts"><div><b>'+esc(f(st.last))+'</b><span>Price on '+esc(fmtIsoDate(p.asOf))+'</span></div>'+
      (st.y1!=null?'<div><b class="'+cls(st.y1)+'">'+pct(st.y1)+'</b><span>Change over 1 year</span></div>':'')+
      '<div><b class="'+cls(st.all)+'">'+pct(st.all,0)+'</b><span>Change over '+Math.max(1,Math.round(st.years))+' years</span></div>'+
      '<div><b><span class="pill '+(st.volBand==="Low"?"low":st.volBand==="High"?"high":"")+'">'+st.volBand+'</span></b><span>Volatility ('+(st.vol*100).toFixed(0)+'% yearly swing)</span></div>'+
      '<div><b class="down">'+pct(st.drawdown,0)+'</b><span>Biggest fall from a high</span></div></div>'+
      '<p class="muted small" style="margin:0">Delayed '+p.lagDays+' days. Adjusted for dividends and share splits.</p>';
    var more = [];
    if(st.volBand === "High") more.push("Its share price has been very bumpy: a yearly swing of about "+(st.vol*100).toFixed(0)+"%. Expect big ups and downs.");
    if(st.volBand === "Low") more.push("Its share price has been fairly steady compared with most companies.");
    if(st.drawdown < -0.5) more.push("At one point its shares fell "+Math.round(-st.drawdown*100)+"% from a high. Could you have held on through that?");
    addNotes(more);
  }).catch(function(){ $("co-price").innerHTML = '<h3>Share price</h3><p class="muted">Price history couldn\'t load. Try again later.</p>'; });
  fetch("/api/stock/"+encodeURIComponent(sym)+"/financials").then(function(x){ return x.json(); }).then(function(fd){
    if(currentArg !== sym) return;
    if(!fd.ok){ $("co-fin").innerHTML = '<h3>Revenue and profit</h3><p class="muted">Yearly figures aren\'t available for this company. You can find them in its annual report.</p>'; return; }
    var ys = fd.years, cur = fd.currency || (r[3]==="IN"?"INR":"USD"), lab = ys.map(function(y){ var d = new Date(y.periodEnd+"T00:00:00"); return d.toLocaleDateString("en-GB",{month:"short"})+" "+d.getFullYear(); });
    var last = ys[ys.length-1], prev = ys.length>1 ? ys[ys.length-2] : null;
    var growth = prev && prev.revenue && last.revenue ? last.revenue/prev.revenue-1 : null, margin = last.revenue && last.netIncome!=null ? last.netIncome/last.revenue : null;
    $("co-fin").innerHTML = '<h3>Revenue and profit</h3><p class="muted small"><mark>Revenue</mark> is all the money customers paid. <mark>Profit</mark> is what\'s left after every cost. Shown for each financial year.</p>'+
      barChart(lab,[{d:ys.map(function(y){return y.revenue;}),c:"var(--blue)"},{d:ys.map(function(y){return y.netIncome;}),c:"var(--up)"}],{fmt:function(v){ return bigMoney(v,cur); },label:"Revenue and profit by year",pl:70})+
      '<div class="legend"><span style="--c:var(--blue)">Revenue</span><span style="--c:var(--up)">Profit</span><span style="--c:var(--down)">Loss</span></div>'+
      '<div class="facts">'+(last.revenue!=null?'<div><b>'+esc(bigMoney(last.revenue,cur))+'</b><span>Revenue, latest year</span></div>':'')+
      (growth!=null?'<div><b class="'+cls(growth)+'">'+pct(growth)+'</b><span>Revenue growth</span></div>':'')+
      (margin!=null?'<div><b class="'+cls(margin)+'">'+pct(margin)+'</b><span>Profit margin (profit ÷ revenue)</span></div>':'')+'</div>';
    var more = [];
    if(last.netIncome != null && last.netIncome < 0) more.push("It lost money in its latest year. Young, fast-growing companies often do, but it's a risk if losses continue.");
    else if(margin != null && margin > 0.2) more.push("It keeps more than a fifth of its sales as profit, which is a high profit margin.");
    if(growth != null && growth > 0.15) more.push("Its revenue grew "+Math.round(growth*100)+"% in a year, which is fast growth.");
    if(growth != null && growth < 0) more.push("Its revenue shrank last year. Worth finding out why.");
    addNotes(more);
  }).catch(function(){ $("co-fin").innerHTML = '<h3>Revenue and profit</h3><p class="muted">Financial figures couldn\'t load. Try again later.</p>'; });
}

/* ---------- one made-up practice company ---------- */
function renderPracticeCo(s){
  var c = BY[s], host = $("rs-detail");
  if(!c){ go("research"); return; }
  var t = Math.max(pf.t, HIST), p=price(c.s,t), y1=p/price(c.s,t-12)-1, vl=volLabel(c.s,t);
  var hist=[]; for(var i=Math.max(0,t-HIST);i<=t;i++) hist.push(prices[c.s][i]);
  var fin = c.rev ? '<h3 style="margin-top:22px">Revenue and profit</h3><p class="muted small">Millions of dollars, last four years.</p>'+
      barChart(["3 yrs ago","2 yrs ago","Last year","This year"],[{d:c.rev,c:"var(--blue)"},{d:c.prof,c:"var(--up)"}],{fmt:function(v){return "$"+(Math.abs(v)>=1000?(v/1000).toFixed(1)+"B":v.toFixed(0)+"M");},label:"Revenue and profit by year"})+
      '<div class="legend"><span style="--c:var(--blue)">Revenue</span><span style="--c:var(--up)">Profit</span><span style="--c:var(--down)">Loss</span></div>'
    : '<h3 style="margin-top:22px">Why no revenue or profit?</h3><p>An index fund isn\'t a business, so it has no revenue of its own. Its value comes from the 500 companies it holds.</p>';
  host.innerHTML = '<div class="crumbs"><button data-go="research">← Back to search</button></div><div class="card">'+
    '<div class="co-head"><div><h2 style="margin-bottom:4px">'+esc(c.n)+'</h2><p class="muted" style="margin:0">'+c.s+' · '+esc(c.ind)+' · <span class="pill gold">Made up for practice</span></p></div>'+
    '<button class="btn" id="co-buy">Buy in practice portfolio</button></div>'+
    '<div class="facts"><div><b>'+money(p,2)+'</b><span>Share price</span></div><div><b class="'+cls(y1)+'">'+pct(y1)+'</b><span>Change over 12 months</span></div>'+
    '<div><b><span class="pill '+(vl.label==="Low"?"low":vl.label==="High"?"high":"")+'">'+vl.label+'</span></b><span>Volatility ('+(vl.sd*100).toFixed(0)+'% yearly swing)</span></div></div>'+
    '<h3>Share price, last '+(hist.length-1)+' months</h3>'+lineChart([{d:hist,c:"var(--blue)"}],{h:220,fmt:function(v){return "$"+v.toFixed(0);},xlabels:[{i:0,t:(hist.length-1)+" months ago"},{i:hist.length-1,t:"Now"}],label:"Share price history"})+
    '<h3 style="margin-top:22px">About the company</h3><p>'+esc(c.bg)+'</p>'+fin+
    '<h3 style="margin-top:22px">Risk factors</h3><ul class="risks">'+c.risks.map(function(x){return "<li>"+esc(x)+"</li>";}).join("")+'</ul></div>';
  $("co-buy").onclick = function(){ go("portfolio"); $("t-sym").value = c.s; tradeInfo(); $("t-amt").focus(); };
}
RENDER.research = function(arg){
  var detail = !!arg;
  $("rs-search").hidden = detail; $("rs-detail").hidden = !detail;
  if(!detail){ renderSearch(); return; }
  if(arg.indexOf("practice-") === 0) renderPracticeCo(arg.slice(9)); else renderCompany(arg);
};

/* ===== 60-money.js ===== */
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

/* ===== 70-quiz.js ===== */
/* ---------- before-and-after quiz ---------- */
var QUIZ = [
 {p:"What does owning a share of a company mean?",o:["You lent the company money","You own a small part of the company","You work for the company","You get free products"],a:1,e:"A share is a piece of ownership in the business."},
 {p:"Which usually has the highest risk?",o:["A savings account","A broad index fund","Shares in one brand‑new startup","Cash in a piggy bank"],a:2,e:"A single young company can grow fast or fail completely, so it carries the most risk."},
 {p:"What is diversification?",o:["Buying only the stock that's rising fastest","Spreading money across many different investments","Selling everything when prices fall","Checking your portfolio every day"],a:1,e:"Spreading out means one bad investment can't sink you."},
 {p:"A stock is described as 'highly volatile'. What does that mean?",o:["It always goes up","Its price swings up and down a lot","It pays a large dividend","It's guaranteed to lose money"],a:1,e:"Volatility measures how much a price bounces around."},
 {p:"You invest ₹1,000 at 10% a year and never take any out. After two years you have about:",o:["₹1,100","₹1,200","₹1,210","₹2,000"],a:2,e:"Year one: ₹1,100. Year two: 10% of ₹1,100 is ₹110, giving ₹1,210. That extra ₹10 is compound growth."},
 {p:"Why does starting to invest young matter so much?",o:["Young people get better prices","Compounding has more years to work","Teens pay no fees","Markets only rise for young investors"],a:1,e:"Time is what makes compounding powerful."},
 {p:"Money you need in six months should mostly be:",o:["In a single exciting stock","In savings","In cryptocurrency","Borrowed and invested"],a:1,e:"Short‑term money shouldn't be exposed to market drops."},
 {p:"An influencer says a coin is 'guaranteed to 10x this month'. The best move is to:",o:["Buy quickly before it's too late","Be very skeptical and research who benefits","Borrow money to buy more","Tell friends to buy it too"],a:1,e:"Guarantees and urgency are classic warning signs."},
 {p:"You get ₹1,000 pocket money and want to save some. Which plan works best?",o:["Spend first, save whatever's left","Put your savings aside as soon as you get it","Save only in months when you don't want anything","Borrow from a friend if you run out"],a:1,e:"Paying yourself first means saving actually happens."},
 {p:"Someone calling from 'your bank' asks for the OTP sent to your phone. What should you do?",o:["Read it out, since they're from the bank","Never share it and hang up","Share only the first half","Text it to them instead"],a:1,e:"No genuine bank or company ever asks for your OTP or PIN."}
];
function loadQuiz(){ return load("quiz",{before:null,after:null,total:QUIZ.length}); }
var quizState = loadQuiz();
RELOADERS.push(function(){ quizState = loadQuiz(); });
var quizAnswers = {}, quizMode = null, quizSubmitted = false;
function scoreText(s){ return s==null ? "–" : s+"/"+(quizState.total||QUIZ.length); }
function renderQuiz(){
  quizMode = quizState.before==null ? "before" : "after";
  $("quiz-intro").textContent = quizMode==="before"
    ? QUIZ.length+" questions, no pressure. This shows where you're starting from. Take it again after the lessons to see how far you've come."
    : "You've taken the starting quiz. Take it again after working through the lessons to compare.";
  var res="";
  if(quizState.before!=null){
    var b = quizState.before, a = quizState.after;
    res='<div class="card" style="margin-bottom:22px;max-width:760px"><h3>Your scores</h3><div class="compare"><div><div class="score">'+scoreText(b)+'</div><div class="muted">Before</div></div>'+
      (a!=null?'<div><div class="score">'+scoreText(a)+'</div><div class="muted">After</div></div>':'')+'</div>'+
      (a!=null ? '<p style="margin:0">'+(a>b?"You improved by "+(a-b)+" question"+(a-b===1?"":"s")+". Nice work.":a===b?"Same score both times. Look at the explanations for anything you missed.":"Your score dropped this time. Check the explanations below and revisit those lessons.")+'</p>'
        : '<p style="margin:0">Next: <button class="btn alt small" data-go="learn">work through the lessons</button>, then come back for the after quiz.</p>')+
      '</div>';
  }
  $("quiz-results").innerHTML=res;
  quizAnswers={}; quizSubmitted=false;
  $("quiz").innerHTML = '<h3>'+(quizMode==="before"?"Starting quiz":"After quiz")+'</h3>'+ QUIZ.map(function(q,i){
    return '<div class="q"><h3>'+(i+1)+'. '+esc(q.p)+'</h3><div class="opts">'+q.o.map(function(o,j){return '<button class="opt" data-q="'+i+'" data-o="'+j+'">'+esc(o)+'</button>';}).join("")+'</div><p class="feedback" id="qf'+i+'"></p></div>';
  }).join("")+'<button class="btn" id="quiz-submit">Check my answers</button> <span class="msg" id="quiz-msg" role="status"></span>';
  $("quiz-submit").onclick=submitQuiz;
  $("quiz-feedback").innerHTML = "";
}
$("quiz").addEventListener("click", function(e){
  var b=e.target.closest(".opt"); if(!b||quizSubmitted) return;
  var qi=+b.dataset.q; quizAnswers[qi]=+b.dataset.o;
  document.querySelectorAll('#quiz .opt[data-q="'+qi+'"]').forEach(function(x){ x.setAttribute("aria-pressed", x===b); });
});
function submitQuiz(){
  var n = Object.keys(quizAnswers).length;
  if(n<QUIZ.length){ $("quiz-msg").textContent="Answer all "+QUIZ.length+" questions first ("+n+" done)."; return; }
  quizSubmitted=true; var score=0;
  QUIZ.forEach(function(q,i){
    var ok=quizAnswers[i]===q.a; if(ok) score++;
    document.querySelectorAll('#quiz .opt[data-q="'+i+'"]').forEach(function(x){ var o=+x.dataset.o; x.removeAttribute("aria-pressed"); if(o===q.a) x.classList.add("right"); else if(o===quizAnswers[i]) x.classList.add("wrong"); });
    $("qf"+i).innerHTML=(ok?"<b>Right.</b> ":"<b>Not quite.</b> ")+esc(q.e);
  });
  quizState[quizMode]=score; quizState.total = QUIZ.length; save("quiz",quizState);
  if(ME && !ME.needsProfile) api("POST","/api/quiz",{kind:quizMode, score:score, total:QUIZ.length}).catch(function(){});
  $("quiz-submit").style.display="none";
  $("quiz-msg").innerHTML='You scored <b>'+score+'/'+QUIZ.length+'</b>. <button class="btn alt small" id="quiz-see">See my scores</button>';
  $("quiz-see").onclick=function(){ renderQuiz(); window.scrollTo(0,0); };
  if(!ME && quizMode==="before") $("quiz-msg").insertAdjacentHTML("beforeend", ' <span class="muted">Sign in to keep your score and compare it later on any device.</span>');
  renderFeedbackBox($("quiz-feedback"), quizMode === "after" ? "You've finished! How useful was Pocket Money?" : "How are you finding Pocket Money so far?");
}

/* ---------- feedback (star rating + comment) ---------- */
function renderFeedbackBox(host, title){
  if(!API.ok){ host.innerHTML = ""; return; }
  var rating = 0;
  host.innerHTML = '<div class="card form" style="margin-top:22px"><h3>'+esc(title)+'</h3><div class="stars" role="group" aria-label="Rating from 1 to 5">'+
    [1,2,3,4,5].map(function(n){ return '<button type="button" data-star="'+n+'" aria-pressed="false" aria-label="'+n+' out of 5">'+n+'</button>'; }).join("")+
    '</div><label for="fb-comment">Anything we should add or improve? (optional)</label><textarea id="fb-comment" maxlength="1000" style="min-height:80px"></textarea>'+
    '<div class="row" style="margin-top:10px"><button class="btn" id="fb-send">Send feedback</button></div><p class="msg" id="fb-msg" role="status"></p></div>';
  host.querySelectorAll("[data-star]").forEach(function(b){ b.onclick = function(){ rating = +b.dataset.star; host.querySelectorAll("[data-star]").forEach(function(x){ x.setAttribute("aria-pressed", +x.dataset.star <= rating); }); }; });
  $("fb-send").onclick = function(){
    if(!rating){ setMsg($("fb-msg"),"Pick a number from 1 to 5 first.","err"); return; }
    this.disabled = true;
    api("POST","/api/feedback",{rating:rating, comment:$("fb-comment").value}).then(function(){
      host.innerHTML = '<div class="card" style="margin-top:22px"><p style="margin:0"><b>Thank you!</b> Your feedback helps make Pocket Money better.</p></div>';
    }).catch(function(e){ $("fb-send").disabled = false; setMsg($("fb-msg"), e.message, "err"); });
  };
}
RENDER.quiz = renderQuiz;

/* ===== 80-auth.js ===== */
/* ---------- sign in / create account ---------- */
var dlg = $("login-dlg");
var GOOGLE_SVG = '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
var LOGIN_MESSAGES = { expired: "That sign-in link has expired or was already used. Ask for a new one below.",
  failed: "Signing in with Google didn't work. Try again, or use your email instead.", "google-off": "Google sign-in isn't switched on yet. Use your email instead." };

function closeLogin(){ if(dlg.open) dlg.close(); }
function openLogin(mode, arg){
  var b = $("login-body"), cfg = API.cfg, x = '<button class="x dlg-close" id="dlg-x" aria-label="Close">×</button>';
  if(!API.ok){
    b.innerHTML = x+'<h2 id="login-title">Accounts</h2><p>Accounts work on the live Pocket Money site. In this preview, everything you do is saved on this device.</p><button class="btn" id="dlg-ok">OK</button>';
  } else if(mode === "sent"){
    b.innerHTML = x+'<h2 id="login-title">Check your email</h2><p>We sent a sign-in link to <b>'+esc(arg)+'</b>. It works once and expires in 20 minutes.</p><p class="muted small">Can\'t find it? Check your spam folder, or close this and try again.</p><button class="btn" id="dlg-ok">OK</button>';
  } else if(mode === "finish" || mode === "signup"){
    var finish = mode === "finish";
    var noMethods = !finish && !cfg.google && !cfg.email && !cfg.dev;
    b.innerHTML = x+'<h2 id="login-title">'+(finish?"Finish setting up":"Create your free account")+'</h2>'+
      (finish ? '<p class="muted">Just a couple of questions before you start.</p>' : '<p class="muted">Save your lessons, money tracker and portfolio on all your devices.</p>')+
      (noMethods ? '<p>Accounts are coming soon. Everything you do is saved on this device for now.</p>' :
      '<div class="form" id="su-form"><label for="su-name">First name (optional)</label><input id="su-name" maxlength="40" autocomplete="given-name" value="'+esc(finish && ME ? ME.name : "")+'">'+
      '<label>How old are you?</label><div class="radios"><label><input type="radio" name="su-age" value="under13"> Under 13</label><label><input type="radio" name="su-age" value="13-17"> 13–17</label><label><input type="radio" name="su-age" value="18+"> 18 or over</label></div>'+
      '<p class="tip" id="su-u13" hidden>Pocket Money accounts are for ages 13 and up. You can still use every lesson and tool without an account: your progress saves on this device.</p>'+
      '<label class="check" id="su-consent-wrap" hidden><input type="checkbox" id="su-consent"> <span>My parent or guardian knows I\'m creating this account and agrees to it.</span></label>'+
      '<label class="check"><input type="checkbox" id="su-terms"> <span>I agree to the <a href="#terms" data-go="terms">terms</a> and have read the <a href="#privacy" data-go="privacy">privacy policy</a>.</span></label>'+
      (finish ? '<div class="row" style="margin-top:14px"><button class="btn" id="su-finish">Finish</button><button class="btn alt" id="su-cancel">Sign out</button></div>'
        : (cfg.google ? '<div style="margin-top:16px"><button class="btn google" id="su-google">'+GOOGLE_SVG+'Continue with Google</button></div>' : '')+
          (cfg.google && cfg.email ? '<div class="or">or</div>' : '')+
          (cfg.email ? '<label for="su-email">Email</label><input id="su-email" type="email" autocomplete="email" maxlength="254"><div class="row" style="margin-top:10px"><button class="btn" id="su-send" style="width:100%">Email me a sign-in link</button></div>' : '')+
          (cfg.dev ? devBox() : '')+
          '<p class="small" style="margin:14px 0 0">Already have an account? <a href="#" id="to-signin">Sign in</a></p>')+
      '<p class="msg" id="su-msg" role="status"></p></div>');
    wireProfileForm(finish);
  } else {
    var none = !cfg.google && !cfg.email && !cfg.dev;
    b.innerHTML = x+'<h2 id="login-title">Sign in</h2>'+
      (mode === "message" && LOGIN_MESSAGES[arg] ? '<p class="tip" style="margin-top:0">'+esc(LOGIN_MESSAGES[arg])+'</p>' : '')+
      (none ? '<p>Accounts are coming soon. Everything you do is saved on this device for now.</p>' :
      '<div class="form">'+(cfg.google ? '<button class="btn google" id="si-google">'+GOOGLE_SVG+'Continue with Google</button>' : '')+
      (cfg.google && cfg.email ? '<div class="or">or</div>' : '')+
      (cfg.email ? '<label for="si-email">Email</label><input id="si-email" type="email" autocomplete="email" maxlength="254"><div class="row" style="margin-top:10px"><button class="btn" id="si-send" style="width:100%">Email me a sign-in link</button></div>' : '')+
      (cfg.dev ? devBox() : '')+
      '<p class="msg" id="si-msg" role="status"></p><p class="small" style="margin:6px 0 0">New here? <a href="#" id="to-signup">Create a free account</a></p></div>');
    if($("si-google")) $("si-google").onclick = function(){ sessionStorage.removeItem("pm_pending"); location.href = "/api/auth/google/start?next="+encodeURIComponent(nextAfterLogin()); };
    if($("si-send")) $("si-send").onclick = function(){ sendLink($("si-email").value, null, $("si-msg"), this); };
    if($("si-email")) $("si-email").onkeydown = function(e){ if(e.key==="Enter") $("si-send").click(); };
    if($("to-signup")) $("to-signup").onclick = function(e){ e.preventDefault(); openLogin("signup"); };
  }
  wireDev();
  if($("dlg-x")) $("dlg-x").onclick = closeLogin;
  if($("dlg-ok")) $("dlg-ok").onclick = closeLogin;
  if(!dlg.open){ try{ dlg.showModal(); }catch(e){ dlg.setAttribute("open",""); } }
}
function devBox(){ return '<div class="tip"><b>Test sign-in</b> (only works on this computer)<div class="row" style="margin-top:6px"><input id="dev-email" placeholder="you@example.com" style="flex:1"><button class="btn small" id="dev-go">Go</button></div></div>'; }
function wireDev(){ if($("dev-go")) $("dev-go").onclick = function(){ location.href = "/api/auth/dev?email="+encodeURIComponent($("dev-email").value)+"&next="+encodeURIComponent(nextAfterLogin()); }; }
function nextAfterLogin(){ return ["home","learn","money","portfolio","research","quiz","account"].indexOf(currentPage) >= 0 ? currentPage : "account"; }
dlg.addEventListener("click", function(e){ if(e.target === dlg) closeLogin(); if(e.target.closest("[data-go]")) closeLogin(); });

function profileValues(){
  var age = (document.querySelector('input[name="su-age"]:checked')||{}).value || "";
  return { name: $("su-name").value.trim(), ageBand: age, consent: $("su-consent").checked, terms: $("su-terms").checked };
}
function profileProblem(v){
  if(!v.ageBand) return "Choose your age group.";
  if(v.ageBand === "under13") return "under13";
  if(v.ageBand === "13-17" && !v.consent) return "Ask a parent or guardian, then tick the box to confirm they agree.";
  if(!v.terms) return "Tick the box to agree to the terms.";
  return "";
}
function wireProfileForm(finish){
  if(!$("su-form")) return;
  var update = function(){
    var v = profileValues();
    $("su-u13").hidden = v.ageBand !== "under13";
    $("su-consent-wrap").hidden = v.ageBand !== "13-17";
    ["su-google","su-send"].forEach(function(id){ if($(id)) $(id).disabled = v.ageBand === "under13"; });
    if($("su-finish")) $("su-finish").textContent = v.ageBand === "under13" ? "OK, remove my details" : "Finish";
  };
  document.querySelectorAll('input[name="su-age"]').forEach(function(r){ r.onchange = update; });
  var check = function(){ var v = profileValues(), p = profileProblem(v); if(p && p !== "under13"){ setMsg($("su-msg"), p, "err"); return null; } return p ? null : v; };
  if($("to-signin")) $("to-signin").onclick = function(e){ e.preventDefault(); openLogin("signin"); };
  if($("su-google")) $("su-google").onclick = function(){
    var v = check(); if(!v) return;
    sessionStorage.setItem("pm_pending", JSON.stringify({name:v.name, ageBand:v.ageBand, consent:v.consent}));
    location.href = "/api/auth/google/start?next="+encodeURIComponent(nextAfterLogin());
  };
  if($("su-send")) $("su-send").onclick = function(){ var v = check(); if(v) sendLink($("su-email").value, v, $("su-msg"), this); };
  if($("su-finish")) $("su-finish").onclick = function(){
    var v = profileValues();
    if(v.ageBand === "under13"){
      api("POST","/api/me/profile",{ageBand:"under13"}).then(function(){
        ME = null; renderMeButton();
        $("login-body").innerHTML = '<h2 id="login-title">Thanks for trying Pocket Money</h2><p>Accounts are for ages 13 and up, so we haven\'t kept any of your details. You can still use every lesson and tool: your progress saves on this device.</p><button class="btn" id="dlg-ok">OK</button>';
        $("dlg-ok").onclick = closeLogin;
      }); return;
    }
    var ok = check(); if(!ok) return;
    this.disabled = true;
    api("POST","/api/me/profile",{name:ok.name, ageBand:ok.ageBand, consent:ok.consent}).then(function(r){
      ME = r.user; renderMeButton(); closeLogin(); show(currentPage, currentArg, true); afterSignIn();
    }).catch(function(e){ $("su-finish").disabled = false; setMsg($("su-msg"), e.message, "err"); });
  };
  if($("su-cancel")) $("su-cancel").onclick = function(){ closeLogin(); signOut(); };
  update();
}
function sendLink(email, profile, msgEl, btn){
  email = String(email||"").trim();
  if(!/^\S+@\S+\.\S+$/.test(email)){ setMsg(msgEl, "Enter your email address.", "err"); return; }
  btn.disabled = true; setMsg(msgEl, "Sending…");
  var body = {email:email, next:nextAfterLogin()};
  if(profile){ body.name = profile.name; body.ageBand = profile.ageBand; body.consent = profile.consent; }
  api("POST","/api/auth/email/start", body).then(function(){ openLogin("sent", email); })
    .catch(function(e){ btn.disabled = false; setMsg(msgEl, e.message, "err"); });
}
function afterSignIn(){
  if(!ME) return;
  if(ME.needsProfile){
    var pending = null; try{ pending = JSON.parse(sessionStorage.getItem("pm_pending")||"null"); }catch(e){}
    sessionStorage.removeItem("pm_pending");
    if(pending && pending.ageBand){
      return api("POST","/api/me/profile",pending).then(function(r){ ME = r.user; renderMeButton(); show(currentPage, currentArg, true); return afterSignIn(); }).catch(function(){ openLogin("finish"); });
    }
    openLogin("finish"); return;
  }
  sessionStorage.removeItem("pm_pending");
  return pullState();
}
function signOut(){
  return flushPush().then(function(){ return api("POST","/api/auth/logout",{}); }).catch(function(){}).then(function(){
    ME = null; clearDeviceData(); RELOADERS.forEach(function(f){ try{ f(); }catch(e){} }); renderMeButton();
    go("account"); setMsg($("acct-msg"), "You're signed out. Your progress is safe in your account.", "good");
  });
}

/* ---------- account page ---------- */
var AGE_LABEL = {"13-17":"13–17","18+":"18 or over"};
function renderAccount(){
  var host = $("account");
  if(!API.ok){
    host.innerHTML = '<div class="page-head"><h2>Your account</h2><p>Accounts work on the live Pocket Money site. In this preview, your progress is saved on this device.</p></div>'; return;
  }
  if(!ME){
    host.innerHTML = '<div class="page-head"><h2>Your account</h2><p>You\'re not signed in. Everything still works: your progress is saved on this device.</p></div>'+
      '<div class="acct"><div class="card"><h3>Why create an account?</h3><ul class="risks"><li>Your lessons, quiz scores, money tracker and portfolio on every device</li><li>Compare your before and after quiz scores any time</li><li>Free, no ads, no passwords to remember</li></ul>'+
      '<div class="row" style="margin-top:16px"><button class="btn" data-open-login="signup">Create a free account</button><button class="btn alt" data-open-login="signin">Sign in</button></div><p class="msg" id="acct-msg" role="status"></p></div>'+
      '<div class="card"><h3>Data on this device</h3><p>Your progress is stored in this browser only. Clearing it can\'t be undone.</p><button class="btn danger small" id="acct-clear">Clear Pocket Money data from this device</button></div></div>';
    $("acct-clear").onclick = function(){ if(confirm("Clear all your Pocket Money progress from this device?")){ clearDeviceData(); RELOADERS.forEach(function(f){ try{ f(); }catch(e){} }); setMsg($("acct-msg"),"Cleared.","good"); } };
    return;
  }
  host.innerHTML = '<div class="page-head"><h2>Hi'+(ME.name?", "+esc(ME.name):"")+'!</h2><p>Your progress is saved to your account and synced across your devices.</p></div>'+
    '<div class="acct"><div class="card form"><h3>Your details</h3>'+
    '<label for="acct-name">First name</label><input id="acct-name" maxlength="40" value="'+esc(ME.name)+'">'+
    '<p class="small" style="margin:12px 0 0"><b>Email:</b> '+esc(ME.email)+'<br><b>Age group:</b> '+esc(AGE_LABEL[ME.ageBand]||"–")+'<br><b>Sign-in:</b> '+(ME.google?"Google or email link":"Email link")+'<br><b>Member since:</b> '+fmtDate(ME.createdAt)+'</p>'+
    '<div class="row" style="margin-top:14px"><button class="btn" id="acct-save">Save</button>'+(ME.isAdmin?'<button class="btn blue" data-go="admin">Open admin panel</button>':'')+'</div><p class="msg" id="acct-msg" role="status"></p></div>'+
    '<div class="stack"><div class="card"><h3>Your data</h3><p>Download a copy of everything Pocket Money has saved about you, or delete your account and all its data for good.</p>'+
    '<div class="row"><a class="btn alt small" href="/api/me/export" download>Download my data</a><button class="btn danger small" id="acct-delete">Delete my account</button></div></div>'+
    '<div class="card"><h3>Signing out</h3><p>Signing out removes your progress from this device. It stays safe in your account.</p><div class="row"><button class="btn alt small" id="acct-out">Sign out</button><button class="btn alt small" id="acct-out-all">Sign out on all devices</button></div></div></div></div>';
  $("acct-save").onclick = function(){
    api("POST","/api/me/profile",{name:$("acct-name").value}).then(function(r){ ME = r.user; renderMeButton(); setMsg($("acct-msg"),"Saved.","good"); })
      .catch(function(e){ setMsg($("acct-msg"), e.message, "err"); });
  };
  $("acct-out").onclick = signOut;
  $("acct-out-all").onclick = function(){ flushPush().then(function(){ return api("POST","/api/auth/logout-everywhere",{}); }).catch(function(){}).then(function(){ ME = null; clearDeviceData(); RELOADERS.forEach(function(f){ try{ f(); }catch(e){} }); renderMeButton(); go("account"); setMsg($("acct-msg"),"Signed out on all devices.","good"); }); };
  $("acct-delete").onclick = function(){
    if(!confirm("Delete your Pocket Money account? Your saved progress, quiz scores and money tracker will be erased for good. This can't be undone.")) return;
    api("DELETE","/api/me").then(function(){ ME = null; clearDeviceData(); RELOADERS.forEach(function(f){ try{ f(); }catch(e){} }); renderMeButton(); go("account"); setMsg($("acct-msg"),"Your account and its data have been deleted.","good"); })
      .catch(function(e){ alert(e.message); });
  };
}
RENDER.account = renderAccount;

/* ---------- founder page ---------- */
var FOUNDER_DEFAULT = {
  name:"Tvesha", role:"Founder", business:"Pocket Money",
  headline:"Helping teenagers understand money and investing before real money is on the line.",
  bio:"I started Pocket Money because teenagers see investing everywhere on social media, but hardly anyone explains the basics: what a share actually is, why prices swing, or why starting early matters so much.\n\nMost financial information is either too complicated or feels like it was written for someone else. I wanted to build something made for people my age: short lessons, a tracker for the pocket money we actually get, research on real companies, and a practice portfolio where mistakes cost nothing.\n\nPocket Money is free. Every lesson is checked against reliable sources, and nothing on the site is financial advice.",
  photo:"", links:{instagram:"",youtube:"",linkedin:"",website:""}, publicEmail:""
};
var FOUNDER = null, FOUNDER_LOADING = null;
function loadFounder(){
  if(FOUNDER) return Promise.resolve(FOUNDER);
  if(!API.ok){ FOUNDER = FOUNDER_DEFAULT; return Promise.resolve(FOUNDER); }
  if(!FOUNDER_LOADING) FOUNDER_LOADING = api("GET","/api/content/founder").then(function(r){ FOUNDER = r.value || FOUNDER_DEFAULT; return FOUNDER; }).catch(function(){ FOUNDER = FOUNDER_DEFAULT; return FOUNDER; });
  return FOUNDER_LOADING;
}
var SOCIAL = {
  instagram:{label:"Instagram", svg:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>'},
  youtube:{label:"YouTube", svg:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="4"/><path d="M10 9l5 3-5 3z" fill="currentColor"/></svg>'},
  linkedin:{label:"LinkedIn", svg:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10v7M8 7v.01M12 17v-4a2 2 0 0 1 4 0v4M12 10v7"/></svg>'},
  website:{label:"Website", svg:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>'}
};
function socialLinks(links){
  return Object.keys(SOCIAL).map(function(k){ var u = links && links[k]; return u && /^https:\/\//.test(u) ? '<a href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">'+SOCIAL[k].svg+SOCIAL[k].label+'</a>' : ""; }).join("");
}
function renderFounder(){
  loadFounder().then(function(f){
    var initial = esc((f.name||"P").charAt(0).toUpperCase());
    var photo = f.photo && /^data:image\//.test(f.photo) ? '<img class="portrait" src="'+esc(f.photo)+'" alt="'+esc(f.name)+'">' : '<div class="portrait" aria-hidden="true">'+initial+'</div>';
    $("founder").innerHTML = '<div class="founder"><div>'+photo+'</div><div><p class="muted" style="margin:0 0 6px;font-weight:700">'+esc(f.business||"Pocket Money")+'</p><h2>'+esc(f.name)+'</h2><p class="role">'+esc(f.role)+'</p>'+
      (f.headline ? '<p style="font-size:1.2rem;font-family:var(--display);font-weight:700">'+esc(f.headline)+'</p>' : '')+
      '<div class="bio">'+String(f.bio||"").split(/\n\s*\n/).map(function(p){ return p.trim() ? "<p>"+esc(p.trim())+"</p>" : ""; }).join("")+'</div>'+
      '<div class="socials">'+socialLinks(f.links)+'<a href="#contact" data-go="contact">✉ Get in touch</a></div></div></div>';
  });
}
function renderFooterSocials(){ loadFounder().then(function(f){ $("foot-socials").innerHTML = socialLinks(f.links); }); }
RENDER.about = renderFounder;

/* ---------- contact ---------- */
RENDER.contact = function(){
  var off = !API.ok;
  $("ct-send").disabled = off;
  if(off) setMsg($("ct-status"), "The contact form works on the live Pocket Money site.");
  if(ME){ if(!$("ct-email").value) $("ct-email").value = ME.email; if(!$("ct-name").value) $("ct-name").value = ME.name || ""; }
  loadFounder().then(function(f){
    var box = $("contact-direct");
    if(f.publicEmail){ box.hidden = false; box.innerHTML = '<h3>Email</h3><p style="margin:0"><a href="mailto:'+esc(f.publicEmail)+'">'+esc(f.publicEmail)+'</a></p>'; } else box.hidden = true;
  });
};
$("contact-form").addEventListener("submit", function(e){
  e.preventDefault();
  var st = $("ct-status"), btn = $("ct-send");
  var body = {name:$("ct-name").value, email:$("ct-email").value, topic:$("ct-topic").value, message:$("ct-msg").value, website:$("ct-web").value};
  if(!/^\S+@\S+\.\S+$/.test(body.email.trim())){ setMsg(st,"Enter your email so we can reply.","err"); return; }
  if(body.message.trim().length < 5){ setMsg(st,"Write a little more in your message.","err"); return; }
  btn.disabled = true; setMsg(st,"Sending…");
  api("POST","/api/contact",body).then(function(){ $("ct-msg").value = ""; setMsg(st,"Message sent. We'll reply by email, usually within a few days.","good"); })
    .catch(function(err){ setMsg(st, err.message, "err"); }).then(function(){ btn.disabled = false; });
});

/* ===== 90-admin.js ===== */
/* ---------- admin panel ---------- */
var adminTab = "overview";
function countFmt(v){ return Math.abs(v-Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(1); }
document.querySelectorAll("[data-atab]").forEach(function(b){ b.onclick = function(){ adminTab = b.dataset.atab; renderAdmin(); }; });
function lessonTitle(key){ var p = key.split("-"), t = TRACKS[p[0]]; return t && t[+p[1]] ? (p[0]==="money"?"Money: ":"Investing: ")+t[+p[1]].t : key; }
function barList(rows){
  if(!rows.length) return '<p class="muted">No data yet.</p>';
  var top = Math.max.apply(null, rows.map(function(r){ return r.n; })) || 1;
  return '<div class="list-bars">'+rows.map(function(r){ return '<div class="cat-row"><span>'+esc(r.label)+'</span><div class="cat-bar"><div style="width:'+(r.n/top*100).toFixed(1)+'%"></div></div><span class="amt">'+r.n.toLocaleString()+'</span></div>'; }).join("")+'</div>';
}
var PAGE_NAMES = {home:"Home",learn:"Lessons",money:"My money",portfolio:"Portfolio",research:"Research",quiz:"Quiz",guide:"Cheat sheet",about:"About",contact:"Contact",account:"Account",admin:"Admin",privacy:"Privacy",terms:"Terms",cookies:"Cookies",disclaimer:"Disclaimer"};
function renderAdmin(){
  var host = $("admin");
  document.querySelectorAll("[data-atab]").forEach(function(b){ b.setAttribute("aria-pressed", b.dataset.atab === adminTab); });
  if(!API.ok){ host.innerHTML = '<p class="muted">The admin panel works on the live site.</p>'; return; }
  if(!ME){ host.innerHTML = '<p>Sign in with an admin email to see this page.</p><button class="btn" data-open-login="signin">Sign in</button>'; return; }
  if(!ME.isAdmin){ host.innerHTML = '<p>This page is only for Pocket Money admins.</p>'; return; }
  host.innerHTML = '<p class="loading">Loading…</p>';
  var fail = function(e){ host.innerHTML = '<p class="msg err">'+esc(e.message)+'</p>'; };
  if(adminTab === "overview") api("GET","/api/admin/overview").then(function(d){
    var t = d.totals, lab = function(i){ return new Date(d.days[i]+"T00:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short"}); };
    var xl = [{i:0,t:lab(0)},{i:29,t:lab(29)}];
    host.innerHTML = '<div class="kpis">'+stat(t.users,"People with accounts")+stat(t.new7,"New this week")+stat(t.active7,"Active in the last 7 days")+stat(t.active30,"Active in the last 30 days")+stat(t.views30.toLocaleString(),"Page views, 30 days")+stat(t.unread,"Unread messages")+'</div>'+
      '<div class="pf-grid"><div class="stack"><div class="card"><h3>New accounts and active users per day</h3>'+lineChart([{d:d.signups,c:"var(--blue)"},{d:d.dau,c:"var(--up)"}],{h:200,xlabels:xl,fmt:countFmt,min0:true,label:"Sign-ups and active users per day"})+
      '<div class="legend"><span style="--c:var(--blue)">New accounts</span><span style="--c:var(--up)">Signed-in people active</span></div></div>'+
      '<div class="card"><h3>Page views per day</h3>'+lineChart([{d:d.views,c:"var(--ink)"}],{h:180,xlabels:xl,fmt:countFmt,min0:true,label:"Page views per day"})+'<p class="muted small" style="margin:0">Counts every visitor, signed in or not. No personal data is stored for these.</p></div></div>'+
      '<div class="stack"><div class="card"><h3>Most-visited sections</h3>'+barList(d.pages.map(function(p){ return {label:PAGE_NAMES[p.page]||p.page, n:p.n}; }))+'</div>'+
      '<div class="card"><h3>Most-researched companies</h3>'+barList(d.companies.map(function(c){ var r = IDX && IDX.by[c.symbol]; return {label:r ? r[2] : c.symbol, n:c.n}; }))+'</div></div></div>';
    if(!IDX && d.companies.length) loadIndex().then(function(){ if(adminTab==="overview" && currentPage==="admin") renderAdmin(); });
  }).catch(fail);
  else if(adminTab === "impact") api("GET","/api/admin/impact").then(function(d){
    var q = d.quiz, p = function(x){ return x==null ? "–" : Math.round(x*100)+"%"; };
    var lessons = Object.keys(d.lessonCounts).sort().map(function(k){ return {label:lessonTitle(k), n:d.lessonCounts[k]}; });
    host.innerHTML = '<div class="card" style="margin-bottom:16px"><h3>Quiz: before vs after</h3><div class="compare"><div><div class="score">'+p(q.avgBefore)+'</div><div class="muted">Average before</div></div><div><div class="score">'+p(q.avgAfter)+'</div><div class="muted">Average after</div></div></div>'+
      '<p style="margin:0">'+q.tookBefore+' people took the starting quiz. '+q.tookBoth+' took both, and '+q.improved+' of them improved.'+(q.tookBoth ? ' Compares each person\'s first "before" score with their latest "after" score.' : '')+'</p></div>'+
      '<div class="pf-grid"><div class="card"><h3>Lessons completed</h3>'+barList(lessons)+'</div><div class="stack">'+
      '<div class="card"><h3>Tools used</h3>'+barList([{label:"Money tracker", n:d.tools.moneyUsers},{label:"Saving goals", n:d.tools.goalUsers},{label:"Practice portfolio", n:d.tools.portfolioUsers}])+'<p class="muted small" style="margin:0">Signed-in people only.</p></div>'+
      '<div class="card"><h3>Feedback</h3><p><b>'+(d.feedback.avg ? d.feedback.avg.toFixed(1)+" out of 5" : "No ratings yet")+'</b> from '+d.feedback.count+' rating'+(d.feedback.count===1?"":"s")+'.</p>'+
      (d.feedback.recent.length ? '<ul class="tx">'+d.feedback.recent.map(function(f){ return '<li><div class="what">'+esc(f.comment)+'<small>'+f.rating+'/5 · '+fmtDate(f.created_at)+'</small></div></li>'; }).join("")+'</ul>' : '')+
      '<p style="margin:10px 0 0"><a class="btn alt small" href="/api/admin/export/feedback" download>Download feedback (CSV)</a></p></div></div></div>';
  }).catch(fail);
  else if(adminTab === "users"){
    host.innerHTML = '<div class="row" style="margin-bottom:12px"><input id="au-q" placeholder="Search name or email" style="padding:9px 12px;border-radius:10px;border:1.5px solid var(--line);background:var(--card);min-width:240px"><a class="btn alt small" href="/api/admin/export/users" download>Download all users (CSV)</a></div><div id="au-list"><p class="loading">Loading…</p></div>';
    var loadUsers = function(){
      api("GET","/api/admin/users?q="+encodeURIComponent($("au-q").value)).then(function(d){
        $("au-list").innerHTML = !d.users.length ? '<p class="muted">No users found.</p>' : '<div class="card scroll-x" style="padding:6px 10px"><table><thead><tr><th>Name</th><th>Email</th><th>Age</th><th>Joined</th><th>Last active</th><th class="num">Lessons</th><th class="num">Money entries</th><th>Quiz before → after</th><th></th></tr></thead><tbody>'+
          d.users.map(function(u){ return '<tr><td>'+esc(u.name||"–")+'</td><td>'+esc(u.email)+'</td><td>'+esc(AGE_LABEL[u.age_band]||"–")+'</td><td>'+fmtDate(u.created_at)+'</td><td>'+fmtDate(u.last_active)+'</td><td class="num">'+u.lessonsDone+'</td><td class="num">'+u.moneyEntries+'</td><td>'+esc(u.quizBefore||"–")+' → '+esc(u.quizAfter||"–")+'</td>'+
            '<td><button class="x" data-deluser="'+esc(u.id)+'" data-email="'+esc(u.email)+'" aria-label="Delete user">×</button></td></tr>'; }).join("")+'</tbody></table></div><p class="muted small">'+d.users.length+' shown.</p>';
      }).catch(fail);
    };
    var tmr; $("au-q").oninput = function(){ clearTimeout(tmr); tmr = setTimeout(loadUsers, 250); };
    $("au-list").onclick = function(e){
      var b = e.target.closest("[data-deluser]"); if(!b) return;
      if(!confirm("Delete the account for "+b.dataset.email+" and all its data? This can't be undone.")) return;
      api("DELETE","/api/admin/users/"+b.dataset.deluser).then(loadUsers).catch(function(err){ alert(err.message); });
    };
    loadUsers();
  }
  else if(adminTab === "messages") api("GET","/api/admin/messages").then(function(d){
    host.innerHTML = '<p><a class="btn alt small" href="/api/admin/export/messages" download>Download messages (CSV)</a></p>'+(!d.messages.length ? '<p class="muted">No messages yet.</p>' :
      '<ul class="tx inbox">'+d.messages.map(function(m){ return '<li class="card" style="margin-bottom:10px;'+(m.handled?'opacity:.6':'')+'"><div class="row" style="justify-content:space-between"><b>'+esc(m.name||"(no name)")+' · '+esc(m.topic)+'</b><span class="muted small">'+fmtDate(m.created_at)+'</span></div>'+
        '<div class="body">'+esc(m.body)+'</div><div class="row"><a class="btn small" href="mailto:'+esc(m.email)+'?subject='+encodeURIComponent("Re: your message to Pocket Money")+'">Reply to '+esc(m.email)+'</a>'+
        '<button class="btn alt small" data-handled="'+m.id+'" data-val="'+(m.handled?0:1)+'">'+(m.handled?"Mark as not done":"Mark as done")+'</button></div></li>'; }).join("")+'</ul>');
    host.onclick = function(e){ var b = e.target.closest("[data-handled]"); if(!b) return; api("POST","/api/admin/messages/"+b.dataset.handled,{handled:b.dataset.val==="1"}).then(renderAdmin); };
  }).catch(fail);
  else if(adminTab === "founder"){ FOUNDER = null; FOUNDER_LOADING = null; loadFounder().then(renderFounderEditor); }
}
function renderFounderEditor(f){
  var host = $("admin"), photo = f.photo || "";
  host.onclick = null;
  host.innerHTML = '<div class="acct"><div class="card form"><h3>Founder page</h3>'+
    '<label for="fe-name">Name</label><input id="fe-name" maxlength="60" value="'+esc(f.name)+'">'+
    '<label for="fe-role">Role</label><input id="fe-role" maxlength="80" value="'+esc(f.role)+'">'+
    '<label for="fe-business">Business name</label><input id="fe-business" maxlength="60" value="'+esc(f.business)+'">'+
    '<label for="fe-headline">One-line headline</label><input id="fe-headline" maxlength="160" value="'+esc(f.headline)+'">'+
    '<label for="fe-bio">Biography (leave a blank line between paragraphs)</label><textarea id="fe-bio" maxlength="4000" style="min-height:220px">'+esc(f.bio)+'</textarea>'+
    '<label for="fe-email">Public contact email (optional, shown on the contact page)</label><input id="fe-email" type="email" maxlength="254" value="'+esc(f.publicEmail||"")+'">'+
    '</div><div class="stack"><div class="card form"><h3>Photo</h3><div class="row"><img id="fe-photo-prev" class="photo-prev" alt="" '+(photo?'src="'+esc(photo)+'"':'hidden')+'><div><input type="file" id="fe-photo" accept="image/*"><p class="muted small">A clear, friendly photo works best. It\'s resized automatically.</p><button class="btn alt small" id="fe-photo-rm">Remove photo</button></div></div></div>'+
    '<div class="card form"><h3>Social links</h3><p class="muted small" style="margin:0">Full links starting with https://</p>'+
    ['instagram','youtube','linkedin','website'].map(function(k){ return '<label for="fe-'+k+'">'+SOCIAL[k].label+'</label><input id="fe-'+k+'" type="url" maxlength="300" placeholder="https://" value="'+esc((f.links||{})[k]||"")+'">'; }).join("")+'</div>'+
    '<div class="card"><div class="row"><button class="btn" id="fe-save">Save founder page</button><button class="btn alt" data-go="about">View page</button></div><p class="msg" id="fe-msg" role="status"></p></div></div></div>';
  $("fe-photo").onchange = function(){
    var file = this.files && this.files[0]; if(!file) return;
    var img = new Image(), url = URL.createObjectURL(file);
    img.onload = function(){
      var scale = Math.min(1, 900/Math.max(img.width, img.height)), cv = document.createElement("canvas");
      cv.width = Math.round(img.width*scale); cv.height = Math.round(img.height*scale);
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
      var q = 0.85, data = cv.toDataURL("image/jpeg", q);
      while(data.length > 450000 && q > 0.4){ q -= 0.1; data = cv.toDataURL("image/jpeg", q); }
      photo = data; $("fe-photo-prev").src = data; $("fe-photo-prev").hidden = false; URL.revokeObjectURL(url);
    };
    img.onerror = function(){ setMsg($("fe-msg"),"That file isn't an image we can read. Try a JPG or PNG.","err"); };
    img.src = url;
  };
  $("fe-photo-rm").onclick = function(){ photo = ""; $("fe-photo-prev").hidden = true; };
  $("fe-save").onclick = function(){
    var bad = ['instagram','youtube','linkedin','website'].filter(function(k){ var v = $("fe-"+k).value.trim(); return v && !/^https:\/\//.test(v); });
    if(bad.length){ setMsg($("fe-msg"),"Links must start with https:// ("+bad.map(function(k){ return SOCIAL[k].label; }).join(", ")+").","err"); return; }
    var body = {name:$("fe-name").value, role:$("fe-role").value, business:$("fe-business").value, headline:$("fe-headline").value, bio:$("fe-bio").value, publicEmail:$("fe-email").value, photo:photo,
      links:{instagram:$("fe-instagram").value.trim(), youtube:$("fe-youtube").value.trim(), linkedin:$("fe-linkedin").value.trim(), website:$("fe-website").value.trim()}};
    api("PUT","/api/content/founder",body).then(function(r){ FOUNDER = r.value; setMsg($("fe-msg"),"Saved. Your founder page is updated.","good"); renderFooterSocials(); })
      .catch(function(e){ setMsg($("fe-msg"), e.message, "err"); });
  };
}
RENDER.admin = renderAdmin;

/* ===== 99-start.js ===== */
/* ---------- start ---------- */
var startHash = location.hash || "";
if(startHash.indexOf("#login") !== 0) routeFromHash(); else show("home","");
detectApi().then(loadMe).then(function(){
  renderFooterSocials();
  if(startHash.indexOf("#login") === 0) routeFromHash();
  else show(currentPage, currentArg, true);
  if(ME) afterSignIn();
});

})();
