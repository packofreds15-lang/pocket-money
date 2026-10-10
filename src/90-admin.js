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
