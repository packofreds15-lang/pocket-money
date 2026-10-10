// Real-company price history and yearly financials for the Research page.
//
// Data source: Yahoo Finance's public chart and fundamentals endpoints (no key needed).
// These aren't an official, licensed API: they're fine for testing with a small group,
// but before a big public launch switch to a licensed data provider. Only this file needs changing.
//
// Prices are delayed by PRICE_LAG_DAYS (default 30) because SEBI's rule for investor-education
// platforms (in force from 1 July 2026) is not to use market price data from the preceding 30 days.

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const HOUR = 3600;

async function cachedFetchJson(url, ttl, ctx) {
  const cache = typeof caches !== "undefined" ? caches.default : null;
  const key = new Request(url);
  if (cache) {
    const hit = await cache.match(key).catch(() => null);
    if (hit) return hit.json();
  }
  const r = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" } });
  if (!r.ok) throw Object.assign(new Error(`upstream ${r.status}`), { upstream: r.status });
  const data = await r.json();
  if (cache) {
    const res = new Response(JSON.stringify(data), { headers: { "content-type": "application/json", "cache-control": `public, max-age=${ttl}` } });
    const p = cache.put(key, res).catch(() => {});
    ctx?.waitUntil ? ctx.waitUntil(p) : await p;
  }
  return data;
}

const round = (v) => (v == null || !isFinite(v) ? null : Number(v.toPrecision(6)));

export function parseChart(data, lagDays, nowSec = Date.now() / 1000) {
  const res = data?.chart?.result?.[0];
  if (!res || !Array.isArray(res.timestamp)) return null;
  const closes = res.indicators?.adjclose?.[0]?.adjclose || res.indicators?.quote?.[0]?.close || [];
  const cutoff = nowSec - lagDays * 86400;
  const points = [];
  res.timestamp.forEach((t, i) => {
    const c = closes[i];
    if (t <= cutoff && c != null && isFinite(c) && c > 0) points.push([t, round(c)]);
  });
  return {
    currency: res.meta?.currency || "",
    exchange: res.meta?.fullExchangeName || res.meta?.exchangeName || "",
    points,
    lagDays,
    asOf: points.length ? new Date(points[points.length - 1][0] * 1000).toISOString().slice(0, 10) : null,
  };
}

export async function getPrices(symbol, env, ctx) {
  const lag = Math.max(30, Number(env.PRICE_LAG_DAYS || 30));
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5y&interval=1wk&includePrePost=false&events=div%2Csplit`;
  try {
    const parsed = parseChart(await cachedFetchJson(url, 12 * HOUR, ctx), lag);
    if (!parsed || parsed.points.length < 2) return { ok: false, reason: "no_data" };
    return { ok: true, ...parsed };
  } catch (e) {
    return { ok: false, reason: "unavailable" };
  }
}

export function parseFinancials(data) {
  const results = data?.timeseries?.result || [];
  const years = {};
  let currency = "";
  for (const r of results) {
    const type = r?.meta?.type?.[0];
    const field = type === "annualTotalRevenue" ? "revenue" : type === "annualNetIncome" ? "netIncome" : null;
    if (!field) continue;
    for (const item of r[type] || []) {
      if (!item?.asOfDate || item.reportedValue?.raw == null) continue;
      const y = item.asOfDate.slice(0, 10);
      (years[y] ||= { periodEnd: y })[field] = item.reportedValue.raw;
      currency ||= item.currencyCode || "";
    }
  }
  const list = Object.values(years).filter((y) => y.revenue != null || y.netIncome != null)
    .sort((a, b) => a.periodEnd.localeCompare(b.periodEnd)).slice(-4);
  return { currency, years: list };
}

export async function getFinancials(symbol, env, ctx) {
  const p2 = Math.floor(Date.now() / 1000);
  const url = `https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(symbol)}` +
    `?symbol=${encodeURIComponent(symbol)}&type=annualTotalRevenue,annualNetIncome&period1=1420070400&period2=${p2}`;
  try {
    const f = parseFinancials(await cachedFetchJson(url, 24 * HOUR, ctx));
    if (!f.years.length) return { ok: false, reason: "no_data" };
    return { ok: true, ...f };
  } catch (e) {
    return { ok: false, reason: "unavailable" };
  }
}
