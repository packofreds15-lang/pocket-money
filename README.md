# Pocket Money

Free money and investing lessons for teens: a pocket money tracker, a practice portfolio, research on 8,800+ real US and Indian companies, a before-and-after quiz, accounts, and an admin panel.

It runs on **Cloudflare Workers** (the website, from `wrangler.jsonc` + `worker.js`) with a **Cloudflare D1** database. It also works on Cloudflare Pages via `functions/`. Both are free at this size.

---

## Set it up (about 30 minutes, all in your browser)

### 1. Put the code on GitHub
The code needs to be in your GitHub repository (`pocket-money`). Cloudflare reads it from there, and every change you make on GitHub updates the live site automatically.

### 2. Create the website on Cloudflare
1. In **dash.cloudflare.com**, go to **Workers & Pages → Create → Import a repository** and pick `pocket-money`.
2. On "Set up your application":
   - **Build command:** leave empty
   - **Deploy command:** `npx wrangler deploy`
   - **Preview command:** `npx wrangler versions upload`
3. Click **Deploy**. Your site goes live at an address like `pocket-money.<your-name>.workers.dev`.

`wrangler.jsonc` already connects the site to the D1 database `pocket-money-db`. If you ever create a new database, put its ID in that file. The database tables are created automatically on the first visit.

### 3. (Nothing to do for the database)
The database binding called `DB` is set in `wrangler.jsonc`, so there's no separate step.

### 4. Make yourself the admin
In your Worker → **Settings → Variables and Secrets → Add**:

| Name | Value |
|---|---|
| `ADMIN_EMAILS` | the email you'll sign in with, e.g. `you@gmail.com` (separate several with commas) |

Variables take effect straight away; `keep_vars` in `wrangler.jsonc` stops later deploys from wiping them.

### 5. Turn on sign-in (do one or both)

**Continue with Google** (free)
1. Go to **console.cloud.google.com**, create a project called *Pocket Money*.
2. Open **Google Auth Platform** (called "OAuth consent screen" in some versions). Set it up as **External**, with the app name *Pocket Money* and your email as the support email.
3. Under **Clients**, choose **Create client → Web application**. Under **Authorised redirect URIs**, add:
   - `https://pocket-money.YOUR-NAME.workers.dev/api/auth/google/callback` (use your real workers.dev address)
   - `https://YOUR-DOMAIN/api/auth/google/callback` once you have a domain
4. Copy the **Client ID** and **Client secret** into Cloudflare variables `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Click **Encrypt** on the secret.
5. Set the app's publishing status to **In production**. Without this, only test users you list can sign in. Pocket Money only asks for name and email, which doesn't need Google's review.

**Email me a sign-in link** (free up to 3,000 emails a month)
1. Sign up at **resend.com** and add your domain under **Domains**. Resend can add the DNS records to Cloudflare for you.
2. Create an API key.
3. Add Cloudflare variables:
   - `RESEND_API_KEY`: the key (click **Encrypt**)
   - `EMAIL_FROM`: e.g. `Pocket Money <hello@your-domain.com>` (must use the domain you verified)
   - `CONTACT_EMAIL` (optional): where contact-form messages get emailed to you. They always appear in the admin panel too.

Email sign-in needs your own domain. Until you have one, use Google sign-in.

### 6. Add your domain (optional)
Your Worker → **Settings → Domains & Routes → Add → Custom domain**. Then add the new address to Google's redirect URIs (step 5).

### 7. Fill in your founder page
Sign in with your admin email. Open **Me → Open admin panel → Founder page**, add your photo, bio and social links, then click **Save**.

---

## Everyday use
- **Admin panel:** sign in, then open the **Me** page and choose **Open admin panel**. It has these tabs:
  - **Overview:** users, active users and page views
  - **Impact:** average before and after quiz scores, lessons completed, and feedback
  - **Users:** everyone with an account
  - **Messages:** your contact-form inbox
  - **Founder page:** edit your photo, bio and links
  - CSV downloads are available in the Impact, Users and Messages tabs.
- **Changing text or features:** edit the files in `src/` (app code) or `public/index.html` (page text and legal pages), then run `python3 tools/build_site.py` to rebuild `public/app.js`. Or ask Claude.

## Before a bigger public launch
- **Legal review.** The privacy policy, terms, cookie policy and disclaimer are plain-language starting points, not legal advice. Have an adult, ideally a lawyer, review them, and add your full name or business details as the data controller.
- **India's DPDP rules for children** apply in full from **14 May 2027**. They require *verifiable* parental consent for under-18s. Right now teens tick a box confirming a parent agrees, which is fine for testing with friends. Before wider launch, add a stronger check, such as emailing the parent to confirm.
- **Market data licence.** Prices and financials come from Yahoo Finance's public endpoints, which aren't an official API. That's OK for testing. For a large public launch, switch to a licensed data provider; only `server/stocks.js` needs changing.
- **SEBI:** keep prices delayed by at least 30 days (`PRICE_LAG_DAYS`, default 30), and never give stock tips or claim returns.

## Settings reference
| Variable | Needed for | Notes |
|---|---|---|
| `DB` (binding) | Accounts, saving, admin | D1 database binding |
| `ADMIN_EMAILS` | Admin panel | Comma-separated |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in | |
| `RESEND_API_KEY`, `EMAIL_FROM` | Email sign-in links, contact emails | |
| `CONTACT_EMAIL` | Contact notifications | Optional |
| `PRICE_LAG_DAYS` | Research charts | Default and minimum 30 |
| `DEV_INSECURE_LOGIN` | Local testing only | Never set on the live site; only works on localhost anyway |

## How it's built
- `public/`: the website (HTML, CSS, `app.js`, fonts, icons, company data). Works offline and installs as an app.
- `src/`: app code, joined into `public/app.js` by `tools/build_site.py`
- `functions/api/[[path]].js` and `server/`: the API (login, saving, admin, stock data)
- `public/data/`: search index for 5,802 US and 3,029 NSE companies (as of 8 Oct 2026), rebuilt with `tools/build_data.py`
- `dev/`: local test server using Node's built-in SQLite in place of D1, plus automated tests

### Run it on your computer
Needs Node.js 22 or newer.
```
node dev/server.mjs                       # http://localhost:8787 (in-memory database)
ADMIN_EMAILS=you@example.com node dev/server.mjs
```
Use **Sign in → Test sign-in** with any email. Run the tests with:
```
PORT=8799 MOCK_UPSTREAM=1 node dev/server.mjs &
BASE=http://localhost:8799 node dev/test-api.mjs
python3 dev/test-ui.py        # needs Playwright
```

## Credits
Fonts: Atkinson Hyperlegible and Bricolage Grotesque (SIL Open Font License, see `public/fonts`). Company list: Nasdaq stock screener via US-Stock-Symbols; descriptions: FinanceDatabase (MIT); S&P 500 list: datasets/s-and-p-500-companies.
