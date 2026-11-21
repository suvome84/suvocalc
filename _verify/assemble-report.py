#!/usr/bin/env python3
"""Assemble VERIFICATION_REPORT.md from the check outputs."""
import json, os

V = os.path.dirname(os.path.abspath(__file__))
calc = json.load(open(os.path.join(V, 'calc-results.json')))
static = json.load(open(os.path.join(V, 'check-static.json')))
follow = json.load(open(os.path.join(V, 'check-followups.json')))
js = json.load(open(os.path.join(V, 'check1-js-syntax.json')))

rows = calc['rows']
lines = []
A = lines.append
A('# SuvoCalc v31 — Verification Report (wave 3)')
A('')
A('**Date:** 2026-11-21 · **Scope:** `~/workspace/suvocalc-v31/` (generated output only;'
  ' `~/workspace/your_files/suvocalc_v30_fixed.html` was read-only and untouched).')
A('**Method:** scripted checks only — every claim below comes from a script run in'
  ' `_verify/`; nothing was asserted by inspection alone. No site file, `tools.json`,'
  ' or content file was modified. Verification scripts live in `_verify/`'
  ' (`check1-js-syntax.js`, `check-static.py`, `check-followups.py`, `calc-harness.js`,'
  ' `repro-sci-bracket.js`).')
A('')
A('## Verdict')
A('')
A('- **Calculator tests: 56 PASS, 1 FAIL, 1 NEEDS-BROWSER (of 58).**')
A('- **1 genuine bug found: the scientific-calculator keypad `)` button is broken**'
  ' — any bracketed keypad expression shows `Error` (details in §(a) sci row and §(g)).')
A('- **0 broken links, 0 missing anchors, 0 leftover `{{tokens}}`, 0 HTML parse errors.**')
A('- **0 real banned-string claims** (84 substring hits, all classified legitimate — §(d)).')
A('- **Counts all match:** 57 counted tool pages + scientific-calculator (58th), 15 blog'
  ' articles + index, 7 category pages, 1 `<h1>` + 1 `<footer>` on all 89 pages,'
  ' sitemap 89 `<loc>` = 89 pages, every sitemap URL resolves.')
A('- **No duplicate ids on any page; no tool slug in two homepage sections;'
  ' 57 distinct cards on `/tools/`.**')
A('- **Blog related links match the source `.md` front matter on all 15 articles**'
  ' (password-generator = 2, install-as-app = 0 — confirmed correct, not gaps).')
A('')
A('## (a) Calculator test table (58 rows)')
A('')
A('Harness: the *actual generated per-tool inline script* from each calculator page'
  ' was executed in a Node `vm` with a DOM shim (`calc.js` loaded first, field values'
  ' set from the test vector, then `runToolCalc()` — or the named wrapper — invoked).'
  ' Expected values were computed independently in the harness from the formula'
  ' (never by re-running the calc code). Date-dependent tools (age, pregnancy) compute'
  ' the expectation from the same clock. `NEEDS-BROWSER` is used where no runnable'
  ' assertion exists — never `PASS`.')
A('')
A('| # | Tool (id / slug) | Test inputs | Expected | Actual | Result |')
A('|---|---|---|---|---|---|')
for i, r in enumerate(rows, 1):
    exp = (r.get('expected') or '').replace('|', '\\|').replace('\n', ' ')
    act = (r.get('actual') or '').replace('|', '\\|').replace('\n', ' ')
    inp = (r.get('inputs') or '').replace('|', '\\|')
    note = (' — ' + r['note']) if r.get('note') else ''
    A(f"| {i} | {r['id']} / {r['slug']} | {inp} | {exp} | {act} | **{r['status']}**{note} |")
A('')
A('**Totals: PASS 56 · FAIL 1 · NEEDS-BROWSER 1.** The single FAIL is `sci`'
  ' (bracketed keypad path — §(g)). The single NEEDS-BROWSER is `qrscan`'
  ' (camera + BarcodeDetector/file-upload path; `startQRScan` returns early without'
  ' `navigator.mediaDevices`, so there is no DOM-runnable core to assert).')
