# SuvoCalc v31 — Build Notes

> Template/generator by worker W1b. The assembly worker extends this file
> when the real `tools.json`, `calc.js` and content land — they have now
> landed (2026-11-21) and the notes below describe the real files.

## Architecture

Multi-file static site, generated from one template — per audit §D1. No
backend, no build dependencies, no CDN. One Node script stamps the template.

```
suvocalc-v31/
  template.html            base layout (all tokens; the ONLY header/footer source)
  build.js                 generator (Node, no dependencies) — run: node build.js
  tools.json               the ONE registry (owned by another worker)
  assets/css/style.css     the ONE design system
  assets/js/main.js        site JS: nav, theme, search, recently-used, cookie banner
  assets/js/calc.js        calculator helpers (owned by W1a; the sci keypad
                           is rendered by the generator, not by calc.js)
  companions.json          verbatim companion functions/state per tool id
                           (extracted from the v30 source; see below)
  content/pages/home.json  homepage copy
  content/tools/<slug>.json  per-tool editorial content (owned by another worker)
  content/blog/<slug>.md   15 guides (owned by another worker)
  content/pages/<page>.md  about/contact/privacy/terms/disclaimer/faq
  index.html, tools/, categories/<slug>/, calculators/<slug>/, blog/,
  about/, contact/, privacy/, terms/, disclaimer/, faq/   ← generated
  sitemap.xml, robots.txt  ← generated
```

## How to regenerate

```sh
cd ~/workspace/suvocalc-v31
node build.js
```

Re-runnable and idempotent: creates directories as needed, overwrites all
outputs. A missing per-tool content JSON, blog `.md` or static-page `.md`
skips that page with a console warning instead of crashing, so the site can
be built and tested before all content exists. `tools.json`,
`template.html` and `content/pages/home.json` are required.

## Design tokens (assets/css/style.css)

