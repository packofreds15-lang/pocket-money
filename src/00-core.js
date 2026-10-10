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