A('')
A('Required GST cases — all PASS (row 12, 3 sub-cases):')
A('')
A('- ₹1000 @18% Add, within state → GST ₹180, total ₹1180, CGST ₹90, SGST ₹90 ✓')
A('- ₹1180 @18% Remove → base ₹1000, GST ₹180 ✓')
A('- ₹1000 @40% Add → GST ₹400, total ₹1400 ✓')
A('')
A('Multi-assertion rows (all sub-assertions must pass for the row to pass):')
A('')
A('- `gst`: 3 sub-cases (above). `sleep`: 2 sub-cases — wake 07:00 → sleep 21:46/23:16/00:46;'
  ' sleep 22:00 → wake 04:14/05:44/07:14. `matrix`: add [6,8]/[10,12] and mul [19,22]/[43,50].'
  ' `conv`: 1 km = 1000 m and 100 °C = 212 °F. `speed`: SDT 60.00 km/h and pace 5:00 /km.'
  ' `sci`: expression field 155 ✓, unparenthesised keypad 65 (JS precedence) ✓, sin(30°) = 0.5 ✓,'
  ' bracketed keypad = `Error` ✗ (the bug).')
A('- `rng` / `pwd` were verified by property assertions (range/count/charset/strength),'
  ' not by a fixed value, since they are random by design.')
A('- `pomo`: asserted start state (`pomRunning=true`, status “🎯 Focus!”); the 1-second'
  ' ticking itself needs a browser. `worldclock`: all 10 rows show live `Intl` time (±2 s).'
  ' `qr`: asserted the constructed `api.qrserver.com` URL (encoded text, 300×300); the'
  ' image load itself needs internet.')
A('')
A('## (b) Link check')
A('')
A('- Internal links (relative + `/-rooted`, incl. directory → `index.html` resolution):'
  ' **0 broken** across all 89 pages.')
A('- `#anchor` links: **0 missing targets** on the same page.')
A('- External `https://` links (listed, NOT fetched): 91 occurrences, 89 distinct URLs —'
  ' all are the site’s own canonical/JSON-LD URLs (`https://suvocalc.com/…`), plus'
  ' `https://policies.google.com/privacy` and `https://www.google.com/settings/ads`'
  ' (privacy page). None were fetched, per the no-fetch rule.')
A('- `mailto:` / `tel:` / `data:` links skipped by design.')
A('')
A('## (c) Count checks')
A('')
A('- Registry: 58 entries = **57 counted + `scientific-calculator` (`counted: false`)**.')
A('- Calculator pages on disk: **58**, slugs match the registry exactly'
  ' (0 missing, 0 extra).')
A('- Blog: **15 article pages + `blog/index.html`**.')
A('- Category pages: **7** (`daily-utilities`, `date-time`, `education-students`,'
  ' `finance`, `health-fitness`, `investment-savings`, `tax-business`).')
A('- Registry counted-per-category: finance 11, tax-business 5, investment-savings 9,'
  ' health-fitness 8, education-students 5, date-time 3, daily-utilities 16'
  ' (= 57; the “17” in BUILD_NOTES for daily-utilities includes the uncounted'
  ' scientific-calculator, which lives in that category — 16 + 1 = 17, not a mismatch).')
A('- **One `<h1>` and one `<footer>` on every page (89/89, 0 violations).**')
A('- Sitemap: **89 `<loc>` = 89 HTML pages**; every sitemap URL resolves to an existing file.'
  ' `robots.txt` points at `https://suvocalc.com/sitemap.xml`.')
A('- Total generated HTML pages: **89** (the 90th `.html` file found by `find` is the'
  ' `template.html` source, not a generated page).')
A('')
A('## (d) Banned-string audit — classification')
A('')
A('Exhaustive substring scan of all 89 generated pages (raw HTML for identifiers,'
  ' tag-stripped visible text for claim-like patterns). **84 hits total, 0 real claims.**')
