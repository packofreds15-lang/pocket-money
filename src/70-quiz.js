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
