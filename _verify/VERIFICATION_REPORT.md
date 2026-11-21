# SuvoCalc v31 — Verification Report (wave 3)

**Date:** 2026-11-21 · **Scope:** `~/workspace/suvocalc-v31/` (generated output only; `~/workspace/your_files/suvocalc_v30_fixed.html` was read-only and untouched).
**Method:** scripted checks only — every claim below comes from a script run in `_verify/`; nothing was asserted by inspection alone. No site file, `tools.json`, or content file was modified. Verification scripts live in `_verify/` (`check1-js-syntax.js`, `check-static.py`, `check-followups.py`, `calc-harness.js`, `repro-sci-bracket.js`).

## Verdict

- **Calculator tests: 56 PASS, 1 FAIL, 1 NEEDS-BROWSER (of 58).**
- **1 genuine bug found: the scientific-calculator keypad `)` button is broken** — any bracketed keypad expression shows `Error` (details in §(a) sci row and §(g)).
- **0 broken links, 0 missing anchors, 0 leftover `{{tokens}}`, 0 HTML parse errors.**
- **0 real banned-string claims** (84 substring hits, all classified legitimate — §(d)).
- **Counts all match:** 57 counted tool pages + scientific-calculator (58th), 15 blog articles + index, 7 category pages, 1 `<h1>` + 1 `<footer>` on all 89 pages, sitemap 89 `<loc>` = 89 pages, every sitemap URL resolves.
- **No duplicate ids on any page; no tool slug in two homepage sections; 57 distinct cards on `/tools/`.**
- **Blog related links match the source `.md` front matter on all 15 articles** (password-generator = 2, install-as-app = 0 — confirmed correct, not gaps).

## (a) Calculator test table (58 rows)

Harness: the *actual generated per-tool inline script* from each calculator page was executed in a Node `vm` with a DOM shim (`calc.js` loaded first, field values set from the test vector, then `runToolCalc()` — or the named wrapper — invoked). Expected values were computed independently in the harness from the formula (never by re-running the calc code). Date-dependent tools (age, pregnancy) compute the expectation from the same clock. `NEEDS-BROWSER` is used where no runnable assertion exists — never `PASS`.

