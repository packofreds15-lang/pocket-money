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
