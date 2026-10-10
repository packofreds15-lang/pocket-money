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
