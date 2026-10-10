/* ---------- start ---------- */
var startHash = location.hash || "";
if(startHash.indexOf("#login") !== 0) routeFromHash(); else show("home","");
detectApi().then(loadMe).then(function(){
  renderFooterSocials();
  if(startHash.indexOf("#login") === 0) routeFromHash();
  else show(currentPage, currentArg, true);
  if(ME) afterSignIn();
});