A('')
A('| Pattern | Hits | Verdict |')
A('|---|---|---|')
A('| `69` substring | 16 | **(a) legitimate computed numbers** — SIP ₹11,61,695 / ₹5,61,695;'
  ' CI 1.4693 / ₹1,46,933; home-loan ₹3,20,692; heart-rate zones 156–169; grade band 60–69% B;'
  ' plus 1 source-line citation (`5969-5970` in a sci-page code comment, not user-visible).'
  ' No “69 tools” claim anywhere. |')
A('| `6.0` substring | 2 | **(a) legitimate numbers** — CGPA table `6.0 → 57%`;'
  ' Chennai rate `₹6.00/unit`. |')
A('| `6.2` substring | 5 | **(a) legitimate numbers** — BMR formula `6.25 × height`'
  ' (worked example + formula box + inlined calc code). |')
A('| `v21` substring | 60 | **(b) code identifier, invisible as a version claim** —'
  ' the `v21Haptic()` no-op stub name on all 58 tool pages (58) + 2 call sites'
  ' (`qr` calc body, `v21Haptic&&v21Haptic(8)`). Verbatim v30 name, not a version claim. |')
A('| `v23` substring | 1 | **(b) code identifier** — `v23-qr-scan-line` CSS class string'
  ' in the qr-scanner page script (verbatim v30). |')
A('| `v28` substring | 0 | — |')
A('| `69 tools`, `45+`, `Powered by Claude`, `ca-pub-XXXXXXXXXXXXXXXX` | 0 each |'
  ' **(c) real user-visible claims: ZERO.** |')
A('')
A('Note: an earlier draft of this check used `\\bv21\\b` and missed `v21Haptic`'
  ' (no word boundary between `1` and `H`); the follow-up scan used plain substrings'
  ' and found all 60. The BUILD_NOTES “legitimate substrings” list is confirmed complete'
  ' and correct — no additional hits exist beyond those classes.')
A('')
A('## (e) Duplicate checks')
A('')
A('- **Homepage:** re-derived from the generated `index.html` — Popular 8, Featured 1 (gst),'
  ' finance 6, health 4, student 4, utility 4 = 26 section tools + gst featured +'
  ' scientific-calculator callout = **28 distinct slugs, no slug in two sections**. '
  ' (BUILD_NOTES says “utility 5” in one paragraph; the generated HTML has 4 utility'
  ' slugs — electricity, fuel, password-generator, random-number-generator — and the'
  ' other paragraph’s “26 section tools” total is the correct one. Note wording only,'
  ' not a site defect.)')
A('- **Duplicate `id="…"` attributes:** **none on any of the 89 pages**.')
A('- **`/tools/`:** **57 cards** (`article.tool-card`, 57 distinct `data-title`s matching the'
  ' 57 counted registry titles). Each card carries 2 hrefs (title link + “Open” button),'
  ' hence 114 hrefs total — that is 2 links per card, not duplicated cards.'
  ' `scientific-calculator` correctly absent from `/tools/`.')
A('')
A('## (f) Blog related links')
A('')
A('Compared each generated article’s `<ul class="related-list">` against the source'
  ' `content/blog/*.md` front-matter `related` list (alias-normalized:'
  ' `unit-and-currency-converter` → `unit-currency-converter`, electricity article).'
  ' **All 15 articles match exactly (0 mismatches).**')
A('')
A('- `password-generator-create-unbreakable-passwords`: source 2'
  ' (`password-generator`, `random-number-generator`) = generated 2 ✓ —'
  ' the “only 2 links” is the source content, CORRECT, not a gap.')
A('- `install-suvocalc-as-a-free-app-no-app-store-needed`: source 0 = generated 0,'
  ' no related section rendered ✓ — the “no links” is the source content, CORRECT, not a gap.')
A('- All other 13 articles: 3 related links each, matching the source exactly.')
A('')
A('## (g) Bug found — scientific-calculator keypad `)` button')
A('')
A('**Severity: user-facing, breaks a documented feature.** The sci page’s own example'
  ' (“(45 + 15) × 3 − 100 ÷ 4 = 155”) works through the expression field but fails'
  ' with `Error` when entered on the keypad.')
A('')
A('- **File (registry source of the bug):** `tools.json`, line 2331 — the `sci` tool’s'
  ' `calc` body (verbatim v30 `act(a,v)`), case `\'cb2\'`:'
  ' `buf+=cur+\')\';cur=\'0\';`')
