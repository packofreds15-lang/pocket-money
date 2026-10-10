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
