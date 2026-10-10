// Pocket Money API — runs on Cloudflare Pages Functions with a D1 database bound as `DB`.
//
// Settings (Cloudflare dashboard → your Pages project → Settings → Variables and Secrets):
//   ADMIN_EMAILS          comma-separated emails that get the admin panel (required for admin)
//   GOOGLE_CLIENT_ID      } "Continue with Google" (optional)
//   GOOGLE_CLIENT_SECRET  }
//   RESEND_API_KEY        } "Email me a sign-in link" + contact-form notifications (optional)
//   EMAIL_FROM            }   e.g.  Pocket Money <hello@yourdomain.com>
//   CONTACT_EMAIL         where contact-form notifications go (optional)
//   PRICE_LAG_DAYS        price delay for charts, default 30 (SEBI education rule)
//   DEV_INSECURE_LOGIN    "1" enables a test login, only ever on localhost. Never set this on the live site.

import { SCHEMA } from "./schema.js";
import { getPrices, getFinancials } from "./stocks.js";

const DAY = 86400;
const SESSION_DAYS = 30;
const COOKIE = "pm_session";
const MAX_STATE_BYTES = 300_000;
const STATE_KEYS = new Set(["lessons", "quiz", "pf", "money", "watchlist", "prefs"]);
const AGE_BANDS = new Set(["13-17", "18+"]);
const TERMS_VERSION = "2026-10";

let schemaReady = null;

// ---------- small helpers ----------
const now = () => Math.floor(Date.now() / 1000);
const today = () => new Date().toISOString().slice(0, 10);
const enc = new TextEncoder();

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}
const err = (status, code, message) => json({ error: code, message }, status);

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function randomToken(n = 32) {
  return b64url(crypto.getRandomValues(new Uint8Array(n)));
}
function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.get("cookie") || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function cookie(name, value, maxAge, extra = "") {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}${extra}`;
}
function cleanText(v, max) {
  return String(v ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);
}
const EMAIL_RE = /^[^\s@<>()",;:]{1,64}@[^\s@<>()",;:]{1,190}\.[a-z]{2,24}$/i;
function cleanEmail(v) {
  const e = String(v ?? "").trim().toLowerCase();
  return EMAIL_RE.test(e) && e.length <= 254 ? e : null;
}
const safeNext = (v) => (/^[a-z0-9/_-]{0,40}$/i.test(v || "") ? v : "") || "account";
function adminEmails(env) {
  return (env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}
function publicUser(u, env) {
  if (!u) return null;
  return {
    id: u.id, name: u.name, email: u.email, ageBand: u.age_band, createdAt: u.created_at,
    needsProfile: !AGE_BANDS.has(u.age_band) || (u.age_band === "13-17" && !u.parent_consent),
    isAdmin: adminEmails(env).includes(u.email), google: !!u.google_sub,
  };
}
async function readJson(req, max = 400_000) {
  const len = Number(req.headers.get("content-length") || 0);
  if (len > max) throw Object.assign(new Error("too big"), { status: 413 });
  const text = await req.text();
  if (text.length > max) throw Object.assign(new Error("too big"), { status: 413 });
  try { return text ? JSON.parse(text) : {}; } catch { throw Object.assign(new Error("bad json"), { status: 400 }); }
}
function clientIp(req) {
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
}
// IP addresses are only ever stored scrambled (hashed), as rate-limit keys that are deleted after 2 days.
async function ipKey(req) {
  return (await sha256("pocket-money:" + clientIp(req))).slice(0, 20);
}

async function ensureSchema(env) {
  if (!schemaReady) {
    schemaReady = env.DB.batch(SCHEMA.map((s) => env.DB.prepare(s))).catch((e) => { schemaReady = null; throw e; });
  }
  return schemaReady;
}

// Allows `limit` hits per `windowSec` for a key. Returns true when allowed.
async function rateLimit(env, key, limit, windowSec) {
  const t = now();
  const row = await env.DB.prepare(
    `INSERT INTO rate_limits(key, window_start, count) VALUES(?1, ?2, 1)
     ON CONFLICT(key) DO UPDATE SET
       count = CASE WHEN window_start <= ?3 THEN 1 ELSE count + 1 END,
       window_start = CASE WHEN window_start <= ?3 THEN ?2 ELSE window_start END
     RETURNING count`
  ).bind(key, t, t - windowSec).first();
  return (row?.count ?? 1) <= limit;
}

// ---------- sessions ----------
async function currentUser(req, env) {
  const token = parseCookies(req)[COOKIE];
  if (!token || token.length > 100) return null;
  const u = await env.DB.prepare(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?1 AND s.expires_at > ?2`
  ).bind(await sha256(token), now()).first();
  return u || null;
}
async function startSession(env, userId) {
  const token = randomToken();
  const t = now();
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO sessions(token_hash, user_id, created_at, expires_at) VALUES(?1, ?2, ?3, ?4)`)
      .bind(await sha256(token), userId, t, t + SESSION_DAYS * DAY),
    env.DB.prepare(`DELETE FROM sessions WHERE expires_at < ?1`).bind(t),
    env.DB.prepare(`DELETE FROM login_links WHERE expires_at < ?1`).bind(t),
    env.DB.prepare(`DELETE FROM rate_limits WHERE window_start < ?1`).bind(t - 2 * DAY),
    env.DB.prepare(`UPDATE users SET last_active = ?1 WHERE id = ?2`).bind(t, userId),
  ]);
  return cookie(COOKIE, token, SESSION_DAYS * DAY);
}
function redirect(location, setCookies = []) {
  const h = new Headers({ location, "cache-control": "no-store" });
  for (const c of setCookies) h.append("set-cookie", c);
  return new Response(null, { status: 302, headers: h });
}

async function findOrCreateUser(env, { email, name, googleSub, profile }) {
  let u = await env.DB.prepare(`SELECT * FROM users WHERE email = ?1`).bind(email).first();
  if (!u && googleSub) u = await env.DB.prepare(`SELECT * FROM users WHERE google_sub = ?1`).bind(googleSub).first();
  if (u) {
    if (googleSub && !u.google_sub) await env.DB.prepare(`UPDATE users SET google_sub = ?1 WHERE id = ?2`).bind(googleSub, u.id).run();
    return u;
  }
  const id = crypto.randomUUID();
  const t = now();
  const p = profile || {};
  const ageBand = AGE_BANDS.has(p.ageBand) ? p.ageBand : "";
  const consent = ageBand === "13-17" ? (p.consent ? 1 : 0) : 0;
  await env.DB.prepare(
    `INSERT INTO users(id, email, name, age_band, parent_consent, google_sub, created_at, last_active, terms_version)
     VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7, ?8)`
  ).bind(id, email, cleanText(p.name || name || "", 40), ageBand, consent, googleSub || null, t, ageBand ? TERMS_VERSION : "").run();
  return await env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind(id).first();
}

async function deleteUser(env, id) {
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?1`).bind(id),
    env.DB.prepare(`DELETE FROM user_state WHERE user_id = ?1`).bind(id),
    env.DB.prepare(`DELETE FROM quiz_attempts WHERE user_id = ?1`).bind(id),
    env.DB.prepare(`DELETE FROM feedback WHERE user_id = ?1`).bind(id),
    env.DB.prepare(`DELETE FROM activity WHERE user_id = ?1`).bind(id),
    env.DB.prepare(`UPDATE messages SET user_id = NULL WHERE user_id = ?1`).bind(id),
    env.DB.prepare(`DELETE FROM users WHERE id = ?1`).bind(id),
  ]);
}