| # | Tool (id / slug) | Test inputs | Expected | Actual | Result |
|---|---|---|---|---|---|
| 1 | pct / percentage-calculator | {"pA":20,"pB":500} | res-value = 100 (expected 100) | res-value = 100 (expected 100) | **PASS** |
| 2 | emi / emi-calculator | {"eP":500000,"eR":8.5,"eN":60} | res-value = 10258 (expected 10258) | res-value = 10258 (expected 10258) | **PASS** |
| 3 | disc / discount-calculator | {"dO":1000,"dP":20} | res-value = 800 (expected 800) | res-value = 800 (expected 800) | **PASS** |
| 4 | ci / compound-interest-calculator | {"ciP":100000,"ciR":8,"ciN":5,"ciC":"Yearly"} | res-value = 146933 (expected 146933) | res-value = 146933 (expected 146933) | **PASS** |
| 5 | si / simple-interest-calculator | {"siP":100000,"siRate":8,"siT":5} | res-value = 40000 (expected 40000) | res-value = 40000 (expected 40000) | **PASS** |
| 6 | sal / salary-calculator | {"salG":1200000,"salPF1":12,"salT":2400} | res-value = 87800 (expected 87800) | res-value = 87800 (expected 87800) | **PASS** |
| 7 | budget / budget-calculator | {"budInc":100000,"budExp":50000,"budSave":20000} | res-value = 20000 (expected 20000) | res-value = 20000 (expected 20000) | **PASS** |
| 8 | loan / loan-eligibility-calculator | {"lnI":60000,"lnE":5000,"lnR":9,"lnT":20} | res-value = 2778624 (expected 2778624) | res-value = 2778624 (expected 2778624) | **PASS** |
| 9 | emi2 / loan-affordability-calculator | {"emi2Inc":60000,"emi2Emi":5000,"emi2Rate":9,"emi2Ten":20} | max loan in emi2Res = 2778624 (expected 2778624) | max loan in emi2Res = 2778624 (expected 2778624) | **PASS** |
| 10 | overtime / overtime-pay-calculator | {"otRate":200,"otHours":40,"otOTHours":10,"otMulti":1.5} | res-value = 11000 (expected 11000) | res-value = 11000 (expected 11000) | **PASS** |
| 11 | lcomp / loan-comparison-calculator | {"lcP":500000,"lcR1":9,"lcN1":240,"lcR2":8.5,"lcN2":180} | EMI1 ₹4,499, EMI2 ₹4,924, Loan 2 saves | EMI1 ₹4,499, EMI2 ₹4,924, Loan 2 saves | **PASS** |
| 12 | gst / gst-calculator | [{"gA":1000,"gR":18,"gM":"Add GST","gT":"Within state (CGST + SGST)"},{"gA":1180,"gR":18,"gM":"Remove GST","gT":"Within state (CGST + SGST)"},{"gA":1000,"gR":40,"gM":"Add GST","gT":"Within state (CGST + SGST)"}] | GST ₹180, total ₹1,180, CGST ₹90, SGST ₹90 \|\| base ₹1,000, GST ₹180 \|\| GST ₹400, total ₹1,400 | GST ₹180, total ₹1,180, CGST ₹90, SGST ₹90 \|\| base ₹1,000, GST ₹180 \|\| GST ₹400, total ₹1,400 | **PASS** — 3 sub-cases |
| 13 | tax / income-tax-calculator | {"txI":1500000,"txR":"New Regime 2025-26"} | res-value = 109200 (expected 109200) | res-value = 109200 (expected 109200) | **PASS** |
| 14 | hra / hra-exemption-calculator | {"hraSal":50000,"hraDA":10000,"hraRcv":20000,"hraRent":15000,"hraCity":"Metro"} | exemption in hraRes = 9000 (expected 9000) | exemption in hraRes = 9000 (expected 9000) | **PASS** |
| 15 | homeloan / home-loan-tax-benefit-calculator | {"hlLoan":5000000,"hlRate":8.5,"hlTenure":20,"hlIncome":1500000,"hlSlab":30} | annual tax saving in homeloanRes = 105000 (expected 105000) | annual tax saving in homeloanRes = 105000 (expected 105000) | **PASS** |
| 16 | breakeven / break-even-calculator | {"beFixed":50000,"bePrice":100,"beVar":60,"beUnits":1000} | res-value = 1250 (expected 1250) | res-value = 1250 (expected 1250) | **PASS** |
| 17 | sip / sip-calculator | {"siM":5000,"siR":12,"siY":10} | res-value = 1161695 (expected 1161695) | res-value = 1161695 (expected 1161695) | **PASS** |
| 18 | stock / stock-profit-calculator | {"stB":100,"stQ":10,"stS":150,"stY":1} | res-value = 500 (expected 500) | res-value = 500 (expected 500) | **PASS** |
| 19 | crypto / crypto-calculator | {"crI":10000,"crB":50000,"crN":75000} | res-value (coins) = 0.2 (expected 0.2) | res-value (coins) = 0.2 (expected 0.2) | **PASS** |
| 20 | retire / retirement-calculator | {"rtA":30,"rtR":60,"rtE":50000,"rtI":8,"rtF":6} | res-value = 172304735 (expected 172304735) | res-value = 172304735 (expected 172304735) | **PASS** |
| 21 | ppf / ppf-calculator | {"ppfY":150000,"ppfR":7.1,"ppfT":15} | res-value = 4068209 (expected 4068209) | res-value = 4068209 (expected 4068209) | **PASS** |
| 22 | fd / fixed-deposit-calculator | {"fdP":100000,"fdR":7,"fdT":5,"fdFreq":"Quarterly"} | maturity in fdRes = 141478 (expected 141478) | maturity in fdRes = 141478 (expected 141478) | **PASS** |
| 23 | cagr / cagr-calculator | {"cagrStart":100000,"cagrEnd":200000,"cagrYrs":5} | CAGR 14.87% | CAGR 14.87% | **PASS** |
| 24 | networth / net-worth-calculator | {"nwCash":100000,"nwInvest":500000,"nwProperty":2000000,"nwOther":50000,"nwHomeLoan":1000000,"nwPersonal":100000,"nwCC":50000} | net worth in networthRes = 1500000 (expected 1500000) | net worth in networthRes = 1500000 (expected 1500000) | **PASS** |
| 25 | savgoal / savings-goal-calculator | {"sgGoal":100000,"sgSaved":0,"sgMonthly":5000,"sgMonths":0,"sgRate":4} | time to goal 1y 8m (20 months) | time to goal 1y 8m (20 months) | **PASS** |
| 26 | bmi / bmi-calculator | {"bH":170,"bW":70} | res-value = 24.2214532872 (expected ≈24.2215) | res-value = 24.2214532872 (expected ≈24.2215) | **PASS** |
| 27 | age / age-calculator | {"aD":"2000-01-15"} | 26 yrs, 10 mo, 6 d | 26 yrs, 10 mo, 6 d | **PASS** |
| 28 | preg / pregnancy-due-date-calculator | {"prD":"2026-01-01","prC":28} | EDD Thu Oct 08 2026 | EDD Thu Oct 08 2026 | **PASS** |
| 29 | calorie / calorie-calculator | {"clA":30,"clW":70,"clH":170,"clG":"Male","clAc":"Moderate (3-5 days/wk)"} | res-value = 2507 (expected 2507) | res-value = 2507 (expected 2507) | **PASS** |
| 30 | bodyfat / body-fat-calculator | {"bfG":"Male","bfH":175,"bfW":85,"bfN":38,"bfHp":95} | res-value = 16.9380273317 (expected ≈16.9380) | res-value = 16.9380273317 (expected ≈16.9380) | **PASS** |
| 31 | wtr / water-intake-calculator | {"wtrW":70,"wtrA":"Moderately Active (3–5 days/wk)","wtrC":"Temperate / Normal"} | 2.5 L / 2520 ml | 2.5 L / 2520 ml | **PASS** |
| 32 | sleep / sleep-cycle-calculator | [{"sleepMode":"I want to wake at…","sleepTime":"07:00"},{"sleepMode":"I want to sleep at…","sleepTime":"22:00"}] | wake 07:00 → sleep 21:46 (6c, best), 23:16 (5c), 00:46 (4c) \|\| sleep 22:00 → wake 04:14 (4c), 05:44 (5c), 07:14 (6c, best) | wake 07:00 → sleep 21:46 (6c, best), 23:16 (5c), 00:46 (4c) \|\| sleep 22:00 → wake 04:14 (4c), 05:44 (5c), 07:14 (6c, best) | **PASS** — 2 sub-cases |
| 33 | heartrate / heart-rate-calculator | {"hrAge":30,"hrRest":60} | max 190 bpm, Zone 1 125-138 | max 190 bpm, Zone 1 125-138 | **PASS** |
| 34 | cgpa / cgpa-calculator | {"cgS1":8,"cgS2":9,"cgS3":7,"cgS4":8} | res-value = 8 (expected 8) | res-value = 8 (expected 8) | **PASS** |
| 35 | grade / grade-calculator | {"grM":85,"grT":100} | grade A, 85% | grade A, 85% | **PASS** |
| 36 | matrix / matrix-calculator | {"ma00":1,"ma01":2,"ma10":3,"ma11":4,"mb00":5,"mb01":6,"mb10":7,"mb11":8} | add [6,8]/[10,12]; mul [19,22]/[43,50] | add [6,8]/[10,12]; mul [19,22]/[43,50] | **PASS** |
| 37 | pomo / pomodoro-study-timer | {"pomMode":"Pomodoro (25 min)"} | pomStart → running, status "🎯 Focus!" (1s ticking needs browser) | pomStart → running, status "🎯 Focus!" (1s ticking needs browser) | **PASS** |
| 38 | attend / attendance-calculator | {"attTotal":100,"attAttended":80,"attReq":75} | 80.0%, SAFE, can miss 6 | 80.0%, SAFE, can miss 6 | **PASS** |
| 39 | date / date-difference-calculator | {"dd1":"2026-01-01","dd2":"2026-02-01"} | res-value (days) = 31 (expected 31) | res-value (days) = 31 (expected 31) | **PASS** |
| 40 | tzc / time-zone-converter | {"tzTime":"2026-11-21T12:00","tzFrom":"UTC+0","tzTo":"UTC+5:30"} | UTC+0 12:00 → UTC+5:30 05:30 pm | UTC+0 12:00 → UTC+5:30 05:30 pm | **PASS** |
| 41 | worldclock / world-clock | {"wcCity":"Asia/Kolkata"} | 10 rows show live Intl time (±2s) | 10 rows show live Intl time (±2s) | **PASS** |
| 42 | elec / electricity-bill-calculator | {"elU":200,"elR":6.5,"elF":50} | res-value = 1350 (expected 1350) | res-value = 1350 (expected 1350) | **PASS** |
| 43 | fuel / fuel-cost-calculator | {"fuD":300,"fuM":15,"fuP":105} | res-value = 2100 (expected 2100) | res-value = 2100 (expected 2100) | **PASS** |
| 44 | rng / random-number-generator | {"rnA":1,"rnB":100,"rnC":5} | 5 numbers in [1,100]: 95, 95, 4, 77, 33 | 5 numbers in [1,100]: 95, 95, 4, 77, 33 | **PASS** |
| 45 | pwd / password-generator | {"pwdLen":16,"pwUC":{"checked":true},"pwLC":{"checked":true},"pwNM":{"checked":true},"pwSP":{"checked":true}} | 16 chars from full set, strength 100% | 16 chars from full set, strength 100% | **PASS** |
| 46 | conv / unit-currency-converter | {"tp1":1,"tp2":"km","tp3":"m"} | 1 km = 1000 m; 100°C = 212°F | 1 km = 1000 m; 100°C = 212°F | **PASS** |
| 47 | graph / graph-plotter | {"graphFn":"x*x"} | f(x)=x*x, 145 points plotted | f(x)=x*x, 145 points plotted | **PASS** |
| 48 | tip / tip-calculator | {"tipB":1000,"tipP":15,"tipS":2} | res-value = 150 (expected 150) | res-value = 150 (expected 150) | **PASS** |
| 49 | qr / qr-code-generator | {"qr22Input":"https://example.com","qr22Color":"#000000","qr22Bg":"#ffffff","qr22Size":"300"} | api.qrserver.com URL built with encoded text, 300x300 (image load needs internet) | api.qrserver.com URL built with encoded text, 300x300 (image load needs internet) | **PASS** |
| 50 | qrscan / qr-code-scanner | (n/a — camera/device) |  |  | **NEEDS-BROWSER** — Camera + BarcodeDetector/file-upload path — no DOM-runnable core; startQRScan returns early without navigator.mediaDevices. |
| 51 | speed / speed-distance-time-calculator | {"spSpeed":"","spDist":120,"spTime":2,"spUnit":"km"} | SDT: 120 km / 2 h = 60.00 km/h; Pace: 10 km in 50:00 = 5:00 /km | SDT: 120 km / 2 h = 60.00 km/h; Pace: 10 km in 50:00 = 5:00 /km | **PASS** |
| 52 | unitprice / unit-price-calculator | {"upPrice1":100,"upQty1":1,"upUnit1":"kg","upPrice2":180,"upQty2":2,"upUnit2":"kg"} | B wins ₹90/kg vs ₹100/kg, saves ₹10.000 | B wins ₹90/kg vs ₹100/kg, saves ₹10.000 | **PASS** |
| 53 | stats / statistics-calculator | {"statsInp":"1,2,3,4,5"} | mean 3.000, median 3, mode None, range 4, variance 2.000, stddev 1.414 | mean 3.000, median 3, mode None, range 4, variance 2.000, stddev 1.414 | **PASS** |
| 54 | split19 / split-bill-calculator | {"v19SplitTotal":1000,"v19SplitPeople":4,"v19SplitTip":10} | each pays ₹275.00 | each pays ₹275.00 | **PASS** |
| 55 | area / area-calculator | {"arS":"Rectangle","arA":10,"arB":5} | res-value = 50 (expected 50) | res-value = 50 (expected 50) | **PASS** |
| 56 | numera / numerology-calculator | {"numDob":"1990-01-01","numName":"RAM"} | Life Path 3 (1990-01-01 → 21 → 3), Name 7 (RAM = 2+1+4) | Life Path 3 (1990-01-01 → 21 → 3), Name 7 (RAM = 2+1+4) | **PASS** |
| 57 | love / love-compatibility-calculator | {"loveName1":"Rahul","loveName2":"Priya"} | FLAMES = Marriage (independently computed) | FLAMES = Marriage (independently computed) | **PASS** |
| 58 | sci / scientific-calculator | {"sciExpr":"(45+15)*3-100/4"} | BUG: bracketed keypad path must give 155 (expr field, unparenthesised keypad and sin all pass) | {"exprRes":"155","keypadRes":"Error","precedenceRes":"65","sinRes":"0.5"} — see _verify/repro-sci-bracket.js; root cause: case cb2 sets cur=0 so fullE() becomes "(… )0" | **FAIL** |

