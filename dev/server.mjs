// Local test server: serves public/ and runs the API with a SQLite file standing in for D1.
//   node dev/server.mjs            (PORT, ADMIN_EMAILS etc. come from the environment)
// MOCK_UPSTREAM=1 replaces Yahoo / Google / Resend with fake responses, for automated tests.
import http from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeD1 } from "./d1shim.mjs";
import { handleApi } from "../server/api.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT || 8787);
const env = {
  DB: makeD1(process.env.DB_FILE || ":memory:"),
  ADMIN_EMAILS: process.env.ADMIN_EMAILS || "admin@example.com",
  DEV_INSECURE_LOGIN: process.env.DEV_INSECURE_LOGIN ?? "1",
  PRICE_LAG_DAYS: process.env.PRICE_LAG_DAYS || "30",
};
if (process.env.MOCK_UPSTREAM === "1") {
  Object.assign(env, { GOOGLE_CLIENT_ID: "test-client", GOOGLE_CLIENT_SECRET: "test-secret", RESEND_API_KEY: "test", EMAIL_FROM: "Pocket Money <hi@example.com>", CONTACT_EMAIL: "owner@example.com" });
  const outbox = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;
    if (url.includes("/v8/finance/chart/")) {
      const sym = decodeURIComponent(url.split("/chart/")[1].split("?")[0]);
      if (sym === "NOPE") return new Response("{}", { status: 404 });
      const now = Math.floor(Date.now() / 1000), ts = [], close = [];
      let p = 100;
      for (let i = 260; i >= 0; i--) { ts.push(now - i * 7 * 86400); p *= 1 + 0.003 + 0.04 * Math.sin(i * 1.7); close.push(+p.toFixed(2)); }
      return Response.json({ chart: { result: [{ meta: { currency: sym.endsWith(".NS") ? "INR" : "USD", exchangeName: "TEST" }, timestamp: ts, indicators: { quote: [{ close }], adjclose: [{ adjclose: close }] } }] } });
    }
    if (url.includes("fundamentals-timeseries")) {
      const yrs = ["2022-12-31", "2023-12-31", "2024-12-31", "2025-12-31"];
      const mk = (type, vals) => ({ meta: { type: [type] }, [type]: yrs.map((d, i) => ({ asOfDate: d, currencyCode: "USD", reportedValue: { raw: vals[i] } })) });
      return Response.json({ timeseries: { result: [mk("annualTotalRevenue", [81e9, 96e9, 97e9, 98e9]), mk("annualNetIncome", [12e9, 15e9, 7e9, -1e9])] } });
    }
    if (url.startsWith("https://api.resend.com/")) {
      outbox.push(JSON.parse(init.body)); await writeFile(path.join(root, "dev/outbox.json"), JSON.stringify(outbox, null, 1));
      return Response.json({ id: "x" });
    }
    if (url.startsWith("https://oauth2.googleapis.com/token")) {
      const code = new URLSearchParams(init.body).get("code");
      const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
      const claims = { iss: "https://accounts.google.com", aud: "test-client", exp: Math.floor(Date.now() / 1000) + 600, sub: "g-" + code, email: `${code}@gmail.com`, email_verified: true, given_name: "Gina" };
      return Response.json({ id_token: `${b({ alg: "none" })}.${b(claims)}.sig` });
    }
    return realFetch(input, init);
  };
}

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".txt": "text/plain", ".pdf": "application/pdf" };

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    if (url.pathname.startsWith("/api/")) {
      const chunks = []; for await (const c of req) chunks.push(c);
      const body = chunks.length ? Buffer.concat(chunks) : undefined;
      const request = new Request(url, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : body });
      const r = await handleApi(request, env, { waitUntil: () => {} });
      const headers = {};
      r.headers.forEach((v, k) => { if (k !== "set-cookie") headers[k] = v; });
      const sc = r.headers.getSetCookie?.() || [];
      if (sc.length) headers["set-cookie"] = sc;
      res.writeHead(r.status, headers);
      res.end(Buffer.from(await r.arrayBuffer()));
      return;
    }
    let p = path.join(root, "public", decodeURIComponent(url.pathname));
    if (!p.startsWith(path.join(root, "public"))) { res.writeHead(403); return res.end(); }
    if (url.pathname.endsWith("/")) p = path.join(p, "index.html");
    if (!existsSync(p)) { res.writeHead(404, { "content-type": "text/plain" }); return res.end("Not found"); }
    res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream", "cache-control": "no-cache" });
    res.end(await readFile(p));
  } catch (e) { console.error(e); res.writeHead(500); res.end("error"); }
}).listen(PORT, () => console.log(`Pocket Money running at http://localhost:${PORT}`));