// ---------- email ----------
async function sendEmail(env, { to, subject, text, html, replyTo }) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return false;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, text, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  if (!r.ok) console.log("email failed", r.status, await r.text().catch(() => ""));
  return r.ok;
}
const escHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function verifyPage(token, origin) {
  // Shown when someone opens the email link. The sign-in only happens after they press the button,
  // so email security scanners that open links automatically can't use up the one-time link.
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sign in to Pocket Money</title><style>body{font-family:system-ui,sans-serif;background:#F3F6FB;color:#14213D;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px}
main{background:#fff;border:1px solid #D5DCE8;border-radius:16px;padding:28px;max-width:380px;text-align:center}button{background:#14213D;color:#fff;border:0;border-radius:10px;padding:12px 20px;font:inherit;font-weight:700;cursor:pointer;width:100%}
@media (prefers-color-scheme:dark){body{background:#0F1628;color:#E9EEF8}main{background:#18213A;border-color:#2C3756}button{background:#E9EEF8;color:#14213D}}</style></head>
<body><main><h1 style="font-size:1.4rem">Sign in to Pocket Money</h1><p>Press the button to finish signing in on this device.</p>
<form method="post" action="${escHtml(origin)}/api/auth/email/verify"><input type="hidden" name="token" value="${escHtml(token)}"><button type="submit">Sign in</button></form></main></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "referrer-policy": "same-origin" } });
}

// ---------- route handlers ----------
async function emailStart(req, env, url) {
  if (!(env.RESEND_API_KEY && env.EMAIL_FROM)) return err(503, "email_off", "Email sign-in isn't set up yet.");
  const b = await readJson(req, 4000);
  const email = cleanEmail(b.email);
  if (!email) return err(400, "bad_email", "Enter a valid email address.");
  if (b.ageBand === "under13") return err(400, "under13", "under13");
  const ip = await ipKey(req);
  if (!(await rateLimit(env, `link:ip:${ip}`, 20, 3600)) || !(await rateLimit(env, `link:em:${email}`, 5, 3600)))
    return err(429, "slow_down", "Too many sign-in emails. Try again in an hour.");
  const profile = AGE_BANDS.has(b.ageBand)
    ? { ageBand: b.ageBand, consent: !!b.consent, name: cleanText(b.name, 40) } : null;
  if (profile && profile.ageBand === "13-17" && !profile.consent)
    return err(400, "consent", "Ask a parent or guardian, then tick the box to confirm they agree.");
  const token = randomToken();
  await env.DB.prepare(`INSERT INTO login_links(token_hash, email, payload, expires_at, next) VALUES(?1, ?2, ?3, ?4, ?5)`)
    .bind(await sha256(token), email, profile ? JSON.stringify(profile) : null, now() + 20 * 60, safeNext(b.next)).run();
  const link = `${url.origin}/api/auth/email/verify?token=${encodeURIComponent(token)}`;
  await sendEmail(env, {
    to: email,
    subject: "Your Pocket Money sign-in link",
    text: `Hi!\n\nUse this link to sign in to Pocket Money. It works once and expires in 20 minutes:\n\n${link}\n\nIf you didn't ask for this, you can ignore this email.\n\nPocket Money`,
    html: `<div style="font-family:system-ui,sans-serif;color:#14213D;max-width:480px"><p>Hi!</p><p>Press the button to sign in to Pocket Money. The link works once and expires in 20 minutes.</p>
<p><a href="${escHtml(link)}" style="display:inline-block;background:#14213D;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:700">Sign in to Pocket Money</a></p>
<p style="color:#56627A;font-size:14px">If you didn't ask for this, you can ignore this email.</p></div>`,
  });
  return json({ ok: true });
}

async function emailVerify(req, env, url) {
  if (req.method === "GET") return verifyPage(url.searchParams.get("token") || "", url.origin);
  const form = await req.formData();
  const token = String(form.get("token") || "");
  const t = now();
  const row = token && (await env.DB.prepare(
    `UPDATE login_links SET used = 1 WHERE token_hash = ?1 AND used = 0 AND expires_at > ?2 RETURNING email, payload, next`
  ).bind(await sha256(token), t).first());
  if (!row) return redirect(`${url.origin}/#login/expired`);
  const profile = row.payload ? JSON.parse(row.payload) : null;
  const u = await findOrCreateUser(env, { email: row.email, profile });
  return redirect(`${url.origin}/#${row.next || "account"}`, [await startSession(env, u.id)]);
}

async function googleStart(req, env, url) {
  if (!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)) return redirect(`${url.origin}/#login/google-off`);
  const state = randomToken(16);
  const verifier = randomToken(48);
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(verifier))));
  const next = safeNext(url.searchParams.get("next"));
  const p = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID, redirect_uri: `${url.origin}/api/auth/google/callback`, response_type: "code",
    scope: "openid email profile", state, code_challenge: challenge, code_challenge_method: "S256", prompt: "select_account",
  });
  return redirect(`https://accounts.google.com/o/oauth2/v2/auth?${p}`, [
    cookie("pm_oauth", `${state}.${verifier}.${next}`, 600),
  ]);
}