**Totals: PASS 56 · FAIL 1 · NEEDS-BROWSER 1.** The single FAIL is `sci` (bracketed keypad path — §(g)). The single NEEDS-BROWSER is `qrscan` (camera + BarcodeDetector/file-upload path; `startQRScan` returns early without `navigator.mediaDevices`, so there is no DOM-runnable core to assert).

Required GST cases — all PASS (row 12, 3 sub-cases):

- ₹1000 @18% Add, within state → GST ₹180, total ₹1180, CGST ₹90, SGST ₹90 ✓
- ₹1180 @18% Remove → base ₹1000, GST ₹180 ✓
- ₹1000 @40% Add → GST ₹400, total ₹1400 ✓

Multi-assertion rows (all sub-assertions must pass for the row to pass):

- `gst`: 3 sub-cases (above). `sleep`: 2 sub-cases — wake 07:00 → sleep 21:46/23:16/00:46; sleep 22:00 → wake 04:14/05:44/07:14. `matrix`: add [6,8]/[10,12] and mul [19,22]/[43,50]. `conv`: 1 km = 1000 m and 100 °C = 212 °F. `speed`: SDT 60.00 km/h and pace 5:00 /km. `sci`: expression field 155 ✓, unparenthesised keypad 65 (JS precedence) ✓, sin(30°) = 0.5 ✓, bracketed keypad = `Error` ✗ (the bug).
- `rng` / `pwd` were verified by property assertions (range/count/charset/strength), not by a fixed value, since they are random by design.
- `pomo`: asserted start state (`pomRunning=true`, status “🎯 Focus!”); the 1-second ticking itself needs a browser. `worldclock`: all 10 rows show live `Intl` time (±2 s). `qr`: asserted the constructed `api.qrserver.com` URL (encoded text, 300×300); the image load itself needs internet.

