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
