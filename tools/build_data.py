"""Builds the company search data for Pocket Money.

Inputs (cloned public datasets):
  US-Stock-Symbols  - every NYSE / Nasdaq / NYSE American stock (Nasdaq screener snapshot)
  FinanceDatabase   - company descriptions, sectors and industries (US + NSE India)
  s-and-p-500       - S&P 500 membership
Outputs:
  public/data/index.json      - compact search index
  public/data/desc/NN.json    - descriptions, split into 64 small files loaded on demand
"""
import csv, json, re, sys, zlib, os
from datetime import date
csv.field_size_limit(10**8)
SRC, OUT, ASOF = sys.argv[1], sys.argv[2], sys.argv[3]
NSHARD = 64

def fd(name):
    return list(csv.DictReader(open(f"{SRC}/fdb/database/equities/{name}.csv", encoding="utf-8")))

fd_us = {}
for ex in ["NYQ", "NMS", "NGM", "NCM", "ASE", "PCX"]:
    for r in fd(ex):
        if r["delisted"] not in ("True", "true", "1"):
            fd_us.setdefault(r["symbol"], r)

sp = {r["Symbol"].replace(".", "-") for r in csv.DictReader(open(f"{SRC}/sp500/data/constituents.csv"))}

NASDAQ_SECTOR = {"Technology": "Information Technology", "Finance": "Financials", "Telecommunications": "Communication Services",
                 "Basic Materials": "Materials", "Miscellaneous": "Other", "Health Care": "Health Care",
                 "Consumer Discretionary": "Consumer Discretionary", "Consumer Staples": "Consumer Staples",
                 "Energy": "Energy", "Industrials": "Industrials", "Real Estate": "Real Estate", "Utilities": "Utilities"}
FD_SIZE = {"Mega Cap": "mega", "Large Cap": "large", "Mid Cap": "mid", "Small Cap": "small", "Micro Cap": "micro", "Nano Cap": "nano"}
SIZES = ["mega", "large", "mid", "small", "micro", "nano", ""]

def size_from_cap(c):
    try: c = float(c)
    except: return ""
    if c <= 0: return ""
    return ("mega" if c >= 200e9 else "large" if c >= 10e9 else "mid" if c >= 2e9 else
            "small" if c >= 300e6 else "micro" if c >= 50e6 else "nano")

SKIP = re.compile(r"\b(warrants?|units?|rights?|preferred|depositary shares,? each|notes due|debentures|subordinated|trust preferred|% )", re.I)
def clean_name(n):
    n = n.strip()
    adr = bool(re.search(r"American Depositary|\bADS\b|\bADR\b", n, re.I))
    n = re.sub(r"\s+(American Depositary (Shares|Receipts?)|Common Stock|Common Shares|Ordinary Shares|Class [A-Z] Ordinary Shares|Sponsored ADR|ADS|New)\b.*$", "", n, flags=re.I)
    n = re.sub(r"\s+Class ([A-Z])\b\s*$", r" (Class \1)", n)
    n = re.sub(r"\s{2,}", " ", n).strip(" ,")
    return n + (" (ADR)" if adr else "")

def short_summary(s, limit=520):
    s = re.sub(r"\s+", " ", (s or "")).strip()
    if len(s) <= limit: return s
    cut = s[:limit]
    i = cut.rfind(". ")
    return cut[: i + 1] if i > 150 else cut.rsplit(" ", 1)[0] + "…"

sectors, industries = [], []
def idx(lst, v):
    v = v or ""
    if v not in lst: lst.append(v)
    return lst.index(v)