## (b) Link check

- Internal links (relative + `/-rooted`, incl. directory → `index.html` resolution): **0 broken** across all 89 pages.
- `#anchor` links: **0 missing targets** on the same page.
- External `https://` links (listed, NOT fetched): 91 occurrences, 89 distinct URLs — all are the site’s own canonical/JSON-LD URLs (`https://suvocalc.com/…`), plus `https://policies.google.com/privacy` and `https://www.google.com/settings/ads` (privacy page). None were fetched, per the no-fetch rule.
- `mailto:` / `tel:` / `data:` links skipped by design.

## (c) Count checks

- Registry: 58 entries = **57 counted + `scientific-calculator` (`counted: false`)**.
- Calculator pages on disk: **58**, slugs match the registry exactly (0 missing, 0 extra).
- Blog: **15 article pages + `blog/index.html`**.
- Category pages: **7** (`daily-utilities`, `date-time`, `education-students`, `finance`, `health-fitness`, `investment-savings`, `tax-business`).
- Registry counted-per-category: finance 11, tax-business 5, investment-savings 9, health-fitness 8, education-students 5, date-time 3, daily-utilities 16 (= 57; the “17” in BUILD_NOTES for daily-utilities includes the uncounted scientific-calculator, which lives in that category — 16 + 1 = 17, not a mismatch).
- **One `<h1>` and one `<footer>` on every page (89/89, 0 violations).**
- Sitemap: **89 `<loc>` = 89 HTML pages**; every sitemap URL resolves to an existing file. `robots.txt` points at `https://suvocalc.com/sitemap.xml`.
- Total generated HTML pages: **89** (the 90th `.html` file found by `find` is the `template.html` source, not a generated page).