async function googleCallback(req, env, url) {
  const clear = cookie("pm_oauth", "", 0);
  const [state, verifier, next] = (parseCookies(req).pm_oauth || "").split(".");
  if (!state || state !== url.searchParams.get("state") || !url.searchParams.get("code"))
    return redirect(`${url.origin}/#login/failed`, [clear]);
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: url.searchParams.get("code"), client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${url.origin}/api/auth/google/callback`, grant_type: "authorization_code", code_verifier: verifier,
    }),
  });
  if (!r.ok) return redirect(`${url.origin}/#login/failed`, [clear]);
  const { id_token } = await r.json();
  // The ID token came straight from Google's token endpoint over HTTPS, so its contents can be trusted
  // without checking the signature (Google's documented guidance). We still check who it was issued to.
  let claims;
  try {
    const part = id_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    claims = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(part), (c) => c.charCodeAt(0))));
  } catch { return redirect(`${url.origin}/#login/failed`, [clear]); }
  const okIss = claims.iss === "https://accounts.google.com" || claims.iss === "accounts.google.com";
  if (!okIss || claims.aud !== env.GOOGLE_CLIENT_ID || claims.exp < now() || !claims.email_verified)
    return redirect(`${url.origin}/#login/failed`, [clear]);
  const email = cleanEmail(claims.email);
  if (!email) return redirect(`${url.origin}/#login/failed`, [clear]);
  const u = await findOrCreateUser(env, { email, name: claims.given_name || claims.name || "", googleSub: String(claims.sub) });
  return redirect(`${url.origin}/#${safeNext(next)}`, [clear, await startSession(env, u.id)]);
}

