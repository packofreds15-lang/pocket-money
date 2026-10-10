// End-to-end API checks against the local server (run with MOCK_UPSTREAM=1).
import { readFile } from "node:fs/promises";
const B = process.env.BASE || "http://localhost:8799";
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log("FAIL:", msg); } };
function jar() {
  const c = {};
  return {
    c,
    async req(path, opts = {}) {
      const headers = { ...(opts.headers || {}) };
      const ck = Object.entries(c).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join("; ");
      if (ck) headers.cookie = ck;
      if (opts.json !== undefined) { headers["content-type"] = "application/json"; opts.body = JSON.stringify(opts.json); }
      if (opts.method && opts.method !== "GET" && !("origin" in headers)) headers.origin = B;
      const r = await fetch(B + path, { method: opts.method || "GET", headers, body: opts.body, redirect: "manual" });
      for (const s of r.headers.getSetCookie()) { const [kv, ...rest] = s.split(";"); const [k, v] = kv.split("="); c[k.trim()] = /Max-Age=0/.test(rest.join(";")) ? "" : v; }
      return r;
    },
  };
}
const outbox = async () => JSON.parse(await readFile(new URL("./outbox.json", import.meta.url), "utf8"));
const linkFrom = (mail) => mail.text.match(/https?:\/\/\S+/)[0];
async function emailLogin(j, email, extra = {}) {
  const r = await j.req("/api/auth/email/start", { method: "POST", json: { email, ...extra } });
  const mails = await outbox();
  const link = linkFrom(mails[mails.length - 1]);
  const token = new URL(link).searchParams.get("token");
  const page = await j.req(new URL(link).pathname + new URL(link).search);
  const r2 = await j.req("/api/auth/email/verify", { method: "POST", body: new URLSearchParams({ token }), headers: { "content-type": "application/x-www-form-urlencoded" } });
  return { r, page, r2, token };
}

const anon = jar();
const cfg = await (await anon.req("/api/config")).json();
ok(cfg.google && cfg.email && cfg.priceLagDays === 30, "config " + JSON.stringify(cfg));
ok((await (await anon.req("/api/me")).json()).user === null, "signed out me");

// Email sign-up rules
let r = await anon.req("/api/auth/email/start", { method: "POST", json: { email: "kid@example.com", ageBand: "under13" } });
ok(r.status === 400 && (await r.json()).error === "under13", "under 13 blocked");
r = await anon.req("/api/auth/email/start", { method: "POST", json: { email: "teen@example.com", ageBand: "13-17", consent: false } });
ok(r.status === 400, "teen without consent blocked");
r = await anon.req("/api/auth/email/start", { method: "POST", json: { email: "not-an-email" } });
ok(r.status === 400, "bad email");

const teen = jar();
const t = await emailLogin(teen, "teen@example.com", { ageBand: "13-17", consent: true, name: "Asha", next: "money" });
ok(t.r.status === 200, "start ok");
ok(t.page.status === 200 && (await t.page.text()).includes('method="post"'), "verify page needs a click");
ok(t.r2.status === 302 && t.r2.headers.get("location").endsWith("/#money") && teen.c.pm_session, "verify logs in and redirects");
let me = (await (await teen.req("/api/me")).json()).user;
ok(me && me.name === "Asha" && me.ageBand === "13-17" && !me.needsProfile && !me.isAdmin, "teen profile " + JSON.stringify(me));
const reuse = await jar().req("/api/auth/email/verify", { method: "POST", body: new URLSearchParams({ token: t.token }), headers: { "content-type": "application/x-www-form-urlencoded" } });
ok(reuse.headers.get("location").endsWith("#login/expired"), "link only works once");

