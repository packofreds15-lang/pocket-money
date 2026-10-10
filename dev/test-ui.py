"""Browser tests: run the local server with MOCK_UPSTREAM=1 on port 8799 first."""
import json, re, sys, os
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright
B = "http://localhost:8799"
SHOTS = sys.argv[1] if len(sys.argv) > 1 else "."
fails = []
def check(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)
def outbox(): return json.load(open("dev/outbox.json"))

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width":1280,"height":900})
    pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.on("dialog", lambda d: d.accept())
    pg.goto(B + "/"); pg.wait_for_timeout(800); pg.click("#cookie-ok")
    check(pg.locator("#c-result").inner_text().startswith("₹"), "calculator in rupees: " + pg.locator("#c-result").inner_text())
    pg.screenshot(path=f"{SHOTS}/d-home.png")

    # Lessons
    pg.click("nav.tabs >> text=Learn"); pg.wait_for_timeout(200)
    check("Where money comes from" in pg.inner_text("#lesson"), "money basics first")
    pg.click("#lesson .opt[data-ans='1']"); pg.wait_for_timeout(100)
    check("1 of 8 done" in pg.inner_text("#track-progress-label"), "lesson progress")
    pg.click("[data-track-btn=invest]"); check("What is a stock?" in pg.inner_text("#lesson"), "investing track")

    # Research
    pg.click("nav.tabs >> text=Research"); pg.wait_for_selector("text=Popular in India")
    for q, sym in [("spacex","SPCX"),("tesla","TSLA"),("ibm","IBM"),("reliance","RELIANCE"),("zomato","ETERNAL")]:
        pg.fill("#rs-q", q); pg.wait_for_timeout(350)
        first = pg.locator("#rs-body .result .tk").first.inner_text()
        check(first == sym, f"search '{q}' -> {first}")
    pg.fill("#rs-q", "spacex"); pg.wait_for_timeout(300)
    pg.locator("#rs-body .result").first.click()
    pg.wait_for_selector("#co-price svg"); pg.wait_for_selector("#co-fin svg"); pg.wait_for_timeout(300)
    t = pg.inner_text("#rs-detail")
    check("rockets" in t.lower(), "SpaceX description shown")
    check("Price on" in t and "Revenue growth" in t, "price + financials shown")
    pg.click("#co-star"); check(pg.get_attribute("#co-star","aria-pressed") == "true", "watchlist star")
    pg.screenshot(path=f"{SHOTS}/d-company.png", full_page=True)
    pg.go_back(); pg.wait_for_timeout(300)
    check(pg.input_value("#rs-q") == "spacex", "search kept after going back")
    pg.fill("#rs-q", ""); pg.wait_for_timeout(300)
    check(pg.is_visible("#rs-search") and "Your watchlist" in pg.inner_text("#rs-body"), "back to search with watchlist")
    pg.click("[data-practice=VOLT]"); pg.wait_for_timeout(200)
    check("Made up for practice" in pg.inner_text("#rs-detail"), "practice company page kept")

    # Money tracker with automatic saving + budget
    pg.click("nav.tabs >> text=My money"); pg.wait_for_timeout(200)
    pg.fill("#mm-gname","Headphones"); pg.fill("#mm-gtarget","2400"); pg.click("#mm-gadd")
    pg.click("#mm-settings summary"); pg.fill("#mm-budget","800"); pg.select_option("#mm-autopct","20")
    pg.fill("#mm-ramt","250"); pg.select_option("#mm-rfreq","week"); pg.click("#mm-save-settings"); pg.wait_for_timeout(100)
    check("Next pocket money will be added on Sunday" in pg.inner_text("#mm-smsg"), "settings saved: " + pg.inner_text("#mm-smsg"))
    pg.fill("#mm-amt","1000"); pg.click("#mm-add")
    check("₹200 went straight to Headphones" in pg.inner_text("#mm-msg"), "auto-save 20%: " + pg.inner_text("#mm-msg"))
    pg.click("#mm-out"); pg.fill("#mm-amt","300"); pg.select_option("#mm-cat","Food and snacks"); pg.click("#mm-add")
    stats = pg.inner_text("#mm-stats")
    check("₹500" in stats.split("\n")[0], "balance 1000-300-200 = 500: " + stats.split("\n")[0])
    check("of your ₹800 budget" in pg.inner_text("#mm-breakdown"), "budget meter")
    pg.screenshot(path=f"{SHOTS}/d-money.png", full_page=True)

    # Create account by email (13-17 with consent)
    pg.click("#me-btn"); pg.click("#to-signup")
    pg.click("input[value='13-17']"); check(pg.is_visible("#su-consent-wrap"), "consent box for 13-17")
    pg.fill("#su-name","Asha"); pg.fill("#su-email","asha@example.com"); pg.click("#su-send")
    check("Tick the box" in pg.inner_text("#su-msg") or "parent" in pg.inner_text("#su-msg"), "needs consent first")
    pg.check("#su-consent"); pg.check("#su-terms"); pg.click("#su-send"); pg.wait_for_selector("text=Check your email")
    link = re.search(r"https?://\S+", outbox()[-1]["text"]).group(0)
    pg.click("#dlg-ok"); pg.goto(link); pg.click("button:has-text('Sign in')"); pg.wait_for_timeout(1500)
    check("Asha" in pg.inner_text("#me-btn"), "signed in: " + pg.inner_text("#me-btn"))
    check(pg.url.endswith("#money"), "returned to the page you were on: " + pg.url)
    st = pg.evaluate("fetch('/api/state').then(r=>r.json())")
    check(len(st["state"]["money"]["value"]["tx"]) == 2 and st["state"]["lessons"]["value"]["done"]["money-0"], "device progress uploaded to account")

    # Quiz + feedback
    pg.click("nav.tabs >> text=Quiz"); pg.wait_for_timeout(200)
    for i in range(10): pg.click(f"#quiz .opt[data-q='{i}'][data-o='1']")
    pg.click("#quiz-submit"); pg.wait_for_timeout(300)
    check("You scored" in pg.inner_text("#quiz-msg"), "quiz scored")
    pg.click("[data-star='4']"); pg.fill("#fb-comment","Great for school"); pg.click("#fb-send"); pg.wait_for_selector("text=Thank you!")
    check(True, "feedback sent")

    # Contact
    pg.click("footer >> text=Contact"); pg.fill("#ct-msg","Can my class use this?"); pg.select_option("#ct-topic","school"); pg.click("#ct-send"); pg.wait_for_selector("text=Message sent")
    check(pg.input_value("#ct-email") == "asha@example.com", "contact prefilled with account email")

    # Account page: export, sign out
    pg.click("#me-btn"); pg.wait_for_selector("text=Your data")
    pg.screenshot(path=f"{SHOTS}/d-account.png", full_page=True)
    pg.click("#acct-out"); pg.wait_for_timeout(800)
    check("signed out" in pg.inner_text("#acct-msg").lower(), "sign out")
    check(pg.evaluate("localStorage.getItem('i4t:money')") is None, "device data cleared on sign out")

    # Sign back in on a "new device": progress comes back
    ctx2 = b.new_context(viewport={"width":1280,"height":900}); p2 = ctx2.new_page(); p2.on("pageerror", lambda e: errs.append(str(e)))
    p2.goto(B + "/#money"); p2.wait_for_timeout(500); p2.click("#cookie-ok")
    p2.click("#me-btn"); p2.fill("#si-email","asha@example.com"); p2.click("#si-send"); p2.wait_for_selector("text=Check your email")
    link = re.search(r"https?://\S+", outbox()[-1]["text"]).group(0)
    p2.goto(link); p2.click("button:has-text('Sign in')"); p2.wait_for_timeout(1500)
    check("₹500" in p2.inner_text("#mm-stats").split("\n")[0], "progress synced to second device")
    ctx2.close()

    # Admin
    pg.goto(B + "/api/auth/dev?email=admin@example.com&next=admin"); pg.wait_for_timeout(1000)
    check(pg.is_visible("#su-finish"), "admin asked to finish profile")
    pg.click("input[value='18+']"); pg.check("#su-terms"); pg.fill("#su-name","Tvesha"); pg.click("#su-finish"); pg.wait_for_timeout(600)
    pg.goto(B + "/#admin"); pg.wait_for_selector(".kpis"); pg.wait_for_timeout(300)
    check("People with accounts" in pg.inner_text("#admin"), "admin overview")
    pg.screenshot(path=f"{SHOTS}/d-admin.png", full_page=True)
    pg.click("[data-atab=impact]"); pg.wait_for_selector("text=Quiz: before vs after")
    check("Great for school" in pg.inner_text("#admin"), "feedback in impact tab")
    pg.click("[data-atab=users]"); pg.wait_for_selector("#au-list table")
    check("asha@example.com" in pg.inner_text("#au-list"), "users table")
    pg.click("[data-atab=messages]"); pg.wait_for_selector("text=Can my class use this?")
    pg.click("[data-atab=founder]"); pg.wait_for_selector("#fe-bio")
    pg.fill("#fe-instagram","https://instagram.com/pocketmoney.teens"); pg.fill("#fe-headline","Money skills for teens, made by a teen.")
    pg.set_input_files("#fe-photo", "public/icons/icon-512.png"); pg.wait_for_timeout(500)
    pg.click("#fe-save"); pg.wait_for_selector("text=Saved. Your founder page")
    pg.goto(B + "/#about"); pg.wait_for_timeout(600)
    check("made by a teen" in pg.inner_text("#founder") and pg.locator("#founder img.portrait").count() == 1, "founder page updated with photo")
    check(pg.locator("#foot-socials a").count() == 1, "footer social link")
    pg.screenshot(path=f"{SHOTS}/d-about.png", full_page=True)

    # Google sign-up (Google's page is simulated)
    ctx3 = b.new_context(viewport={"width":390,"height":844}, is_mobile=True, has_touch=True, device_scale_factor=2)
    p3 = ctx3.new_page(); p3.on("pageerror", lambda e: errs.append(str(e)))
    def fake_google(code):
        def h(route):
            r = route.fetch(max_redirects=0)  # our server's redirect to Google, with state + cookie
            q = parse_qs(urlparse(r.headers["location"]).query)
            hdrs = {"location": f"{B}/api/auth/google/callback?state={q['state'][0]}&code={code}", "set-cookie": r.headers.get("set-cookie","")}
            route.fulfill(status=302, headers=hdrs)
        return h
    p3.route("**/api/auth/google/start*", fake_google("ravi"))
    p3.goto(B + "/#learn"); p3.wait_for_timeout(500); p3.click("#cookie-ok")
    p3.click("nav.bottom-nav button[data-go=account]"); p3.wait_for_timeout(300); p3.click("#account [data-open-login=signup]")
    p3.click("input[value='18+']"); p3.check("#su-terms"); p3.click("#su-google"); p3.wait_for_timeout(1800)
    me = p3.evaluate("fetch('/api/me').then(r=>r.json())")["user"]
    check(me and not me["needsProfile"] and me["ageBand"] == "18+", "google sign-up finished automatically")
    check("18 or over" in p3.inner_text("#account"), "account page shows age group right after sign-up")
    p3.screenshot(path=f"{SHOTS}/m-account.png")
    for pg_name in ["home","research","money","learn","about"]:
        p3.goto(B + "/#" + pg_name); p3.wait_for_timeout(500)
        if pg_name == "research": p3.fill("#rs-q","tata"); p3.wait_for_timeout(300)
        p3.screenshot(path=f"{SHOTS}/m-{pg_name}.png")
        w = p3.evaluate("document.documentElement.scrollWidth"); check(w <= 390, f"fits phone width: {pg_name} ({w}px)")
    ctx3.close()

    # Under-13 Google sign-in gets removed
    ctx4 = b.new_context(); p4 = ctx4.new_page(); p4.route("**/api/auth/google/start*", fake_google("kid"))
    p4.goto(B + "/"); p4.wait_for_timeout(400); p4.click("#cookie-ok"); p4.click("#me-btn"); p4.click("#si-google"); p4.wait_for_timeout(1500)
    p4.click("input[value='under13']"); p4.click("text=OK, remove my details"); p4.wait_for_timeout(600)
    check("haven't kept any of your details" in p4.inner_text("#login-body"), "under-13 account removed with kind message")
    ctx4.close()

    for l in ["privacy","terms","cookies","disclaimer"]:
        pg.goto(B + "/#" + l); pg.wait_for_timeout(150)
        check(pg.is_visible(f"#page-{l} h2"), f"{l} page")
    real = [e for e in errs if "favicon" not in e]
    check(not real, "no page errors: " + "; ".join(real[:5]))
    b.close()
print(f"\n{len(fails)} failed")
sys.exit(1 if fails else 0)