async function devLogin(req, env, url) {
  const local = ["localhost", "127.0.0.1"].includes(url.hostname);
  if (env.DEV_INSECURE_LOGIN !== "1" || !local) return err(404, "not_found", "Not found");
  const email = cleanEmail(url.searchParams.get("email"));
  if (!email) return err(400, "bad_email", "email required");
  const u = await findOrCreateUser(env, { email, name: email.split("@")[0] });
  return redirect(`${url.origin}/#${safeNext(url.searchParams.get("next"))}`, [await startSession(env, u.id)]);
}

async function updateProfile(req, env, user) {
  const b = await readJson(req, 2000);
  if (b.ageBand === "under13") {
    await deleteUser(env, user.id);
    return json({ deleted: true, reason: "under13" }, 200, { "set-cookie": cookie(COOKIE, "", 0) });
  }
  const ageBand = AGE_BANDS.has(b.ageBand) ? b.ageBand : user.age_band;
  if (!AGE_BANDS.has(ageBand)) return err(400, "age", "Choose your age group.");
  const consent = ageBand === "13-17" ? (b.consent ? 1 : user.parent_consent) : 0;
  if (ageBand === "13-17" && !consent) return err(400, "consent", "Ask a parent or guardian, then tick the box to confirm they agree.");
  const name = b.name !== undefined ? cleanText(b.name, 40) : user.name;
  await env.DB.prepare(`UPDATE users SET name = ?1, age_band = ?2, parent_consent = ?3, terms_version = ?4 WHERE id = ?5`)
    .bind(name, ageBand, consent, TERMS_VERSION, user.id).run();
  const u = await env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind(user.id).first();
  return json({ user: publicUser(u, env) });
}

async function getState(env, user) {
  const { results } = await env.DB.prepare(`SELECT key, value, updated_at FROM user_state WHERE user_id = ?1`).bind(user.id).all();
  const state = {};
  for (const r of results) {
    try { state[r.key] = { value: JSON.parse(r.value), updatedAt: r.updated_at }; } catch {}
  }
  return json({ state });
}

async function putState(req, env, user, key) {
  if (!STATE_KEYS.has(key)) return err(400, "bad_key", "Unknown data type.");
  if (!(await rateLimit(env, `state:${user.id}`, 600, 3600))) return err(429, "slow_down", "Saving too often.");
  const b = await readJson(req, MAX_STATE_BYTES + 1000);
  const value = JSON.stringify(b.value ?? null);
  if (value.length > MAX_STATE_BYTES) return err(413, "too_big", "That's too much data to save.");
  const updatedAt = Number.isFinite(b.updatedAt) ? Math.min(Math.floor(b.updatedAt), Date.now() + 60_000) : Date.now();
  // Only overwrite when this copy is at least as new as the saved one (protects against an old device overwriting new data).
  const res = await env.DB.prepare(
    `INSERT INTO user_state(user_id, key, value, updated_at) VALUES(?1, ?2, ?3, ?4)
     ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
     WHERE excluded.updated_at >= user_state.updated_at`
  ).bind(user.id, key, value, updatedAt).run();
  return json({ ok: true, saved: (res.meta?.changes ?? 1) > 0 });
}

async function track(req, env, user) {
  const b = await readJson(req, 500);
  const page = cleanText(b.page, 24).toLowerCase();
  if (!/^[a-z-]{2,24}$/.test(page)) return json({ ok: true });
  if (!(await rateLimit(env, `track:${await ipKey(req)}`, 300, 3600))) return json({ ok: true });
  const d = today();
  const stmts = [env.DB.prepare(
    `INSERT INTO page_views(day, page, count) VALUES(?1, ?2, 1) ON CONFLICT(day, page) DO UPDATE SET count = count + 1`
  ).bind(d, page)];
  if (user) {
    stmts.push(env.DB.prepare(`INSERT OR IGNORE INTO activity(day, user_id) VALUES(?1, ?2)`).bind(d, user.id));
    stmts.push(env.DB.prepare(`UPDATE users SET last_active = ?1 WHERE id = ?2`).bind(now(), user.id));
  }
  await env.DB.batch(stmts);
  return json({ ok: true });
}

async function trackCompany(req, env) {
  const b = await readJson(req, 300);
  const sym = String(b.symbol || "").toUpperCase();
  if (!/^[A-Z0-9.\-]{1,20}$/.test(sym)) return json({ ok: true });
  if (!(await rateLimit(env, `co:${await ipKey(req)}`, 200, 3600))) return json({ ok: true });
  await env.DB.prepare(
    `INSERT INTO company_views(day, symbol, count) VALUES(?1, ?2, 1) ON CONFLICT(day, symbol) DO UPDATE SET count = count + 1`
  ).bind(today(), sym).run();
  return json({ ok: true });
}