rows, desc = [], {}
seen = set()
EXNAME = {"nyse": "NYSE", "nasdaq": "Nasdaq", "amex": "NYSE American"}
for ex in ["nasdaq", "nyse", "amex"]:
    for r in json.load(open(f"{SRC}/US-Stock-Symbols/{ex}/{ex}_full_tickers.json")):
        sym = r["symbol"].strip()
        if not sym or "^" in sym or SKIP.search(r["name"]): continue
        ysym = sym.replace("/", "-")
        if ysym in seen: continue
        seen.add(ysym)
        f = fd_us.get(ysym, {})
        sector = f.get("sector") or NASDAQ_SECTOR.get(r.get("sector", ""), r.get("sector", "") or "")
        industry = f.get("industry") or r.get("industry", "")
        size = size_from_cap(r.get("marketCap")) or FD_SIZE.get(f.get("market_cap", ""), "")
        tags = 1 if ysym in sp else 0
        rows.append([ysym, sym.replace("/", "."), clean_name(r["name"]), "US", EXNAME[ex], idx(sectors, sector),
                     idx(industries, industry), SIZES.index(size), tags, r.get("ipoyear") or ""])
        if f.get("summary"):
            desc[ysym] = {"d": short_summary(f["summary"]), "w": f.get("website", ""),
                          "c": ", ".join(x for x in [f.get("city"), f.get("country")] if x)}
        elif r.get("country"):
            desc[ysym] = {"d": "", "w": "", "c": r["country"]}

n_us = len(rows)
for r in fd("NSE"):
    if r["delisted"] in ("True", "true", "1") or not r["symbol"].endswith(".NS"): continue
    ysym = r["symbol"]; sym = ysym[:-3]
    if ysym in seen: continue
    seen.add(ysym)
    rows.append([ysym, sym, r["name"].strip(), "IN", "NSE", idx(sectors, r["sector"]), idx(industries, r["industry"]),
                 SIZES.index(FD_SIZE.get(r["market_cap"], "")), 0, ""])
    desc[ysym] = {"d": short_summary(r["summary"]), "w": r.get("website", ""),
                  "c": ", ".join(x for x in [r.get("city"), r.get("country")] if x)}

# Sort: bigger companies first so search results put well-known names on top
size_rank = lambda r: (r[7] if r[7] != 6 else 9)
rows.sort(key=lambda r: (size_rank(r), -r[8], r[1]))

POPULAR = {"US": ["AAPL", "TSLA", "NVDA", "MSFT", "GOOGL", "AMZN", "META", "NFLX", "DIS", "NKE", "KO", "MCD", "SPOT", "RBLX", "IBM", "SPCX"],
           "IN": ["RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFCBANK.NS", "TMPV.NS", "ETERNAL.NS", "NYKAA.NS", "ASIANPAINT.NS",
                  "ITC.NS", "TITAN.NS", "MARUTI.NS", "BHARTIARTL.NS", "SWIGGY.NS", "IRCTC.NS"]}
have = {r[0] for r in rows}
POPULAR = {k: [s for s in v if s in have] for k, v in POPULAR.items()}
missing = {k: [s for s in v if s not in have] for k, v in {"US": ["SPCX", "IBM", "TSLA"]}.items()}

index = {"asof": ASOF, "sizes": SIZES, "sectors": sectors, "industries": industries, "popular": POPULAR,
         "fields": ["yahoo", "symbol", "name", "market", "exchange", "sector", "industry", "size", "sp500", "ipo"],
         "rows": rows}
os.makedirs(f"{OUT}/desc", exist_ok=True)
json.dump(index, open(f"{OUT}/index.json", "w"), separators=(",", ":"), ensure_ascii=False)
shards = [dict() for _ in range(NSHARD)]
for k, v in desc.items():
    shards[zlib.crc32(k.encode()) % NSHARD][k] = v
for i, s in enumerate(shards):
    json.dump(s, open(f"{OUT}/desc/{i:02d}.json", "w"), separators=(",", ":"), ensure_ascii=False)
print(f"US {n_us}, India {len(rows)-n_us}, total {len(rows)}, with descriptions {sum(1 for v in desc.values() if v['d'])}")
print("sectors", len(sectors), "industries", len(industries), "S&P500 tagged", sum(r[8] for r in rows))
print("popular", POPULAR, "missing", missing)
print("index bytes", os.path.getsize(f"{OUT}/index.json"))