// Saving progress
r = await teen.req("/api/state/lessons", { method: "PUT", json: { value: { done: { "money-0": true, "invest-1": true } }, updatedAt: 2000 } });
ok((await r.json()).saved, "save lessons");
r = await teen.req("/api/state/lessons", { method: "PUT", json: { value: { done: {} }, updatedAt: 1000 } });
ok((await r.json()).saved === false, "older copy doesn't overwrite newer");
await teen.req("/api/state/money", { method: "PUT", json: { value: { tx: [{ amt: 500 }], goals: [{ name: "x" }] }, updatedAt: 5 } });
let st = (await (await teen.req("/api/state")).json()).state;
ok(st.lessons.value.done["money-0"] && st.money.value.tx.length === 1, "state comes back");
ok((await teen.req("/api/state/hack", { method: "PUT", json: { value: 1 } })).status === 400, "unknown state key rejected");
ok((await teen.req("/api/quiz", { method: "POST", json: { kind: "before", score: 4, total: 10 } })).status === 200, "quiz before");
ok((await teen.req("/api/quiz", { method: "POST", json: { kind: "after", score: 9, total: 10 } })).status === 200, "quiz after");
ok((await teen.req("/api/quiz", { method: "POST", json: { kind: "after", score: 11, total: 10 } })).status === 400, "bad quiz score");
ok((await teen.req("/api/feedback", { method: "POST", json: { rating: 5, comment: "Loved the money tracker" } })).status === 200, "feedback");
ok((await teen.req("/api/track", { method: "POST", json: { page: "money" } })).status === 200, "track");
await anon.req("/api/track", { method: "POST", json: { page: "research" } });
await anon.req("/api/track/company", { method: "POST", json: { symbol: "TSLA" } });

// Contact form
ok((await anon.req("/api/contact", { method: "POST", json: { name: "Mr Rao", email: "teacher@school.in", topic: "school", message: "Can we use this in class?" } })).status === 200, "contact");
ok((await anon.req("/api/contact", { method: "POST", json: { name: "x", email: "", message: "hello there" } })).status === 400, "contact needs email");
ok((await anon.req("/api/contact", { method: "POST", json: { website: "spam", message: "buy" } })).status === 200, "honeypot silently ignored");
const mails = await outbox();
ok(mails.some((m) => m.to[0] === "owner@example.com" && m.reply_to === "teacher@school.in"), "contact notification email");

// Security checks
ok((await teen.req("/api/quiz", { method: "POST", json: { kind: "before", score: 1, total: 2 }, headers: { origin: "https://evil.example" } })).status === 403, "cross-site blocked");
ok((await teen.req("/api/quiz", { method: "POST", body: "kind=before", headers: { "content-type": "application/x-www-form-urlencoded" } })).status === 415, "form posts blocked");
ok((await teen.req("/api/admin/overview")).status === 403, "non-admin can't see admin");
ok((await anon.req("/api/state")).status === 401, "signed-out can't read state");
ok((await anon.req("/api/content/founder", { method: "PUT", json: {} })).status === 401, "signed-out can't edit founder");

// Google sign-in
const g = jar();
r = await g.req("/api/auth/google/start?next=research");
const gurl = new URL(r.headers.get("location"));
ok(gurl.host === "accounts.google.com" && gurl.searchParams.get("code_challenge_method") === "S256", "google redirect with PKCE");
ok((await g.req(`/api/auth/google/callback?state=wrong&code=gina`)).headers.get("location").endsWith("#login/failed"), "bad state rejected");
r = await g.req("/api/auth/google/start?next=research");
const state = new URL(r.headers.get("location")).searchParams.get("state");
r = await g.req(`/api/auth/google/callback?state=${state}&code=gina`);
ok(r.headers.get("location").endsWith("/#research") && g.c.pm_session, "google sign-in works");
me = (await (await g.req("/api/me")).json()).user;
ok(me.needsProfile && me.google && me.name === "Gina", "new google user must finish profile");
r = await g.req("/api/me/profile", { method: "POST", json: { ageBand: "13-17", consent: false } });
ok(r.status === 400, "profile needs consent for teens");
r = await g.req("/api/me/profile", { method: "POST", json: { ageBand: "under13" } });
ok((await r.json()).deleted && !g.c.pm_session, "under-13 account removed");
ok((await (await g.req("/api/me")).json()).user === null, "signed out after removal");