async function quiz(req, env, user) {
  const b = await readJson(req, 500);
  const kind = b.kind === "after" ? "after" : b.kind === "before" ? "before" : null;
  const total = Math.floor(Number(b.total));
  const score = Math.floor(Number(b.score));
  if (!kind || !(total > 0 && total <= 50) || !(score >= 0 && score <= total)) return err(400, "bad_quiz", "Bad quiz result.");
  await env.DB.prepare(`INSERT INTO quiz_attempts(user_id, kind, score, total, created_at) VALUES(?1, ?2, ?3, ?4, ?5)`)
    .bind(user.id, kind, score, total, now()).run();
  return json({ ok: true });
}

async function feedback(req, env, user) {
  const b = await readJson(req, 4000);
  const rating = Math.floor(Number(b.rating));
  if (!(rating >= 1 && rating <= 5)) return err(400, "bad_rating", "Pick a rating from 1 to 5.");
  if (!(await rateLimit(env, `fb:${user ? user.id : await ipKey(req)}`, 10, 3600))) return err(429, "slow_down", "Thanks! You've already sent feedback recently.");
  await env.DB.prepare(`INSERT INTO feedback(user_id, rating, comment, created_at) VALUES(?1, ?2, ?3, ?4)`)
    .bind(user ? user.id : null, rating, cleanText(b.comment, 1000), now()).run();
  return json({ ok: true });
}

async function contact(req, env, user) {
  const b = await readJson(req, 8000);
  if (b.website) return json({ ok: true }); // hidden field that only bots fill in
  const name = cleanText(b.name, 80);
  const email = cleanEmail(b.email);
  const topic = ["question", "feedback", "school", "bug", "privacy", "other"].includes(b.topic) ? b.topic : "other";
  const body = cleanText(b.message, 3000);
  if (!email) return err(400, "bad_email", "Enter an email address so we can reply.");
  if (body.length < 5) return err(400, "short", "Write a little more in your message.");
  if (!(await rateLimit(env, `contact:${await ipKey(req)}`, 5, 3600))) return err(429, "slow_down", "You've sent a few messages already. Try again later.");
  await env.DB.prepare(`INSERT INTO messages(user_id, name, email, topic, body, created_at) VALUES(?1, ?2, ?3, ?4, ?5, ?6)`)
    .bind(user ? user.id : null, name, email, topic, body, now()).run();
  if (env.CONTACT_EMAIL) {
    await sendEmail(env, {
      to: env.CONTACT_EMAIL, replyTo: email, subject: `Pocket Money message: ${topic}`,
      text: `From: ${name} <${email}>\nTopic: ${topic}\n\n${body}`,
    }).catch(() => {});
  }
  return json({ ok: true });
}

async function exportMine(env, user) {
  const q = (sql) => env.DB.prepare(sql).bind(user.id).all().then((r) => r.results);
  const data = {
    exportedAt: new Date().toISOString(),
    account: { name: user.name, email: user.email, ageBand: user.age_band, parentConsent: !!user.parent_consent,
      signedUpWithGoogle: !!user.google_sub, createdAt: new Date(user.created_at * 1000).toISOString(),
      lastActive: new Date(user.last_active * 1000).toISOString() },
    savedData: Object.fromEntries((await q(`SELECT key, value FROM user_state WHERE user_id = ?1`)).map((r) => [r.key, JSON.parse(r.value)])),
    quizAttempts: await q(`SELECT kind, score, total, created_at FROM quiz_attempts WHERE user_id = ?1`),
    feedback: await q(`SELECT rating, comment, created_at FROM feedback WHERE user_id = ?1`),
    messages: await q(`SELECT topic, body, created_at FROM messages WHERE user_id = ?1`),
    daysActive: (await q(`SELECT day FROM activity WHERE user_id = ?1`)).map((r) => r.day),
  };
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "content-type": "application/json", "content-disposition": 'attachment; filename="my-pocket-money-data.json"', "cache-control": "no-store" },
  });
}