A('- **File (generated page):** `calculators/scientific-calculator/index.html`, line 229'
  ' (same code, inlined).')
A('- **Upstream origin (read-only source, not to be edited):**'
  ' `~/workspace/your_files/suvocalc_v30_fixed.html`, line 5941 — identical line,'
  ' so this is a v30 bug carried verbatim into v31, not a generator bug.')
A('- **What is wrong:** `fullE()` returns `buf + cur`. After `)`, `cur` is reset to'
  ' `\'0\'`, so the expression becomes `(2+3)0` (visible in the display — the keypad'
  ' literally shows `(2+3)0` after pressing `)`). `safe()` cannot evaluate it, so `=`'
  ' shows `Error`. Any operator pressed after `)` appends the stray `0` too'
  ' (`(2+3)0*…`). Minimal repro (run: `node _verify/repro-sci-bracket.js`):')
A('  - `( 2 + 3 ) =` → `Error` (should be 5)')
A('  - `( 2 + 3 ) × 4 =` → `Error` (should be 20)')
A('  - `(45+15) × 3 − 100 ÷ 4 =` → `Error` (should be 155)')
A('  - `2 + 3 =` (no brackets) → `5` ✓; expression field `(45+15)*3-100/4` → `155` ✓;'
  ' `sin(30°)` → `0.5` ✓')
A('- **Suggested fix (for the coordinator, not applied here):** in the `cb2` case,'
  ' reset `cur` to `\'\'` instead of `\'0\'` so `fullE()` is `(2+3)` and a following'
  ' operator appends cleanly (`(2+3)*…`). Needs a re-check of the `back` case,'
  ' which special-cases `cur===\'0\'`. The fix belongs in `tools.json` (and the'
  ' v30 source note), then regenerate — the generated page must not be hand-edited.')
A('')
A('## (h) What could NOT be verified (no browser/device)')
A('')
A('- `main.js` was syntax-checked (`node --check` ✓) but **never executed in a browser**:'
  ' theme toggle/persistence, live search, Recently Used (localStorage `sc_recently_used`),'
  ' mobile nav, and the cookie banner need a real browser/device test.')
A('- Every calculator’s **Calculate button as a real user would press it** (form submit'
  ' → handler → render) was verified only through the equivalent `runToolCalc()` call'
  ' under the DOM shim; the actual click path in a browser is untested.')
A('- **QR Generator needs internet** (`api.qrserver.com`, Google Charts fallback) — only'
  ' the URL construction was verified; the image load was not.')
A('- **QR Scanner** (`qr-code-scanner`) is NEEDS-BROWSER: camera permission,'
  ' `BarcodeDetector`, and the file-upload scan path cannot run under Node.')
A('- **Pomodoro 1-second ticking** (interval countdown, session-complete sound/toast)'
  ' was not run to completion; only the start state was asserted.')
A('- **World Clock live ticking** (1 s interval) was asserted once at load, not over time.')
A('- **Graph plotter** rendering was verified only via the canvas-stub call count'
  ' (`N points plotted`); actual pixels were not inspected.')
A('- External links were listed but **not fetched**; their live destinations are unverified.')
A('- No on-device (OPPO/phone) testing was possible from this environment.')
A('')
A('## (i) Other checks run')
A('')
A('- **JS syntax (`node --check`): 150 checked, 0 failures** — `build.js`,'
  ' `assets/js/main.js`, `assets/js/calc.js`, plus **147 inline classic `<script>` blocks**'
  ' across the 89 pages (theme script × 89 + per-tool script × 58). JSON-LD and'
  ' `application/json` data blocks were skipped as non-JS by design.')
A('- **HTML parse (`python html.parser`, tag-stack): 0 parse errors on all 89 pages;'
  ' 0 leftover `{{tokens}}`.**')
A('')

open(os.path.join(V, 'VERIFICATION_REPORT.md'), 'w').write('\n'.join(lines))
print('written', os.path.join(V, 'VERIFICATION_REPORT.md'), len(lines), 'lines')