- Primary blue `#2563eb` (SuvoCalc's existing blue); hover `#1d4ed8`.
- Light bg `#f8fafc`, dark bg `#0f172a`; text `#0f172a` / `#e2e8f0`.
- System font stack only — no webfont, no CDN, no icon font.
- Inline SVG icons only, for UI chrome (nav, search). No emoji as UI icons.
- Spacing scale `--space-1` (4px) … `--space-8` (64px); radii 8/12/16px.
- Buttons: `.btn-primary` (blue filled), `.btn-secondary` (outline).
- Light theme default; dark via `[data-theme="dark"]` on `<html>`, one
  header toggle, persisted in localStorage key `sc_theme`.
- Simple fades only (`sc-fade-in`, 0.2s); disabled under
  `prefers-reduced-motion`.
- **No gradients, no glow, no floating widgets, no decorative blobs.**
- **Zero `!important` in the stylesheet.** (None used; keep it that way.)
- One footer per page, rendered by the generator from `template.html`.
  Footer text — `© 2026 SuvoCalc — v31 · 57 free calculators` — is
  re-rendered from `tools.json` (`site.version`, counted-tool count) by
  `build.js`; the template copy is only a fallback.
- Header nav: Home, All Tools, Categories, Blog/Guides, About, Contact.
  Desktop top nav; mobile hamburger + fixed bottom nav (same links, one
  nav component, responsive). Active link is marked by `main.js` from
  `<body data-active-nav="…">`.

## Template tokens (template.html)

`{{PAGE_TITLE}}` `{{META_DESCRIPTION}}` `{{CANONICAL}}` `{{JSON_LD}}`
`{{H1}}` `{{BREADCRUMB}}` `{{CONTENT}}` `{{ACTIVE_NAV}}`
`{{EXTRA_HEAD}}` `{{EXTRA_SCRIPTS}}` `{{ASSET_PREFIX}}`

`{{ASSET_PREFIX}}` is set per page depth by the generator (`''` at root,
`'../'` one level down, `'../../'` two levels down) and is also written to
`<body data-tool-url-prefix="…">` so `main.js` can build correct tool links
from any page. The H1 is rendered by the template; page content must not
contain its own H1 (the generator strips the first `# ` line from `.md`).

## tools.json — real schema (as delivered 2026-11-21)

```json
{
  "site": { "name": "SuvoCalc", "version": "31", "versionLabel": "v31",
            "toolCount": 57, "baseUrl": "https://suvocalc.com" },
  "categories": [
    { "slug": "finance", "name": "Finance & Money" }
  ],
  "tools": [
    {
      "id": "emi", "slug": "emi-calculator", "title": "EMI Calculator",
      "description": "One-line description.",
      "category": "finance", "icon": "fa-solid fa-calculator",
      "popular": true, "featured": false,
      "fields": [
        { "id": "loanAmount", "label": "Loan Amount (₹)", "type": "number",
          "placeholder": "e.g. 500000", "default": 500000, "min": 0, "step": "any",
          "hint": "Optional hint shown under the label" }
      ],
      "calc": "/* verbatim v30 function body */",
      "resultLabel": "Monthly EMI"
    }
  ],
  "extraPages": null
}
```

- **7 real categories:** `finance` (11), `tax-business` (5),
  `investment-savings` (9), `health-fitness` (8), `education-students` (5),
  `date-time` (3), `daily-utilities` (16 counted + 1 uncounted scientific-calculator). Categories carry **no
  descriptions** — the generator falls back to a count-based line on the
  category cards. If a tool names a category missing from `categories`,
  the generator derives a title-cased entry and warns if the total is
  not 7.
- **57 counted tools** = entries in `tools` with `counted !== false`. The
  registry has 58 entries: 57 counted + `scientific-calculator`
  (`counted: false`, `extra: 'scientific'`) inside `tools` itself;
  `extraPages` is null. The generator warns if the counted total is not
  57 and if `site.toolCount` disagrees, and renders the real count
  everywhere (footer, titles, counts).
- **Tool fields:** `id` is the short id (`emi`), `slug` is the long URL
  slug (`emi-calculator`), `category` is a category slug, `icon` is a
  Font Awesome class name (v31 loads no icon font — tool cards use one
  generic inline SVG glyph instead), `featured` is set only on
  `gst-calculator`, `popular` on 8 tools, `resultLabel` is the shared
  result-box label, `note` exists only on `gst-calculator` (trusted HTML,
  rendered raw in a "Notes & sources" section). Only
  `scientific-calculator` has `extra: 'scientific'`.
- **`calc` (not `calcFunction`)** holds the verbatim v30 function body.
  It calls `calc.js` helpers directly (`getId`, `SYM`, `fmt`, `isValidNum`,
  `safeNum`, `setRes`, `showValError`) and `document.getElementById`.
- Field `type`: `number` (143) | `select` (27, options in `opts` — strings
  or `{value,label}`) | `text` (10) | `date` (5) | `checkbox` (4, with
  `checked`) | `color` (2) | `file` (2) | `time` (1) |
  `datetime-local` (1) | `range` (1). Fields are rendered as-is.
- `popular: true` feeds the homepage Popular section (8, filled from
  registry order if fewer than 8 are flagged). `featured: true` picks the
  homepage Featured Tool (`gst`, fallback `resolveToolSlug('gst')`).
- **Slug convention: either works.** The content worker writes long slugs
  (`emi-calculator`, `gst-calculator`) and the audit inventory uses short
  ids (`emi`, `gst`, `pct`). The generator resolves both via
  `resolveToolSlug()` + a `SLUG_ALIASES` table in `build.js`, so the
  registry worker may use short or long slugs. One rule: the slug in
  `tools.json` is the URL slug (`/calculators/<slug>/`).

## content/tools/<slug>.json — expected schema (contract for content worker)

```json
{
  "slug": "emi-calculator",
  "intro": "One-paragraph intro.",
  "uses": "What it is used for.",
  "formula": "EMI = P × r × (1+r)^n / ((1+r)^n − 1), where P is …",
  "example": "Worked example with real numbers.",
  "howTo": ["Step 1.", "Step 2."],
  "tips": ["…"],
  "mistakes": ["…"],
  "faqs": [{ "q": "…", "a": "…" }],
  "related": ["loan-eligibility-calculator", "loan-affordability-calculator"]
}
```

Field names are the content worker's real ones: `uses` (not `usedFor`),
`slug` is the long form. `explanation`, `formulaNote` and `lastReviewed`
are also accepted when present. Every field is optional except the file
itself — a missing field omits that section; a missing file skips the whole
tool page with a warning. `related` is capped at 3, resolved through the
slug aliases, and filled from the same category when short. Content files
are found by the JSON's own `slug` field or the filename stem, so short
registry slugs still resolve to long content files.

## Blog .md format (contract for content worker)

Optional front matter, then Markdown:

```md
---
title: "GST Calculator: How GST Works in India"
minutes: 5
related: ["gst-calculator", "income-tax-calculator", "percentage-calculator"]
---

<div class="blog-toc">…</div>
<h2>What is GST?</h2>
<p>Body text…</p>
```

Front matter keys are the content worker's real ones: `title` (quoted),
`minutes` (not `readMinutes`), `related` as a JSON-ish list of long tool
slugs. Bodies are **raw HTML** (headings, paragraphs, tables, `.formula-box`
and `.tip-box` callouts) — the generator passes HTML lines through
unescaped, so plain Markdown works too but HTML is what ships. `style.css`
styles `.blog-toc`, `.formula-box` and `.tip-box` (`.tip` / `.warn` / `.ok` /
`.def`). Note: the blog HTML uses Font Awesome `<i class="fa-solid …">`
classes, which v31 deliberately does not load (no icon font by design) —
the label text still renders, the icon glyph does not.

Static pages (`content/pages/about.md` etc.) use the same front-matter
shape (`title: "…"`) with a Markdown body; the generator strips the front
matter and the first `# ` heading (the template renders the only H1).

## calc.js — real contract (as delivered by W1a, 2026-11-21)

`template.html` loads `assets/js/calc.js` before `main.js`. It defines
these globals, which the verbatim v30 calc bodies call directly:

- `getId(id)` — `document.getElementById(id)`.
- `SYM()` — returns `₹`.
- `fmt(n, sep)` — Indian-format number display.
- `isValidNum(v)`, `safeNum(v)` — number guards.
- `setRes(toolId, value, label, detailsHtml)` — writes `#res-value` /
  `#res-label` / `#res-details`, shows `#res-box`, guards NaN/Infinity,
  keeps `window._resStore` (used by the Share button).
- `showValError(toolId, msg)` — writes `#res-error`, hides `#res-box`.

**v30 functions are NOT in calc.js.** The 9 V30 tools (`fd`, `hra`,
`unitprice`, `cagr`, `networth`, `homeloan`, `emi2`, `numera`, `love`)
call `v30ShowResult('<id>Res', …)` / `v30Fmt()` instead. The generator
emits `window.v30Fmt` (source L24628–24631) + `window.v30ShowResult`
(L24633–24642) verbatim on V30 tool pages only (detected by the calc body
containing `v30ShowResult`/`v30Fmt`). Do NOT edit `calc.js` to add them —
it is W1a's file.

Per-tool calculation: the tool's `calc` string from `tools.json` is inlined
by the generator into a `<script>` on that tool's page (see "Per-tool page
script" below). If a tool has no `calc`, Calculate shows an honest "not
available yet" message instead of failing silently.

### Per-tool page script (generator-assembled, in order)

1. **No-op stubs** on every tool page: `toast()`, `trackTool()`,
   `bumpStreak()`, `checkMilestone()`, `v21Haptic()`, `injectBMIGauge()`,
   `renderH()`. Verbatim calc bodies call these unguarded at their tails
   (`savgoal`, `bmi`, `wtr`, `sleep`, `pomo`, `attend`, `qr`, `qrscan`,
   `speed`, `sci`); `v21Haptic&&v21Haptic(8)` in `qr` throws a
   ReferenceError if undeclared, so the stub must declare it. v31 has none
   of those systems — the stubs are harmless by design.
2. **V30 snippet** (V30 pages only, see above).
3. **Companion functions/state** from `companions.json` — verbatim
   extracts from the v30 source, keyed by tool id, each citing source
   lines. The generator loads `companions.json` at build time and warns
   if a tool page needs companions that are missing.
4. **Named wrapper**: 9 calc bodies are the body of a named v30 function
   (verified by whitespace-normalised diff against the source), so the
   generator wraps the body back into that function: `tzc`→`doTZ`,
   `conv`→`doTP`, `graph`→`drawGraph`, `pomo`→`pomStart`,
   `matrix`→`matOp(op)`, `qr`→`qr22Generate`, `qrscan`→`startQRScan`,
   `worldclock`→`updateWorldClock`, `sci`→`act(a,v)`. All other calc
   bodies run as an anonymous `runToolCalc()`.
5. **`runToolCalc()`** — what the Calculate button runs (matrix passes
   `window.__matOp || 'add'`; sci evaluates the `sciExpr` field via
   `safe()` instead of `act()`).
6. **Submit wiring + per-tool extra wiring**, all guarded with try/catch:
   pomo mode select (minutes parsed from "Pomodoro (25 min)"), sleep mode
   select (value containing "wake" → `_sleepMode='wake'`), conv `tpTab`
   select (Currency→fx, Length→len, Weight→wt, Temperature→tmp; refreshes
   `tp2`/`tp3` options from `cvCfg`), qr template select + input debounce
   + logo file, qrscan file input, graph preset buttons, matrix op buttons,
   speed tab buttons, worldclock city select, sci keypad (`data-a`/`data-v`)
   + steps button. Initial draws: `initPom()`, `doTP()`, `drawGraph()`.

### Companion functions (verbatim, in `companions.json`)

| Tool | Companions (source lines) |
|---|---|
| pwd | `copyPwd()` L7757–7764 |
| tzc | `tzOffsets` L7767 |
| conv | `cvCfg` L6078–6083, `tpM` L7779, `setTP()` L7780, `renderTP()` L7781–7786 |
| graph | `setGraphFn()` L7798 + resize listener L7844 |
| pomo | state L7847, `initPom()` L7848, `setPomMode()` L7849–7856, `pomReset()` L7871, `updatePomDisplay()` L7872–7876 |
| matrix | none |
| qr | state L7899–7902, `QR22_TEMPLATES` L7904–7913, `qr22SetTemplate/Debounce/BuildText/OverlayLogo/Download/CopyURL/Share/LogoSelected/ClearLogo/AddHistory/RenderHistory/RestoreHistory` L7915–8115 |
| wtr | none |
| sleep | `_sleepMode` L9740, `sleepTab()` L9741–9747 |
| speed | `_speedMode` L9720, `speedMode()` L9721–9730 + paceRace listener L9731–9737 |
| stats | none |
| qrscan | state L19675–19676, `stopQRScan/scanQRFile/showQRResult/copyQRResult/openQRLink` L19712–19757 |
| worldclock | 1s tick `setInterval(updateWorldClock,1000)` + immediate call L19770–19771 |
| split19 | none |
| sci | state L5891–5892, display consts `dNum/dExpr/dSteps/memBadge/memDisp/memBV` L5893–5898, `adjustFS()` L5909, `toggleSteps()` L5910, `safe()` L5911–5917, `fullE()` L5918, `setD()` L5919–5923, mem restore L5969, `updMem()` L5970, `pushH()` L6002–6007 |

Shims beyond the listed items: `adjustFS` (called by `setD`) ships inside
the sci companions; `renderH()` is a no-op stub (called by `pushH()`; v31
has no history UI). Extraction was verified by a one-off script that
asserted every range against the source; the script is not part of the
site (`/tmp/extract-companions.js`, since removed). **2026-11-21 fix:** the
first extraction shipped `setPomMode` with its body missing (L7850–7856),
which left an unclosed function and broke the pomodoro page script
(`node --check` caught it). Fixed by re-extracting L7847–7856 + L7871–7876
into `companions.json`. A re-extraction audit then confirmed every other
entry identical to the source ignoring blank lines. Note the qr entry
correctly omits `qr22Generate` — that is the calc body, shipped as the
named wrapper, not a companion. Two legacy strings that look like version
numbers are intentional verbatim v30 names, not version claims:
`v21Haptic` (stub name) and `v23-qr-scan-line` (CSS class in the qrscan
companions).

### Output containers (derived by the generator)

The generator scans the calc body + companion code (+ V30 snippet) for
`getElementById('X')` and `v30ShowResult('X')` and emits a container for
each id that is not a field id and not rendered explicitly elsewhere:
`*Canvas` → `<canvas>`, `qrVideo` → `<video playsinline muted
style="display:none">`, `qr22Img` → `<img>`, everything else →
`<div class="tool-output">`. Explicitly rendered instead: sci display +
keypad (`dNum/dExpr/dSteps/memBadge/memDisp/memBV/stepsBtn`), speed
wrappers (`speedSDT/speedPACE/paceCustomWrap`), qrscan media + result
block (`qrVideo/qrFrame/qrResult/qrResultTxt/qrOpenBtn`), qr input label
(`qr22InputLabel`).

### Result-box rule

The standard `#res-box` result section is kept **only** where
`setRes()`/`showValError()` are actually used (standard tools, `stats`,
sci submit evaluation). Custom-render tools (companions) and V30 tools
write their own containers instead, so they get no standard box.

### QR Generator is online-only

`qr22Generate` builds an `api.qrserver.com` image URL (Google Charts
fallback) — the QR Generator page needs internet; everything else works
offline. The logic is verbatim v30 and must not be changed.

## main.js behaviour (localStorage keys)

- `sc_theme` — `light` | `dark`. Applied pre-paint by a small inline script
  in the template `<head>`; toggled by the single header button.
- `sc_recently_used` — array of `{slug, title}`, max 6, most recent first.
  Recorded on every tool-page load (from `<body data-tool-slug>` /
  `data-tool-title`, written by the generator). The homepage Recently Used
  section is rendered from it and stays `hidden` when empty.
- `sc_cookie_seen` — `1` after the cookie banner is dismissed. The banner
  shows once; nothing else auto-pops.

Search: the homepage embeds `<script type="application/json" id="tool-index">`
with `{slug, title, category, description}` for all counted tools; `main.js`
filters it live (all query words must match). `/tools/` filters the
server-rendered cards by `data-title`/`data-description` and the category
filter buttons (`data-filter-category`).

## SEO

- Per tool page: unique `<title>` (`<Tool> | SuvoCalc v31`), unique meta
  description, canonical `https://suvocalc.com/calculators/<slug>/`,
  JSON-LD `WebApplication` + `BreadcrumbList` + `FAQPage` (when FAQs exist).
- Homepage JSON-LD: `WebApplication` with `softwareVersion "31.0"`.
- `sitemap.xml` lists every generated page; `robots.txt` allows all and
  points at the sitemap. No `SearchAction` (the `?q=` parameter is not
  implemented — see audit §D6/M10).
- No placeholder AdSense client, no empty ad slots, no fake counts.

## Decisions / deviations (for other workers)

1. **Real category slugs, not the audit's 7.** The registry's 7 are
   `finance`, `tax-business`, `investment-savings`, `health-fitness`,
   `education-students`, `date-time`, `daily-utilities`. Date & time tools
   and `pwd` are in `daily-utilities`; fun tools (`numera`, `love`) are in
   `daily-utilities` too, labelled "Just for fun" in their content.
2. **Homepage dedupe.** A tool appears in at most one homepage section;
   the generator tracks used slugs (Featured → Popular → finance/tax →
   health → student → utility). Group picks are data-driven by category
   slug (finance = slugs starting `finance`/`tax`; health = contains
   `health`; student = contains `education`/`student`; utility = contains
   `utilit`), with each section linking to the first slug in its group —
   so a registry rename still works.
3. **Featured tool is the registry `featured` flag** (`gst-calculator`,
   "Updated for GST 2.0"), falling back to `resolveToolSlug('gst')` — not
   rotating weekly. Rotation can be added later by changing the flag.
4. **Scientific calculator is a generator-rendered tool page**, not a
   `calc.js` keypad: display (`#dNum/#dExpr/#dSteps`, memory badge,
   steps button) + a 36-button keypad (`data-a`/`data-v`, drives the
   verbatim `act(a,v)`) + a `sciExpr` field + the standard result box.
   Its "Open Calculator" button (homepage callout) links to
   `/calculators/scientific-calculator/`.
5. **No homepage H1 duplication.** The template renders the single H1; the
   homepage passes `heroTitle` as `{{H1}}` and the generator adds a
   `page-home` class to `<main>` for hero centring.
6. **Template body carries `data-tool-url-prefix`.** Needed so `main.js`
   search-result cards link correctly from pages at any depth.
7. **Footer version/count are re-rendered from `tools.json`** by the
   generator (regex replace on the template copy), so the template text is
   never the source of truth.
8. **No `!important` anywhere** in `style.css`; no gradients/glow/particles.
9. **Cookie banner is the only auto-shown prompt.** No welcome overlay, no
   PWA banner in this build (audit §D5 one-prompt rule).
10. **Blog `related` normalization.** The generator normalizes blog
    `related` slugs against `tools.json` via `SLUG_ALIASES`; the one
    non-canonical slug found is `unit-and-currency-converter` →
    `unit-currency-converter` (electricity-bill article). The `.md` file
    itself was not edited.
11. **Date & Time `related` fix.** The three content files had duplicated
    slugs; they were fixed directly (2026-11-21):
    `date-difference-calculator` → `[time-zone-converter, world-clock,
    age-calculator]`; `time-zone-converter` →
    `[date-difference-calculator, world-clock, unit-currency-converter]`;
    `world-clock` → `[time-zone-converter, date-difference-calculator,
    pomodoro-study-timer]`. The generator also guarantees the invariant:
    after same-category fill, if still fewer than 3 related links, fill
    from other categories in registry order (deduped, never self, never
    repeated).
12. **Related links are capped at 3** and resolved through the slug
    aliases; content lists come first, then same-category fill, then
    cross-category fill (see 11).
13. **Registry categories have no descriptions** — category cards fall
    back to a count-based line ("Browse N free <Name> calculators.").
14. **QR Generator needs internet** (api.qrserver.com); everything else
    works offline. See "QR Generator is online-only" above.
15. **Tool `note` (gst only)** is trusted HTML from `tools.json`,
    rendered raw in a "Notes & sources" section.

## Stub test (2026-11-21, W1b)

Two runs, both in `/tmp` copies (the real workspace was never built into;
no stubs were left in real `content/`; temp dirs deleted after testing).

1. **Stub run** (stub `tools.json`, 57 short-slug tools + sci, stub content
   for emi/gst/scientific, stub blog + page `.md`): 92 files, 0 warnings,
   idempotent (identical md5 on re-run), correct relative asset paths at
   every depth, no leftover `{{tokens}}`, no banned strings (precise check:
   no `69 tools`, `45+`, `v28/v21/v23`, `SuvoCalc 6.x`, `Powered by
   Claude`, `ca-pub` — substrings like `69` inside `₹11,61,695` or
   `60–69%` in real content are legitimate numbers, not the banned
   claims), homepage dedupe fixed (featured gst reserved before Popular;
   per-section distinct slugs verified), EMI page had all sections/SEO/
   result ids/inlined calc/single H1/single footer, blog raw HTML passed
   through unescaped, sitemap 90 URLs, scientific-calculator in sitemap
   but not in `/tools/` or category pages, category counts 11/5/9/8/5/3/16
   = 57 (daily-utilities has a 17th entry, the uncounted scientific-calculator).
2. **Full real-input run** (real `tools.json` + real content + real
   `calc.js` + `companions.json`, 2026-11-21, in a `/tmp` copy): with a
   temp-only stub `content/tools/scientific-calculator.json` (the content
   worker delivered 57 tool JSONs; sci is missing — see below): **91 files,
   0 warnings, idempotent** (identical md5 on re-run). Verification script
   (`/tmp/verify31.js`, since removed): **23 passed, 0 failed** — 89 HTML
   pages (58 calculator + 7 category + 16 blog + 6 static + homepage +
   tools index), sitemap 89 URLs = page count, single H1 + single footer
   everywhere, no `{{tokens}}`, no-op stubs on every tool page, named
   wrappers present, companion tokens on all 10 tools that have them,
   V30 snippet + Res divs on all 9 V30 pages (and no standard res-box
   there), every id referenced by a page script exists in its HTML,
   container derivation spot-checked (`#graphCanvas`, `#res-wtr`,
   `#qr22Img`, sci 40-key keypad, speed tab bar + SDT/PACE groups, 10
   world-clock rows, qrscan video + result block, gst note), homepage
   dedupe holds (26 section tools + gst featured + sci callout = 28
   distinct linked slugs, none in two sections), no banned strings
   (`v21Haptic` and `v23-qr-scan-line` are verbatim v30 names, not version
   claims), `node --check` on all 147 emitted inline scripts (0 failures).
   DOM-shim smoke test (`/tmp/smoke31.js`, since removed): **89 pages ran
   calc.js + main.js + inline scripts, 58 submit handlers fired, 0
   uncaught exceptions** — load-time and Calculate-path both clean under
   the shim (empty fields; real values untested). Two real bugs found and
   fixed by this run: (a) `companions.json` pomo entry shipped
   `setPomMode` without its body — fixed by re-extraction; (b) custom-
   render pages had no `#res-error` for the submit catch to report into —
   the generator now emits a hidden `#res-error` on every tool page.
   **Open gap (not mine — content worker's file): no
   `content/tools/scientific-calculator.json` exists**, so a real build
   skips the sci page with 1 warning and writes 90 files. The assembly
   worker needs that file (or a decision to ship sci without editorial
   content) before the sci page can go live.

Limitation: `main.js` was syntax-checked only, never executed (no browser
available to a subagent); device testing is still owed.

## Assembly (2026-11-21, wave-2 assembly worker)

**Build command:** `cd ~/workspace/suvocalc-v31 && node build.js`
**Result: 91 files written, 0 warnings, exit 0** — run twice (second run
identical md5s on `index.html`, `calculators/emi-calculator/index.html`,
`sitemap.xml`: idempotent). Breakdown: 89 HTML pages (homepage 1, tools
index 1, category pages 7, calculator pages 58 = 57 counted + scientific,
blog index + 15 articles = 16, info pages 6) + `sitemap.xml` + `robots.txt`.

**New content file written:** `content/tools/scientific-calculator.json`
(the missing file flagged in the stub test above — now present, so the sci
page builds with no warning). Schema matches the other 57 files exactly
(`slug`, `intro`, `uses`, `formula`, `example`, `howTo` ×6, `tips` ×4,
`mistakes` ×4, `faqs` ×4, `related` exactly 3:
`matrix-calculator`, `graph-plotter`, `statistics-calculator`). Formula
field describes standard operator precedence (brackets first, then powers/
roots, then ×/÷, then +/−) + the full function list (sin/cos/tan in degrees,
log/ln, sqrt, square/cube/powers, factorial, 1/x, π, memory). Example
verified with node: `(45 + 15) × 3 − 100 ÷ 4 = 155` (plus sin(30°) = 0.5,
log(100) = 2, √144 = 12). English, original text, no fake claims.

**Fixes made:** none. No generator bug, no bad content JSON, no missing
field was found — `build.js`, `template.html`, `style.css`, `main.js`,
`tools.json` and `companions.json` were not edited. The only file written
was the new `content/tools/scientific-calculator.json` above.

**Verification performed (grep + read of generated output, not the log):**
- 58 calculator pages exist, one per slug in `tools.json` (58 registry
  entries, 0 missing, 0 extra `index.html`).
- Every generated page has exactly one `<h1>` and exactly one `<footer>`
  (89 pages checked, 0 violations). No leftover `{{tokens}}` anywhere.
- Homepage: per-section slug audit — Popular 8, Featured 1 (gst), finance
  6, health 4, student 4, utility 5 = 28 distinct slugs, **no slug in two
  sections** (each card's title link + its own "Open Calculator" button
  account for the 2× href count per slug). No full keyboard on the
  homepage (`data-a=` count 0, no `dNum`/`sciExpr`). "Open Calculator"
  button at line 97 links to `calculators/scientific-calculator/`.
  Recently Used section exists in the HTML (`id="recently-used" hidden`).
- GST page: 9 Bengali (জিএসটি) hits, 0/5/18/40% options present, Add/Remove
  mode, CGST ×13 / SGST ×13 / IGST ×12, formula + CBIC (cbic.gov.in) +
  GST Council + "Last reviewed: 21 November 2026" + disclaimer box.
- Date & Time related links (output): date-difference →
  [age, time-zone-converter, world-clock]; time-zone-converter →
  [date-difference, unit-currency-converter, world-clock]; world-clock →
  [date-difference, pomodoro-study-timer, time-zone-converter] — 3
  distinct each, cross-category fallback working, no repeats.
- Blog related links: all 15 articles' links resolve to real tool slugs
  (alias normalization verified — electricity article links to
  `unit-currency-converter`, not the alias). Two source-content notes:
  password-generator article has only 2 related links, and the install-
  as-app article has none — generator did not break them; content as
  delivered.
- Banned strings in generated HTML: `45+` 0 hits, `v28` 0, `Powered by
  Claude` 0, `ca-pub-XXXXXXXXXXXXXXXX` 0, no "69 tools" claim anywhere.
  Substring hits that are **legitimate numbers, flagged not edited**:
  `69` in 6 files — CI `1.4693`/`₹1,46,933`; home-loan `₹3,20,692`; SIP
  `₹11,61,695`/`₹5,61,695`; heart-rate zones `156–169`; grade band
  `60–69% B`; sci companion comment line refs `5969-5970`. `6.0` in 2 blog
  files — CGPA table value `6.0 → 57%`, Chennai rate `₹6.00/unit`.
  `6.2` in calorie page — BMR formula `6.25 × height`. `v21` in all 58
  tool pages — the `v21Haptic()` no-op stub, an intentional verbatim v30
  name (see companions section above), not a version claim. `v23` in 1
  file — qr-scanner `v23-qr-scan-line` CSS class, likewise verbatim v30.
- Sitemap: 89 `<loc>` URLs = 89 HTML pages; `robots.txt` points at
  `https://suvocalc.com/sitemap.xml`.
- `node --check` passes on `build.js`, `assets/js/main.js`,
  `assets/js/calc.js`.
- Spot-reads (all PASS): **emi** — inputs Loan Amount / Rate / Tenure,
  Calculate button, `#res-box` + `#res-error`, inline `runToolCalc`,
  all 8 sections in order. **gst** — Bengali-labelled inputs (Amount /
  Rate / Mode / Transaction Type), same, plus extra "Notes & sources"
  section. **bmi** — Height/Weight inputs, same, all 8 sections.
  **qr-code-generator** — template/size/logo inputs, Calculate button,
  `#res-error`, inline script, all 8 sections; **no standard `#res-box`
  by design** (custom-render tool — result goes to its own `#qr22Img`
  container, present ×4). Sci page itself: all 8 sections, 40-key keypad
  (`data-a=` ×40), `#dNum`/`#dExpr`/`#res-box`, example 155 present.
  Full sweep: all 58 tool pages contain all 8 standard sections; the
  only extra section anywhere is GST "Notes & sources".

**Remaining known issues for the verification worker:**
1. The flagged legitimate-number substrings above (`69`, `6.0`, `6.2`,
   `v21`, `v23`) — confirm the verification worker's banned-string check
   treats them as legitimate, not as version/count claims.
2. Blog related-link counts: password article 2 links, install article 0
   — decide whether to add a third/any related links in the source `.md`.
3. `main.js` still never executed (no browser available to a subagent);
   Recently Used / search / theme behaviour needs a real browser or
   device test, as does every calculator's Calculate path with real
   values (the earlier DOM-shim smoke test covered empty-field submits
   only).
4. QR Generator needs internet (api.qrserver.com) — unchanged, by design.

2026-11-21: GitHub Pages enabled (Deploy from a branch, main, /). Trigger push - first deployment had not appeared ~6 min after enabling.