// ---------- founder page content ----------
async function getContent(env, key) {
  const r = await env.DB.prepare(`SELECT value, updated_at FROM site_content WHERE key = ?1`).bind(key).first();
  return json({ value: r ? JSON.parse(r.value) : null, updatedAt: r?.updated_at || null }, 200, { "cache-control": "public, max-age=60" });
}
async function putFounder(req, env) {
  const b = await readJson(req, 600_000);
  const url = (v) => { const s = cleanText(v, 300); return /^https:\/\/[^\s"'<>]+$/i.test(s) ? s : ""; };
  const photo = typeof b.photo === "string" && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(b.photo) && b.photo.length < 500_000 ? b.photo : "";
  const value = {
    name: cleanText(b.name, 60), role: cleanText(b.role, 80), business: cleanText(b.business, 60),
    headline: cleanText(b.headline, 160), bio: cleanText(b.bio, 4000), photo,
    links: { instagram: url(b.links?.instagram), youtube: url(b.links?.youtube), linkedin: url(b.links?.linkedin), website: url(b.links?.website) },
    publicEmail: cleanEmail(b.publicEmail) || "",
  };
  await env.DB.prepare(`INSERT INTO site_content(key, value, updated_at) VALUES('founder', ?1, ?2)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`).bind(JSON.stringify(value), now()).run();
  return json({ ok: true, value });
}

// ---------- admin ----------
function daysBack(n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(new Date(Date.now() - i * DAY * 1000).toISOString().slice(0, 10));
  return out;
}
// Keeps the promises in the privacy policy: messages kept 12 months, accounts unused for 24 months deleted.
async function housekeeping(env) {
  const t = now();
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM messages WHERE created_at < ?1`).bind(t - 365 * DAY),
    env.DB.prepare(`DELETE FROM rate_limits WHERE window_start < ?1`).bind(t - 2 * DAY),
    env.DB.prepare(`DELETE FROM sessions WHERE expires_at < ?1`).bind(t),
  ]);
  const { results } = await env.DB.prepare(`SELECT id FROM users WHERE last_active < ?1 LIMIT 50`).bind(t - 730 * DAY).all();
  for (const u of results) await deleteUser(env, u.id);
}
async function adminOverview(env) {
  await housekeeping(env);
  const t = now();
  const since30 = daysBack(30)[0];
  const one = (sql, ...a) => env.DB.prepare(sql).bind(...a).first();
  const all = (sql, ...a) => env.DB.prepare(sql).bind(...a).all().then((r) => r.results);
  const [users, new7, active7, active30, views30, signups, views, dau, companies, unread] = await Promise.all([
    one(`SELECT COUNT(*) n FROM users`),
    one(`SELECT COUNT(*) n FROM users WHERE created_at > ?1`, t - 7 * DAY),
    one(`SELECT COUNT(*) n FROM users WHERE last_active > ?1`, t - 7 * DAY),
    one(`SELECT COUNT(*) n FROM users WHERE last_active > ?1`, t - 30 * DAY),
    one(`SELECT COALESCE(SUM(count),0) n FROM page_views WHERE day >= ?1`, since30),
    all(`SELECT date(created_at, 'unixepoch') day, COUNT(*) n FROM users WHERE created_at > ?1 GROUP BY day`, t - 30 * DAY),
    all(`SELECT page, SUM(count) n FROM page_views WHERE day >= ?1 GROUP BY page ORDER BY n DESC`, since30),
    all(`SELECT day, COUNT(*) n FROM activity WHERE day >= ?1 GROUP BY day`, since30),
    all(`SELECT symbol, SUM(count) n FROM company_views WHERE day >= ?1 GROUP BY symbol ORDER BY n DESC LIMIT 10`, since30),
    one(`SELECT COUNT(*) n FROM messages WHERE handled = 0`),
  ]);
  const days = daysBack(30);
  const byDay = (rows) => { const m = Object.fromEntries(rows.map((r) => [r.day, r.n])); return days.map((d) => m[d] || 0); };
  const viewsByDay = await all(`SELECT day, SUM(count) n FROM page_views WHERE day >= ?1 GROUP BY day`, since30);
  return json({
    totals: { users: users.n, new7: new7.n, active7: active7.n, active30: active30.n, views30: views30.n, unread: unread.n },
    days, signups: byDay(signups), dau: byDay(dau), views: byDay(viewsByDay), pages: views, companies,
  });
}

function parseState(rows, key) {
  const out = {};
  for (const r of rows) if (r.key === key) { try { out[r.user_id] = JSON.parse(r.value); } catch {} }
  return out;
}
async function userStats(env) {
  const { results: states } = await env.DB.prepare(`SELECT user_id, key, value FROM user_state WHERE key IN ('lessons','money','pf')`).all();
  const lessons = parseState(states, "lessons"), money = parseState(states, "money"), pf = parseState(states, "pf");
  const { results: q } = await env.DB.prepare(`SELECT user_id, kind, score, total, created_at FROM quiz_attempts ORDER BY created_at`).all();
  const quiz = {};
  for (const a of q) {
    const s = (quiz[a.user_id] ||= {});
    if (a.kind === "before" && !s.before) s.before = a;  // first "before" attempt
    if (a.kind === "after") s.after = a;                  // latest "after" attempt
  }
  return { lessons, money, pf, quiz };
}
async function adminImpact(env) {
  const { lessons, money, pf, quiz } = await userStats(env);
  const lessonCounts = {};
  for (const l of Object.values(lessons)) for (const k of Object.keys(l?.done || {})) if (l.done[k]) lessonCounts[k] = (lessonCounts[k] || 0) + 1;
  const pairs = Object.values(quiz).filter((s) => s.before && s.after);
  const pct = (a) => a.score / a.total;
  const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const fb = await env.DB.prepare(`SELECT rating, comment, created_at FROM feedback ORDER BY created_at DESC LIMIT 500`).all();
  const ratings = fb.results.map((r) => r.rating);
  return json({
    quiz: {
      tookBefore: Object.values(quiz).filter((s) => s.before).length,
      tookBoth: pairs.length,
      avgBefore: avg(pairs.map((s) => pct(s.before))),
      avgAfter: avg(pairs.map((s) => pct(s.after))),
      improved: pairs.filter((s) => pct(s.after) > pct(s.before)).length,
    },
    lessonCounts,
    tools: {
      moneyUsers: Object.values(money).filter((m) => (m?.tx || []).length > 0).length,
      goalUsers: Object.values(money).filter((m) => (m?.goals || []).length > 0).length,
      portfolioUsers: Object.values(pf).filter((p) => (p?.hist || []).length > 1).length,
    },
    feedback: { count: ratings.length, avg: avg(ratings), recent: fb.results.filter((r) => r.comment).slice(0, 25) },
  });
}
async function adminUsers(env, url) {
  const q = cleanText(url.searchParams.get("q"), 60).toLowerCase();
  const { results } = await env.DB.prepare(
    `SELECT id, name, email, age_band, parent_consent, google_sub IS NOT NULL AS google, created_at, last_active FROM users
     WHERE ?1 = '' OR lower(email) LIKE '%' || ?1 || '%' OR lower(name) LIKE '%' || ?1 || '%'
     ORDER BY created_at DESC LIMIT 1000`
  ).bind(q).all();
  const { lessons, money, quiz } = await userStats(env);
  return json({
    users: results.map((u) => ({
      ...u, google: !!u.google,
      lessonsDone: Object.values(lessons[u.id]?.done || {}).filter(Boolean).length,
      moneyEntries: (money[u.id]?.tx || []).length,
      quizBefore: quiz[u.id]?.before ? `${quiz[u.id].before.score}/${quiz[u.id].before.total}` : "",
      quizAfter: quiz[u.id]?.after ? `${quiz[u.id].after.score}/${quiz[u.id].after.total}` : "",
    })),
  });
}
function csv(rows, cols) {
  const cell = (v) => {
    let s = v == null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // stop spreadsheet formula injection
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n");
}
async function adminExport(env, what) {
  let rows, cols;
  const iso = (t) => (t ? new Date(t * 1000).toISOString() : "");
  if (what === "users") {
    const body = await (await adminUsers(env, new URL("http://x/?q="))).json();
    rows = body.users.map((u) => ({ ...u, created_at: iso(u.created_at), last_active: iso(u.last_active) }));
    cols = ["name", "email", "age_band", "parent_consent", "google", "created_at", "last_active", "lessonsDone", "moneyEntries", "quizBefore", "quizAfter"];
  } else if (what === "feedback") {
    rows = (await env.DB.prepare(`SELECT rating, comment, created_at FROM feedback ORDER BY created_at DESC`).all()).results.map((r) => ({ ...r, created_at: iso(r.created_at) }));
    cols = ["created_at", "rating", "comment"];
  } else if (what === "messages") {
    rows = (await env.DB.prepare(`SELECT name, email, topic, body, handled, created_at FROM messages ORDER BY created_at DESC`).all()).results.map((r) => ({ ...r, created_at: iso(r.created_at) }));
    cols = ["created_at", "name", "email", "topic", "body", "handled"];
  } else return err(404, "not_found", "Unknown export");
  return new Response(csv(rows, cols), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="pocket-money-${what}.csv"`, "cache-control": "no-store" },
  });
}