// Admin
const admin = jar();
r = await admin.req("/api/auth/dev?email=admin@example.com&next=admin");
ok(r.status === 302 && admin.c.pm_session, "dev login (localhost only)");
await admin.req("/api/me/profile", { method: "POST", json: { ageBand: "18+", name: "Tvesha" } });
me = (await (await admin.req("/api/me")).json()).user;
ok(me.isAdmin && !me.needsProfile, "admin recognised");
const ov = await (await admin.req("/api/admin/overview")).json();
ok(ov.totals.users === 2 && ov.totals.views30 === 2 && ov.days.length === 30 && ov.companies[0]?.symbol === "TSLA" && ov.totals.unread === 1, "overview " + JSON.stringify(ov.totals));
const imp = await (await admin.req("/api/admin/impact")).json();
ok(imp.quiz.tookBoth === 1 && Math.abs(imp.quiz.avgBefore - 0.4) < 1e-9 && imp.quiz.improved === 1 && imp.lessonCounts["money-0"] === 1 && imp.tools.moneyUsers === 1 && imp.feedback.avg === 5, "impact " + JSON.stringify(imp.quiz));
const us = await (await admin.req("/api/admin/users?q=asha")).json();
ok(us.users.length === 1 && us.users[0].quizBefore === "4/10" && us.users[0].lessonsDone === 2, "users list " + JSON.stringify(us.users[0]));
const msgs = (await (await admin.req("/api/admin/messages")).json()).messages;
ok(msgs.length === 1 && msgs[0].topic === "school", "messages inbox");
ok((await admin.req(`/api/admin/messages/${msgs[0].id}`, { method: "POST", json: { handled: true } })).status === 200, "mark handled");
const csvText = await (await admin.req("/api/admin/export/users")).text();
ok(csvText.startsWith("name,email") && csvText.includes("teen@example.com"), "csv export");
r = await admin.req("/api/content/founder", { method: "PUT", json: { name: "Tvesha", bio: "<script>x</script>Hi", links: { instagram: "javascript:alert(1)", youtube: "https://youtube.com/@pocketmoney" }, photo: "data:text/html;base64,AAAA" } });
const fv = (await r.json()).value;
ok(fv.links.instagram === "" && fv.links.youtube.startsWith("https://") && fv.photo === "", "founder input cleaned");
ok((await (await anon.req("/api/content/founder")).json()).value.name === "Tvesha", "founder page public");

// Stock data
const pr = await (await anon.req("/api/stock/TSLA/prices")).json();
const lastT = pr.points[pr.points.length - 1][0];
ok(pr.ok && pr.points.length > 200 && Date.now() / 1000 - lastT >= 30 * 86400, "prices delayed 30+ days");
const fin = await (await anon.req("/api/stock/IBM/financials")).json();
ok(fin.ok && fin.years.length === 4 && fin.years[3].netIncome === -1e9, "financials parsed");
ok((await (await anon.req("/api/stock/NOPE/prices")).json()).ok === false, "unknown symbol handled");
ok((await anon.req("/api/stock/<bad>/prices")).status === 404, "bad symbol rejected");

// Your data: export + delete
const ex = await (await teen.req("/api/me/export")).json();
ok(ex.account.email === "teen@example.com" && ex.quizAttempts.length === 2 && ex.savedData.money, "export my data");
ok((await teen.req("/api/me", { method: "DELETE" })).status === 200, "delete account");
ok((await (await admin.req("/api/admin/users")).json()).users.length === 1, "deleted user gone");

// Rate limit on sign-in emails
let last;
for (let i = 0; i < 6; i++) last = await anon.req("/api/auth/email/start", { method: "POST", json: { email: "spam@example.com" } });
ok(last.status === 429, "sign-in emails rate limited");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