## (d) Banned-string audit — classification

Exhaustive substring scan of all 89 generated pages (raw HTML for identifiers, tag-stripped visible text for claim-like patterns). **84 hits total, 0 real claims.**

| Pattern | Hits | Verdict |
|---|---|---|
| `69` substring | 16 | **(a) legitimate computed numbers** — SIP ₹11,61,695 / ₹5,61,695; CI 1.4693 / ₹1,46,933; home-loan ₹3,20,692; heart-rate zones 156–169; grade band 60–69% B; plus 1 source-line citation (`5969-5970` in a sci-page code comment, not user-visible). No “69 tools” claim anywhere. |
| `6.0` substring | 2 | **(a) legitimate numbers** — CGPA table `6.0 → 57%`; Chennai rate `₹6.00/unit`. |
| `6.2` substring | 5 | **(a) legitimate numbers** — BMR formula `6.25 × height` (worked example + formula box + inlined calc code). |
| `v21` substring | 60 | **(b) code identifier, invisible as a version claim** — the `v21Haptic()` no-op stub name on all 58 tool pages (58) + 2 call sites (`qr` calc body, `v21Haptic&&v21Haptic(8)`). Verbatim v30 name, not a version claim. |
| `v23` substring | 1 | **(b) code identifier** — `v23-qr-scan-line` CSS class string in the qr-scanner page script (verbatim v30). |
| `v28` substring | 0 | — |
| `69 tools`, `45+`, `Powered by Claude`, `ca-pub-XXXXXXXXXXXXXXXX` | 0 each | **(c) real user-visible claims: ZERO.** |