// ---------- router ----------
export async function handleApi(request, env, ctx = {}) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "");
  const method = request.method;
  try {
    if (!env.DB) return err(503, "no_db", "The database isn't connected yet. See the setup guide (step: add a D1 binding called DB).");

    // Block cross-site form/fetch submissions for anything that changes data.
    if (method !== "GET" && method !== "HEAD") {
      const origin = request.headers.get("origin");
      if (origin && origin !== url.origin) return err(403, "bad_origin", "Request blocked.");
      const ct = request.headers.get("content-type") || "";
      const isForm = path === "/api/auth/email/verify";
      if (!isForm && method !== "DELETE" && !ct.includes("application/json")) return err(415, "json_only", "Send JSON.");
      if (!origin && !isForm && !request.headers.get("x-pm")) return err(403, "bad_origin", "Request blocked.");
    }

    await ensureSchema(env);

    // Public stock data (no account needed)
    let m = path.match(/^\/api\/stock\/([A-Za-z0-9.\-]{1,20})\/(prices|financials)$/);
    if (m && method === "GET") {
      const sym = m[1].toUpperCase();
      const fn = m[2] === "prices" ? getPrices : getFinancials;
      return json(await fn(sym, env, ctx), 200, { "cache-control": "public, max-age=3600" });
    }
    if (path.startsWith("/api/stock/")) return err(404, "not_found", "Unknown company symbol.");
    if (path === "/api/config" && method === "GET") {
      return json({ google: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET), email: !!(env.RESEND_API_KEY && env.EMAIL_FROM),
        dev: env.DEV_INSECURE_LOGIN === "1" && ["localhost", "127.0.0.1"].includes(url.hostname),
        priceLagDays: Number(env.PRICE_LAG_DAYS || 30) });
    }
    if (path === "/api/content/founder" && method === "GET") return getContent(env, "founder");
    if (path === "/api/auth/email/start" && method === "POST") return emailStart(request, env, url);
    if (path === "/api/auth/email/verify") return emailVerify(request, env, url);
    if (path === "/api/auth/google/start" && method === "GET") return googleStart(request, env, url);
    if (path === "/api/auth/google/callback" && method === "GET") return googleCallback(request, env, url);
    if (path === "/api/auth/dev" && method === "GET") return devLogin(request, env, url);

    const user = await currentUser(request, env);
    if (path === "/api/me" && method === "GET") return json({ user: publicUser(user, env) });
    if (path === "/api/track" && method === "POST") return track(request, env, user);
    if (path === "/api/track/company" && method === "POST") return trackCompany(request, env);
    if (path === "/api/contact" && method === "POST") return contact(request, env, user);
    if (path === "/api/feedback" && method === "POST") return feedback(request, env, user);
    if (path === "/api/auth/logout" && method === "POST") {
      const token = parseCookies(request)[COOKIE];
      if (token) await env.DB.prepare(`DELETE FROM sessions WHERE token_hash = ?1`).bind(await sha256(token)).run();
      return json({ ok: true }, 200, { "set-cookie": cookie(COOKIE, "", 0) });
    }

    if (!user) return err(401, "signed_out", "Sign in first.");
    if (path === "/api/auth/logout-everywhere" && method === "POST") {
      await env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?1`).bind(user.id).run();
      return json({ ok: true }, 200, { "set-cookie": cookie(COOKIE, "", 0) });
    }
    if (path === "/api/me/profile" && method === "POST") return updateProfile(request, env, user);
    if (path === "/api/me/export" && method === "GET") return exportMine(env, user);
    if (path === "/api/me" && method === "DELETE") {
      await deleteUser(env, user.id);
      return json({ ok: true }, 200, { "set-cookie": cookie(COOKIE, "", 0) });
    }
    if (path === "/api/state" && method === "GET") return getState(env, user);
    m = path.match(/^\/api\/state\/([a-z]+)$/);
    if (m && method === "PUT") return putState(request, env, user, m[1]);
    if (path === "/api/quiz" && method === "POST") return quiz(request, env, user);

    // Admin only
    if (path.startsWith("/api/admin") || (path === "/api/content/founder" && method === "PUT")) {
      if (!adminEmails(env).includes(user.email)) return err(403, "not_admin", "Admins only.");
      if (path === "/api/content/founder") return putFounder(request, env);
      if (path === "/api/admin/overview") return adminOverview(env);
      if (path === "/api/admin/impact") return adminImpact(env);
      if (path === "/api/admin/users" && method === "GET") return adminUsers(env, url);
      m = path.match(/^\/api\/admin\/users\/([0-9a-f-]{36})$/);
      if (m && method === "DELETE") { await deleteUser(env, m[1]); return json({ ok: true }); }
      if (path === "/api/admin/messages" && method === "GET") {
        const { results } = await env.DB.prepare(`SELECT id, name, email, topic, body, created_at, handled FROM messages ORDER BY handled, created_at DESC LIMIT 300`).all();
        return json({ messages: results });
      }
      m = path.match(/^\/api\/admin\/messages\/(\d+)$/);
      if (m && method === "POST") {
        const b = await readJson(request, 200);
        await env.DB.prepare(`UPDATE messages SET handled = ?1 WHERE id = ?2`).bind(b.handled ? 1 : 0, Number(m[1])).run();
        return json({ ok: true });
      }
      m = path.match(/^\/api\/admin\/export\/(users|feedback|messages)$/);
      if (m && method === "GET") return adminExport(env, m[1]);
    }
    return err(404, "not_found", "Not found");
  } catch (e) {
    if (e?.status) return err(e.status, "bad_request", "That request couldn't be read.");
    console.log("API error", path, e?.stack || e);
    return err(500, "server_error", "Something went wrong on our side. Try again in a moment.");
  }
}
