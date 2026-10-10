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