Note: an earlier draft of this check used `\bv21\b` and missed `v21Haptic` (no word boundary between `1` and `H`); the follow-up scan used plain substrings and found all 60. The BUILD_NOTES “legitimate substrings” list is confirmed complete and correct — no additional hits exist beyond those classes.

## (e) Duplicate checks

- **Homepage:** re-derived from the generated `index.html` — Popular 8, Featured 1 (gst), finance 6, health 4, student 4, utility 4 = 26 section tools + gst featured + scientific-calculator callout = **28 distinct slugs, no slug in two sections**.  (BUILD_NOTES says “utility 5” in one paragraph; the generated HTML has 4 utility slugs — electricity, fuel, password-generator, random-number-generator — and the other paragraph’s “26 section tools” total is the correct one. Note wording only, not a site defect.)
- **Duplicate `id="…"` attributes:** **none on any of the 89 pages**.
- **`/tools/`:** **57 cards** (`article.tool-card`, 57 distinct `data-title`s matching the 57 counted registry titles). Each card carries 2 hrefs (title link + “Open” button), hence 114 hrefs total — that is 2 links per card, not duplicated cards. `scientific-calculator` correctly absent from `/tools/`.

## (f) Blog related links

Compared each generated article’s `<ul class="related-list">` against the source `content/blog/*.md` front-matter `related` list (alias-normalized: `unit-and-currency-converter` → `unit-currency-converter`, electricity article). **All 15 articles match exactly (0 mismatches).**

- `password-generator-create-unbreakable-passwords`: source 2 (`password-generator`, `random-number-generator`) = generated 2 ✓ — the “only 2 links” is the source content, CORRECT, not a gap.
- `install-suvocalc-as-a-free-app-no-app-store-needed`: source 0 = generated 0, no related section rendered ✓ — the “no links” is the source content, CORRECT, not a gap.
- All other 13 articles: 3 related links each, matching the source exactly.

## (g) Bug found — scientific-calculator keypad `)` button

**Severity: user-facing, breaks a documented feature.** The sci page’s own example (“(45 + 15) × 3 − 100 ÷ 4 = 155”) works through the expression field but fails with `Error` when entered on the keypad.

- **File (registry source of the bug):** `tools.json`, line 2331 — the `sci` tool’s `calc` body (verbatim v30 `act(a,v)`), case `'cb2'`: `buf+=cur+')';cur='0';`
- **File (generated page):** `calculators/scientific-calculator/index.html`, line 229 (same code, inlined).
- **Upstream origin (read-only source, not to be edited):** `~/workspace/your_files/suvocalc_v30_fixed.html`, line 5941 — identical line, so this is a v30 bug carried verbatim into v31, not a generator bug.
- **What is wrong:** `fullE()` returns `buf + cur`. After `)`, `cur` is reset to `'0'`, so the expression becomes `(2+3)0` (visible in the display — the keypad literally shows `(2+3)0` after pressing `)`). `safe()` cannot evaluate it, so `=` shows `Error`. Any operator pressed after `)` appends the stray `0` too (`(2+3)0*…`). Minimal repro (run: `node _verify/repro-sci-bracket.js`):
  - `( 2 + 3 ) =` → `Error` (should be 5)
  - `( 2 + 3 ) × 4 =` → `Error` (should be 20)
  - `(45+15) × 3 − 100 ÷ 4 =` → `Error` (should be 155)
  - `2 + 3 =` (no brackets) → `5` ✓; expression field `(45+15)*3-100/4` → `155` ✓; `sin(30°)` → `0.5` ✓
- **Suggested fix (for the coordinator, not applied here):** in the `cb2` case, reset `cur` to `''` instead of `'0'` so `fullE()` is `(2+3)` and a following operator appends cleanly (`(2+3)*…`). Needs a re-check of the `back` case, which special-cases `cur==='0'`. The fix belongs in `tools.json` (and the v30 source note), then regenerate — the generated page must not be hand-edited.

## (h) What could NOT be verified (no browser/device)

- `main.js` was syntax-checked (`node --check` ✓) but **never executed in a browser**: theme toggle/persistence, live search, Recently Used (localStorage `sc_recently_used`), mobile nav, and the cookie banner need a real browser/device test.
- Every calculator’s **Calculate button as a real user would press it** (form submit → handler → render) was verified only through the equivalent `runToolCalc()` call under the DOM shim; the actual click path in a browser is untested.
- **QR Generator needs internet** (`api.qrserver.com`, Google Charts fallback) — only the URL construction was verified; the image load was not.
- **QR Scanner** (`qr-code-scanner`) is NEEDS-BROWSER: camera permission, `BarcodeDetector`, and the file-upload scan path cannot run under Node.
- **Pomodoro 1-second ticking** (interval countdown, session-complete sound/toast) was not run to completion; only the start state was asserted.
- **World Clock live ticking** (1 s interval) was asserted once at load, not over time.
- **Graph plotter** rendering was verified only via the canvas-stub call count (`N points plotted`); actual pixels were not inspected.
- External links were listed but **not fetched**; their live destinations are unverified.
- No on-device (OPPO/phone) testing was possible from this environment.

## (i) Other checks run

- **JS syntax (`node --check`): 150 checked, 0 failures** — `build.js`, `assets/js/main.js`, `assets/js/calc.js`, plus **147 inline classic `<script>` blocks** across the 89 pages (theme script × 89 + per-tool script × 58). JSON-LD and `application/json` data blocks were skipped as non-JS by design.
- **HTML parse (`python html.parser`, tag-stack): 0 parse errors on all 89 pages; 0 leftover `{{tokens}}`.**
