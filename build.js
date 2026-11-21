#!/usr/bin/env node
'use strict';
/**
 * SuvoCalc v31 — static site generator (Node, no dependencies).
 *
 * Reads:
 *   template.html                  base layout (tokens, see below)
 *   tools.json                     the ONE registry: site, categories, tools
 *   content/pages/home.json        homepage copy
 *   content/tools/<slug>.json      per-tool editorial content
 *   content/blog/<slug>.md         blog articles (front matter + Markdown)
 *   content/pages/<page>.md        about / contact / privacy / terms /
 *                                  disclaimer / faq
 *
 * Writes (all under this directory, overwriting as needed):
 *   index.html, tools/index.html, categories/<slug>/index.html,
 *   calculators/<slug>/index.html, blog/index.html, blog/<slug>/index.html,
 *   about|contact|privacy|terms|disclaimer|faq/index.html,
 *   sitemap.xml, robots.txt
 *
 * Re-runnable and idempotent: creates directories as needed, overwrites
 * outputs, never deletes anything it did not write.
 *
 * Tolerance: a missing per-tool content JSON, blog .md or static-page .md
 * SKIPS that page with a console warning instead of crashing, so the site
 * can be built and tested before all content exists. tools.json and
 * template.html are required — without them nothing can be generated.
 *
 * Template tokens (replaced verbatim, every occurrence):
 *   {{PAGE_TITLE}} {{META_DESCRIPTION}} {{CANONICAL}} {{JSON_LD}} {{H1}}
 *   {{BREADCRUMB}} {{CONTENT}} {{ACTIVE_NAV}} {{EXTRA_HEAD}}
 *   {{EXTRA_SCRIPTS}} {{ASSET_PREFIX}}
 *
 * Usage:  node build.js        (run from anywhere; paths resolve from
 *                               this file's directory)
 */

var fs = require('fs');
var path = require('path');

var ROOT = __dirname;
var BASE_URL = 'https://suvocalc.com';
var VERSION_FALLBACK = '31';

/* ------------------------------------------------------------------ */
/* small utilities                                                     */
/* ------------------------------------------------------------------ */

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function readFile(file) {
  return fs.readFileSync(file, 'utf8');
}

function fileExists(file) {
  try { return fs.statSync(file).isFile(); } catch (e) { return false; }
}

function readJson(file) {
  return JSON.parse(readFile(file));
}

function writeFile(rel, content) {
  var full = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
}

function assetPrefixFor(outDir) {
  // outDir is '' for the homepage, 'tools' for tools/, 'calculators/emi'...
  if (!outDir) return '';
  var depth = outDir.split('/').filter(Boolean).length;
  return '../'.repeat(depth);
}

function inlineMd(text) {
  var out = esc(String(text == null ? '' : text));
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
  return out;
}

function parseFrontMatter(text) {
  // Optional YAML-ish block: ---\nkey: value\n---\n<body>
  // Values may be quoted ("...") or a JSON-ish list (["a", "b"]).
  var meta = {};
  var body = text;
  if (text.indexOf('---') === 0) {
    var end = text.indexOf('\n---', 3);
    if (end !== -1) {
      var block = text.slice(3, end).trim();
      block.split('\n').forEach(function (line) {
        var i = line.indexOf(':');
        if (i > 0) {
          var raw = line.slice(i + 1).trim();
          var val = raw;
          if ((val.charAt(0) === '"' && val.charAt(val.length - 1) === '"') ||
              (val.charAt(0) === "'" && val.charAt(val.length - 1) === "'")) {
            val = val.slice(1, -1);
          } else if (val.charAt(0) === '[') {
            try { val = JSON.parse(val.replace(/'/g, '"')); } catch (e) { /* keep raw */ }
          }
          meta[line.slice(0, i).trim()] = val;
        }
      });
      body = text.slice(end + 4).replace(/^\n/, '');
    }
  }
  return { meta: meta, body: body };
}

function mdToHtml(md) {
  var lines = String(md || '').replace(/\r\n/g, '\n').split('\n');
  var html = [];
  var i = 0;

  function isTableRow(line) { return /^\s*\|.*\|\s*$/.test(line); }
  function isSepRow(line) { return /^\s*\|[\s:|-]+\|\s*$/.test(line); }
  function tableCells(line) {
    return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|')
      .map(function (c) { return inlineMd(c.trim()); });
  }

  while (i < lines.length) {
    var line = lines[i];

    if (/^\s*$/.test(line)) { i++; continue; }

    if (/^```/.test(line)) {
      var code = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) { code.push(lines[i]); i++; }
      i++;
      html.push('<pre><code>' + esc(code.join('\n')) + '</code></pre>');
      continue;
    }

    var h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      var level = h[1].length;
      html.push('<h' + level + '>' + inlineMd(h[2].trim()) + '</h' + level + '>');
      i++;
      continue;
    }

    if (/^\s*---+\s*$/.test(line)) { html.push('<hr>'); i++; continue; }

    // Raw HTML block: content authors may embed HTML (tables, callout divs).
    // Lines starting with '<' pass through untouched, unescaped.
    if (/^\s*</.test(line)) {
      var raw = [];
      while (i < lines.length && /^\s*</.test(lines[i])) { raw.push(lines[i]); i++; }
      html.push(raw.join('\n'));
      continue;
    }

    if (isTableRow(line) && i + 1 < lines.length && isSepRow(lines[i + 1])) {
      var head = tableCells(line);
      i += 2;
      var rows = [];
      while (i < lines.length && isTableRow(lines[i])) { rows.push(tableCells(lines[i])); i++; }
      var t = '<table><thead><tr>' + head.map(function (c) { return '<th>' + c + '</th>'; }).join('') + '</tr></thead><tbody>';
      rows.forEach(function (r) {
        t += '<tr>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>';
      });
      html.push(t + '</tbody></table>');
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      var items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push('<li>' + inlineMd(lines[i].replace(/^\s*[-*]\s+/, '')) + '</li>');
        i++;
      }
      html.push('<ul>' + items.join('') + '</ul>');
      continue;
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      var nums = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        nums.push('<li>' + inlineMd(lines[i].replace(/^\s*\d+[.)]\s+/, '')) + '</li>');
        i++;
      }
      html.push('<ol>' + nums.join('') + '</ol>');
      continue;
    }

    var para = [];
    while (i < lines.length && !/^\s*$/.test(lines[i]) &&
           !/^(#{1,3}\s|```|\s*[-*]\s+|\s*\d+[.)]\s+|\s*---+\s*$)/.test(lines[i]) &&
           !isTableRow(lines[i])) {
      para.push(lines[i].trim());
      i++;
    }
    if (para.length) html.push('<p>' + inlineMd(para.join(' ')) + '</p>');
  }
  return html.join('\n');
}

function stripFirstH1(md) {
  // Remove the first "# Title" line so the template's {{H1}} is the only H1.
  return String(md || '').replace(/^#{1}\s+.*(\r?\n|$)/m, '');
}

function jsonLdScript(obj) {
  if (!obj) return '';
  var json = JSON.stringify(obj).replace(/</g, '\\u003c');
  return '<script type="application/ld+json">\n' + json + '\n</script>';
}

function breadcrumbJsonLd(items) {
  // items: [{name, url}] — url is a path like '/calculators/emi/'
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(function (it, idx) {
      return {
        '@type': 'ListItem',
        position: idx + 1,
        name: it.name,
        item: BASE_URL + it.url
      };
    })
  };
}

function webAppJsonLd(tool, canonical) {
  var app = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: tool.title + ' | SuvoCalc',
    url: canonical,
    applicationCategory: 'CalculatorApplication',
    operatingSystem: 'Any',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    description: tool.description || ''
  };
  return app;
}

/* ------------------------------------------------------------------ */
/* load inputs                                                         */
/* ------------------------------------------------------------------ */

var templatePath = path.join(ROOT, 'template.html');
var toolsPath = path.join(ROOT, 'tools.json');
if (!fileExists(templatePath)) {
  console.error('ERROR: template.html not found in ' + ROOT);
  process.exit(1);
}
if (!fileExists(toolsPath)) {
  console.error('ERROR: tools.json not found in ' + ROOT + ' — nothing to generate.');
  process.exit(1);
}

var template = readFile(templatePath);
var registry = readJson(toolsPath);

var siteVersion = String((registry.site && registry.site.version) || VERSION_FALLBACK);
var siteName = (registry.site && registry.site.name) || 'SuvoCalc';
if (registry.site && registry.site.baseUrl) BASE_URL = String(registry.site.baseUrl).replace(/\/$/, '');

var categories = Array.isArray(registry.categories) ? registry.categories : [];
var catBySlug = {};
categories.forEach(function (c) { catBySlug[c.slug] = c; });

// Tools: the counted registry. `counted: false` entries (scientific
// calculator) live INSIDE registry.tools — they get a page + sitemap entry
// only, never a tools/category/homepage listing and never the count.
var allRegistryTools = Array.isArray(registry.tools) ? registry.tools : [];
var tools = allRegistryTools.filter(function (t) { return t.counted !== false; });
var extraPages = (Array.isArray(registry.extraPages) ? registry.extraPages : [])
  .concat(allRegistryTools.filter(function (t) { return t.counted === false; }));
var allPageTools = tools.concat(extraPages);
var toolBySlug = {};
allPageTools.forEach(function (t) { toolBySlug[t.slug] = t; });

// Short audit ids (§B) → long descriptive slugs used by the content files.
// Lets the generator work whichever slug convention tools.json uses.
var SLUG_ALIASES = {
  pct: 'percentage-calculator', ci: 'compound-interest-calculator',
  si: 'simple-interest-calculator', sal: 'salary-calculator',
  disc: 'discount-calculator', overtime: 'overtime-pay-calculator',
  loan: 'loan-eligibility-calculator', emi2: 'loan-affordability-calculator',
  lcomp: 'loan-comparison-calculator', tax: 'income-tax-calculator',
  hra: 'hra-exemption-calculator', homeloan: 'home-loan-tax-benefit-calculator',
  breakeven: 'break-even-calculator', stock: 'stock-profit-calculator',
  retire: 'retirement-calculator', fd: 'fixed-deposit-calculator',
  networth: 'net-worth-calculator', savgoal: 'savings-goal-calculator',
  preg: 'pregnancy-due-date-calculator', bodyfat: 'body-fat-calculator',
  wtr: 'water-intake-calculator', sleep: 'sleep-cycle-calculator',
  heartrate: 'heart-rate-calculator', pomo: 'pomodoro-study-timer',
  attend: 'attendance-calculator', elec: 'electricity-bill-calculator',
  fuel: 'fuel-cost-calculator', rng: 'random-number-generator',
  pwd: 'password-generator', conv: 'unit-currency-converter',
  graph: 'graph-plotter', qr: 'qr-code-generator',
  qrscan: 'qr-code-scanner', speed: 'speed-distance-time-calculator',
  unitprice: 'unit-price-calculator', stats: 'statistics-calculator',
  split19: 'split-bill-calculator', date: 'date-difference-calculator',
  tzc: 'time-zone-converter', worldclock: 'world-clock',
  numera: 'numerology-calculator', love: 'love-compatibility-calculator',
  sci: 'scientific-calculator',
  // Blog (W4) used a non-canonical slug for the converter — normalise it.
  'unit-and-currency-converter': 'unit-currency-converter'
};

// Resolve a slug that may be short ("gst") or long ("gst-calculator").
// The content worker writes long slugs; the registry may use either.
function resolveToolSlug(slug) {
  if (!slug) return null;
  if (toolBySlug[slug]) return toolBySlug[slug];
  var stripped = String(slug).replace(/-(calculator|converter|timer|generator|scanner|plotter|clock)$/, '');
  if (toolBySlug[stripped]) return toolBySlug[stripped];
  if (toolBySlug[slug + '-calculator']) return toolBySlug[slug + '-calculator'];
  if (SLUG_ALIASES[slug] && toolBySlug[SLUG_ALIASES[slug]]) return toolBySlug[SLUG_ALIASES[slug]];
  if (SLUG_ALIASES[stripped] && toolBySlug[SLUG_ALIASES[stripped]]) return toolBySlug[SLUG_ALIASES[stripped]];
  return null;
}

// Derive a category entry for any category slug the registry forgot.
tools.concat(extraPages).forEach(function (t) {
  if (t.category && !catBySlug[t.category]) {
    var name = t.category.replace(/[-_]/g, ' ').replace(/\b\w/g, function (ch) { return ch.toUpperCase(); });
    catBySlug[t.category] = { slug: t.category, name: name, description: '' };
    categories.push(catBySlug[t.category]);
  }
});

var toolCount = tools.length; // the single count, rendered everywhere
if (toolCount !== 57) {
  console.warn('WARNING: tools.json holds ' + toolCount + ' counted tools (expected 57). ' +
    'The generator uses the real count everywhere; check the registry.');
}
if (registry.site && registry.site.toolCount && registry.site.toolCount !== toolCount) {
  console.warn('WARNING: tools.json site.toolCount (' + registry.site.toolCount +
    ') disagrees with the counted tools (' + toolCount + '). Using ' + toolCount + '.');
}
if (categories.length !== 7) {
  console.warn('WARNING: ' + categories.length + ' categories in tools.json (expected 7).');
}

// Companion functions (verbatim v30 code, extracted by /tmp script — see
// companions.json + BUILD_NOTES.md). Keyed by tool id. Missing file = warn;
// the affected tool pages still build, but their custom rendering breaks.
var companions = {};
var v30Snippet = '';
(function loadCompanions() {
  var compPath = path.join(ROOT, 'companions.json');
  if (!fileExists(compPath)) {
    console.warn('WARNING: companions.json not found — custom-render tool pages will lack their companion functions.');
    return;
  }
  try {
    var data = readJson(compPath);
    companions = data.companions || {};
    v30Snippet = (data.v30 && data.v30.code) || '';
  } catch (e) {
    console.warn('WARNING: could not parse companions.json: ' + e.message);
  }
})();

function countInCategory(slug) {
  return tools.filter(function (t) { return t.category === slug; }).length;
}

function categoryName(slug) {
  return catBySlug[slug] ? catBySlug[slug].name : slug;
}

var homePath = path.join(ROOT, 'content', 'pages', 'home.json');
if (!fileExists(homePath)) {
  console.error('ERROR: content/pages/home.json not found — homepage copy is required.');
  process.exit(1);
}
var home = readJson(homePath);

/* ------------------------------------------------------------------ */
/* page rendering                                                      */
/* ------------------------------------------------------------------ */

var sitemapUrls = []; // path fragments, '' = homepage
var warnings = [];
var generated = [];

// Per-tool content, indexed by both the JSON's own `slug` field and the
// filename stem, so short registry slugs ("emi") and long content slugs
// ("emi-calculator") both resolve.
var toolContentBySlug = {};
(function () {
  var dir = path.join(ROOT, 'content', 'tools');
  var files = [];
  try { files = fs.readdirSync(dir).filter(function (f) { return /\.json$/i.test(f); }); } catch (e) { files = []; }
  files.forEach(function (f) {
    try {
      var data = readJson(path.join(dir, f));
      toolContentBySlug[f.replace(/\.json$/i, '')] = data;
      if (data && data.slug) toolContentBySlug[data.slug] = data;
    } catch (e) {
      warnings.push('could not read content/tools/' + f + ': ' + e.message);
    }
  });
})();

function renderPage(opts) {
  // opts: outDir, fileName, title, description, canonical, h1, breadcrumb,
  //       content, activeNav, jsonLd (object or array), extraHead, extraScripts
  var prefix = assetPrefixFor(opts.outDir || '');
  var canonical = opts.canonical || (BASE_URL + '/' + (opts.outDir ? opts.outDir + '/' : ''));
  var jsonLd = '';
  if (opts.jsonLd) {
    var blocks = Array.isArray(opts.jsonLd) ? opts.jsonLd : [opts.jsonLd];
    jsonLd = blocks.filter(Boolean).map(jsonLdScript).join('\n');
  }
  var html = template;
  var map = {
    '{{PAGE_TITLE}}': esc(opts.title || siteName),
    '{{META_DESCRIPTION}}': esc(opts.description || ''),
    '{{CANONICAL}}': esc(canonical),
    '{{JSON_LD}}': jsonLd,
    '{{H1}}': esc(opts.h1 || opts.title || siteName),
    '{{BREADCRUMB}}': opts.breadcrumb || '',
    '{{CONTENT}}': opts.content || '',
    '{{ACTIVE_NAV}}': esc(opts.activeNav || ''),
    '{{EXTRA_HEAD}}': opts.extraHead || '',
    '{{EXTRA_SCRIPTS}}': opts.extraScripts || '',
    '{{ASSET_PREFIX}}': prefix
  };
  Object.keys(map).forEach(function (token) {
    html = html.split(token).join(map[token]);
  });
  // Footer + brand version/count render from tools.json (never hardcoded).
  html = html.replace(/<span class="brand-version">[^<]*<\/span>/,
    '<span class="brand-version">v' + esc(siteVersion) + '</span>');
  html = html.replace(/&mdash; v\d+ &middot; \d+ free calculators/,
    '&mdash; v' + esc(siteVersion) + ' &middot; ' + toolCount + ' free calculators');
  // Page-specific body class (homepage gets .page-home for hero styling).
  if (opts.bodyClass) {
    html = html.replace('class="page-main"', 'class="page-main ' + opts.bodyClass + '"');
  }
  // Tool pages: record slug/title on <body> so main.js logs recently-used.
  if (opts.toolSlug) {
    html = html.replace(' data-tool-url-prefix="' + prefix + '"',
      ' data-tool-url-prefix="' + prefix + '" data-tool-slug="' + esc(opts.toolSlug) +
      '" data-tool-title="' + esc(opts.toolTitle || opts.toolSlug) + '"');
  }
  var rel = (opts.outDir ? opts.outDir + '/' : '') + (opts.fileName || 'index.html');
  writeFile(rel, html);
  sitemapUrls.push(opts.outDir ? opts.outDir + '/' : '');
  generated.push(rel);
  return html;
}

function breadcrumbHtml(items) {
  var lis = items.map(function (it, idx) {
    var last = idx === items.length - 1;
    if (last) return '<li><span aria-current="page">' + esc(it.name) + '</span></li>';
    return '<li><a href="' + esc(it.url) + '">' + esc(it.name) + '</a></li>';
  }).join('');
  return '<nav class="breadcrumb" aria-label="Breadcrumb"><ol>' + lis + '</ol></nav>';
}

function toolCardHtml(tool, prefix) {
  var url = prefix + 'calculators/' + encodeURIComponent(tool.slug) + '/';
  // Registry `icon` values are Font Awesome class names; v31 loads no icon
  // font, so every card uses one inline SVG calculator glyph instead.
  return '<article class="card tool-card" data-category="' + esc(tool.category || '') +
    '" data-title="' + esc(tool.title || '') +
    '" data-description="' + esc(tool.description || '') + '">' +
    '<span class="tool-icon" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="11" x2="8" y2="11.01"/><line x1="12" y1="11" x2="12" y2="11.01"/><line x1="16" y1="11" x2="16" y2="11.01"/><line x1="8" y1="15" x2="8" y2="15.01"/><line x1="12" y1="15" x2="12" y2="15.01"/><line x1="16" y1="15" x2="16" y2="15.01"/></svg></span>' +
    '<h3><a href="' + esc(url) + '">' + esc(tool.title) + '</a></h3>' +
    '<p>' + esc(tool.description || '') + '</p>' +
    '<span class="category-tag">' + esc(categoryName(tool.category)) + '</span>' +
    '<a class="btn btn-secondary btn-small" href="' + esc(url) + '">Open Calculator</a>' +
    '</article>';
}

function toolIndexJson(toolsList) {
  return toolsList.map(function (t) {
    return {
      slug: t.slug,
      title: t.title,
      category: t.category,
      categoryLabel: categoryName(t.category),
      description: t.description || ''
    };
  });
}

/* ------------------------------------------------------------------ */
/* per-tool page                                                       */
/* ------------------------------------------------------------------ */

function fieldHtml(field, labelId) {
  var id = esc(field.id);
  var label = esc(field.label || field.id);
  var hint = field.hint ? '<span class="field-hint">' + esc(field.hint) + '</span>' : '';
  var common = ' id="' + id + '" name="' + id + '"';
  var labelAttr = labelId ? ' id="' + esc(labelId) + '"' : '';
  var input = '';
  // Select options live in `opts` (real registry) or `options` (stub form);
  // each option is a string or {value, label}.
  var optList = field.opts || field.options || null;
  if (field.type === 'select' && Array.isArray(optList)) {
    var opts = optList.map(function (o) {
      var val = typeof o === 'string' ? o : o.value;
      var lab = typeof o === 'string' ? o : (o.label || o.value);
      var sel = String(val) === String(field.default) ? ' selected' : '';
      return '<option value="' + esc(val) + '"' + sel + '>' + esc(lab) + '</option>';
    }).join('');
    input = '<select' + common + '>' + opts + '</select>';
  } else if (field.type === 'radio' && Array.isArray(optList)) {
    var radios = optList.map(function (o) {
      var val = typeof o === 'string' ? o : o.value;
      var lab = typeof o === 'string' ? o : (o.label || o.value);
      var chk = String(val) === String(field.default) ? ' checked' : '';
      return '<label><input type="radio" name="' + id + '" value="' + esc(val) + '"' + chk + '> ' + esc(lab) + '</label>';
    }).join('');
    input = '<div class="radio-group">' + radios + '</div>';
  } else if (field.type === 'checkbox') {
    input = '<input type="checkbox"' + common + (field.checked ? ' checked' : '') + '>';
    return '<div class="field field-checkbox"><label for="' + id + '">' + input + ' ' + label + hint + '</label></div>';
  } else {
    // number, text, date, time, datetime-local, color, file, range, ...
    // rendered as-is from tools.json; unknown types fall back to text.
    var known = { number: 1, text: 1, date: 1, time: 1, 'datetime-local': 1, color: 1, file: 1, range: 1 };
    var type = known[field.type] ? field.type : 'text';
    var attrs = '';
    if (field.placeholder) attrs += ' placeholder="' + esc(field.placeholder) + '"';
    if (type !== 'file' && field.default != null) attrs += ' value="' + esc(field.default) + '"';
    if (field.min != null) attrs += ' min="' + esc(field.min) + '"';
    if (field.max != null) attrs += ' max="' + esc(field.max) + '"';
    if (field.step != null) attrs += ' step="' + esc(field.step) + '"';
    input = '<input type="' + type + '"' + common + attrs + '>';
  }
  return '<div class="field"><label for="' + id + '"' + labelAttr + '>' + label + hint + '</label>' + input + '</div>';
}

/* ------------------------------------------------------------------ */
/* per-tool inline script: stubs + companions + calc wiring            */
/* ------------------------------------------------------------------ */

// Verbatim v30 calc bodies call these legacy helpers (toasts, usage
// tracking, streaks, haptics, gauge). v31 has none of those systems;
// the stubs keep a calculation from throwing after it writes its result.
var NOOP_STUBS = [
  '/* v31 no-op stubs: the verbatim v30 calc bodies call these legacy',
  '   helpers (toast, usage tracking, streaks, haptics, gauge). v31 has',
  '   none of those systems; the stubs keep a calculation from throwing',
  '   after it has written its result. */',
  'function toast(){}',
  'function trackTool(){}',
  'function bumpStreak(){}',
  'function checkMilestone(){}',
  'function v21Haptic(){}',
  'function injectBMIGauge(){}',
  '/* renderH: the sci history UI does not exist in v31; pushH() still',
  '   records to localStorage, renderH() just has nothing to paint. */',
  'function renderH(){}'
].join('\n');

// Calc bodies that are the body of a named v30 function (verified: each
// body matches its source function verbatim, whitespace-normalised). The
// generator wraps the body back into that function so companions can call
// it by name (doTP from renderTP, qr22Generate from qr22Debounce, ...).
var NAMED_WRAPPERS = {
  tzc: { name: 'doTZ', params: '' },
  conv: { name: 'doTP', params: '' },
  graph: { name: 'drawGraph', params: '' },
  pomo: { name: 'pomStart', params: '' },
  matrix: { name: 'matOp', params: 'op' },
  qr: { name: 'qr22Generate', params: '' },
  qrscan: { name: 'startQRScan', params: '' },
  worldclock: { name: 'updateWorldClock', params: '' },
  sci: { name: 'act', params: 'a, v' }
};

// Element ids rendered explicitly by the generator (display, wrappers,
// result blocks) — the container scan must not emit them a second time.
var HANDLED_IDS = {
  sci: ['dNum', 'dExpr', 'dSteps', 'memBadge', 'memDisp', 'memBV', 'stepsBtn'],
  speed: ['speedSDT', 'speedPACE', 'paceCustomWrap'],
  qrscan: ['qrResult', 'qrResultTxt', 'qrOpenBtn', 'qrVideo', 'qrFrame'],
  qr: ['qr22InputLabel']
};
var TEMPLATE_IDS = ['calc-form', 'calc-btn', 'res-box', 'res-value', 'res-label', 'res-details', 'res-error', 'share-result', 'share-status'];

// Collect the extra output containers a calc body / its companions write
// into (e.g. #res-wtr, #graphCanvas, #fdRes). Field ids are inputs, not
// containers; handled/template ids are rendered elsewhere.
function collectOutputIds(codeList, fieldIds, handled) {
  var ids = [];
  function scan(code) {
    var re = /getElementById\(\s*['"]([^'"]+)['"]\s*\)/g, m;
    while ((m = re.exec(code))) { if (ids.indexOf(m[1]) === -1) ids.push(m[1]); }
    var re2 = /v30ShowResult\(\s*['"]([^'"]+)['"]/g;
    while ((m = re2.exec(code))) { if (ids.indexOf(m[1]) === -1) ids.push(m[1]); }
  }
  codeList.forEach(scan);
  return ids.filter(function (id) {
    return fieldIds.indexOf(id) === -1 && handled.indexOf(id) === -1 && TEMPLATE_IDS.indexOf(id) === -1;
  });
}

function outputContainerHtml(id) {
  if (/Canvas$/.test(id)) {
    return '<canvas id="' + esc(id) + '" class="tool-canvas" width="600" height="260"></canvas>';
  }
  if (id === 'qrVideo') {
    return '<video id="qrVideo" class="tool-video" playsinline muted style="display:none"></video>';
  }
  if (id === 'qr22Img') {
    return '<img id="qr22Img" class="tool-qr-img" alt="Generated QR code">';
  }
  return '<div id="' + esc(id) + '" class="tool-output"></div>';
}

// --- per-tool extra markup (calc card) -------------------------------

var SCI_KEYS = [
  ['sin', 'sin', '', ''], ['cos', 'cos', '', ''], ['tan', 'tan', '', ''], ['log', 'log', '', ''],
  ['ln', 'ln', '', ''], ['\u221a', 'sqrt', '', ''], ['x\u00b2', 'sq', '', ''], ['x\u02b8', 'pow', '', 'key-op'],
  ['\u03c0', 'pi', '', ''], ['e', 'eul', '', ''], ['n!', 'fact', '', ''], ['1/x', 'inv', '', ''],
  ['|x|', 'abs', '', ''], ['(', 'ob', '', ''], [')', 'cb2', '', ''], ['\u232b', 'back', '', 'key-op'],
  ['MS', 'ms', '', ''], ['MR', 'mr', '', ''], ['MC', 'mc', '', ''], ['M+', 'mplus', '', ''],
  ['M\u2212', 'mminus', '', ''], ['\u00b1', 'sign', '', ''], ['%', 'pct', '', ''], ['\u00f7', 'div', '', 'key-op'],
  ['7', 'num', '7', ''], ['8', 'num', '8', ''], ['9', 'num', '9', ''], ['\u00d7', 'mul', '', 'key-op'],
  ['4', 'num', '4', ''], ['5', 'num', '5', ''], ['6', 'num', '6', ''], ['\u2212', 'sub', '', 'key-op'],
  ['1', 'num', '1', ''], ['2', 'num', '2', ''], ['3', 'num', '3', ''], ['+', 'add', '', 'key-op'],
  ['0', 'num', '0', ''], ['.', 'dot', '', ''], ['C', 'ac', '', 'key-op'], ['=', 'eq', '', 'key-eq']
];

function sciDisplayHtml() {
  return '<div class="sci-display-wrap" aria-live="polite">' +
    '<div class="sci-expr" id="dExpr"></div>' +
    '<div class="dnum" id="dNum">0</div>' +
    '<div class="sci-steps" id="dSteps" style="display:none"></div>' +
    '<div class="sci-mem"><span class="mem-badge" id="memBadge">M</span> Memory: <span id="memDisp">0</span><span id="memBV" hidden>0</span></div>' +
    '</div>' +
    '<div class="share-row"><button type="button" class="btn btn-secondary btn-small" id="stepsBtn">Show steps</button></div>';
}

function sciKeypadHtml() {
  return '<div class="sci-keypad" id="sci-keypad">' + SCI_KEYS.map(function (k) {
    return '<button type="button" class="sci-key' + (k[3] ? ' ' + k[3] : '') + '" data-a="' + k[1] + '"' + (k[2] ? ' data-v="' + k[2] + '"' : '') + '>' + k[0] + '</button>';
  }).join('') + '</div>';
}

function speedTabBarHtml() {
  return '<div id="speedTabBar" class="filter-bar" role="group" aria-label="Speed mode">' +
    '<button type="button" class="filter-btn ctab on" data-speed-mode="sdt">Speed / Distance / Time</button>' +
    '<button type="button" class="filter-btn ctab" data-speed-mode="pace">Pace</button>' +
    '</div>';
}

function speedFieldsHtml(fields) {
  var sdt = [], pace = [];
  fields.forEach(function (f) {
    if (['spSpeed', 'spDist', 'spTime', 'spUnit'].indexOf(f.id) !== -1) sdt.push(f);
    else pace.push(f);
  });
  var out = [];
  out.push('<div id="speedSDT">' + sdt.map(function (f) { return fieldHtml(f); }).join('\n') + '</div>');
  var paceHtml = pace.map(function (f) {
    var h = fieldHtml(f);
    if (f.id === 'paceCustomKm') return '<div id="paceCustomWrap" style="display:none">' + h + '</div>';
    return h;
  }).join('\n');
  out.push('<div id="speedPACE" style="display:none">' + paceHtml + '</div>');
  return out.join('\n');
}

function matrixOpButtonsHtml() {
  var ops = [['add', 'Add (A + B)'], ['sub', 'Subtract (A \u2212 B)'], ['mul', 'Multiply (A \u00d7 B)'], ['det', 'Determinant']];
  return '<div class="filter-bar" role="group" aria-label="Matrix operation">' +
    ops.map(function (o, i) {
      return '<button type="button" class="filter-btn mat-op' + (i === 0 ? ' active' : '') + '" data-mat-op="' + o[0] + '">' + o[1] + '</button>';
    }).join('') + '</div>';
}

function graphPresetHtml() {
  var fns = [['x*x', 'x\u00b2'], ['sin(x)', 'sin(x)'], ['cos(x)', 'cos(x)'], ['x*x*x', 'x\u00b3']];
  return '<div class="filter-bar" role="group" aria-label="Plot a preset function">' +
    fns.map(function (f) {
      return '<button type="button" class="filter-btn" data-graph-fn="' + esc(f[0]) + '">' + esc(f[1]) + '</button>';
    }).join('') + '</div>';
}

var WC_CITIES = [
  ['New York', 'America/New_York'], ['London', 'Europe/London'],
  ['Dubai', 'Asia/Dubai'], ['Kolkata', 'Asia/Kolkata'],
  ['Dhaka', 'Asia/Dhaka'], ['Singapore', 'Asia/Singapore'],
  ['Tokyo', 'Asia/Tokyo'], ['Sydney', 'Australia/Sydney'],
  ['Los Angeles', 'America/Los_Angeles'], ['Paris', 'Europe/Paris']
];

function worldClockRowsHtml(tool) {
  var cityField = (tool.fields || []).filter(function (f) { return f.id === 'wcCity'; })[0] || {};
  var opts = cityField.opts || cityField.options || [];
  var cities = opts.map(function (o) {
    var name = typeof o === 'string' ? o : o.value;
    var tz = 'UTC';
    WC_CITIES.forEach(function (c) { if (c[0] === name) tz = c[1]; });
    return [name, tz];
  });
  if (!cities.length) cities = WC_CITIES;
  return '<div class="wc-list">' + cities.map(function (c) {
    return '<div class="wc-row" data-city="' + esc(c[0]) + '"><span class="wc-city">' + esc(c[0]) + '</span><span class="wc-time" data-tz="' + esc(c[1]) + '">--:--</span></div>';
  }).join('') + '</div>';
}

function qrActionsHtml() {
  return '<div class="share-row">' +
    '<button type="button" class="btn btn-secondary btn-small" onclick="qr22Download(\'png\')">Download PNG</button>' +
    '<button type="button" class="btn btn-secondary btn-small" onclick="qr22CopyURL()">Copy URL</button>' +
    '<button type="button" class="btn btn-secondary btn-small" onclick="qr22Share()">Share</button>' +
    '</div>';
}

function qrscanMediaHtml() {
  return '<video id="qrVideo" class="tool-video" playsinline muted style="display:none"></video>' +
    '<div id="qrFrame" class="tool-output qr-frame"><p class="search-hint">Camera view will appear here. Or choose an image file above.</p></div>';
}

function qrscanResultHtml() {
  return '<div id="qrResult" class="tool-output" style="display:none">' +
    '<p id="qrResultTxt"></p>' +
    '<div class="share-row">' +
    '<button type="button" class="btn btn-secondary btn-small" onclick="copyQRResult()">Copy result</button>' +
    '<button type="button" class="btn btn-secondary btn-small" id="qrOpenBtn" onclick="openQRLink()" style="display:none">Open link</button>' +
    '</div></div>';
}

// --- per-tool wiring (runs once, guarded, inside the page script) -----

function toolWiringLines(tool) {
  var id = tool.id || '';
  var L = [];
  if (id === 'pomo') {
    L.push('var pm=document.getElementById("pomMode");');
    L.push('if(pm){ pm.addEventListener("change",function(){ var n=parseInt((pm.value.match(/\\d+/)||[])[0],10); if(!isNaN(n)&&n>0){ clearInterval(pomInterval); pomRunning=false; pomTotal=n*60; pomLeft=n*60; updatePomDisplay(); var st=document.getElementById("pomStatus"); if(st)st.textContent="Ready"; } }); }');
    L.push('try{ initPom(); }catch(e){}');
  }
  if (id === 'sleep') {
    L.push('var sm=document.getElementById("sleepMode");');
    L.push('if(sm){ var applySleepMode=function(){ _sleepMode=sm.value.indexOf("wake")!==-1?"wake":"sleep"; }; sm.addEventListener("change",applySleepMode); applySleepMode(); }');
  }
  if (id === 'conv') {
    L.push('var tt=document.getElementById("tpTab");');
    L.push('if(tt){ var TP_MAP={Currency:"fx",Length:"len",Weight:"wt",Temperature:"tmp"}; var applyTpTab=function(){ var key=TP_MAP[tt.value]||"fx"; tpM=key; var c=cvCfg[key]; ["tp2","tp3"].forEach(function(fid){ var sel=document.getElementById(fid); if(!sel)return; var cur=sel.value; sel.innerHTML=c.u.map(function(u){ return "<option>"+u+"</option>"; }).join(""); if(c.u.indexOf(cur)!==-1)sel.value=cur; }); var t3=document.getElementById("tp3"); if(t3)t3.value=c.u[1]; doTP(); }; tt.addEventListener("change",applyTpTab); }');
    L.push('try{ doTP(); }catch(e){}');
  }
  if (id === 'qr') {
    L.push('var qt=document.getElementById("qr22Template");');
    L.push('if(qt){ var QR_MAP={Website:"url","UPI Pay":"upi",WiFi:"wifi",Contact:"phone",Email:"email",Text:"text",Location:"location","App Download":"apk"}; qt.addEventListener("change",function(){ qr22SetTemplate(QR_MAP[qt.value]||"url"); }); }');
    L.push('var qi=document.getElementById("qr22Input"); if(qi){ qi.addEventListener("input",qr22Debounce); }');
    L.push('var ql=document.getElementById("qr22LogoFile"); if(ql){ ql.addEventListener("change",function(){ qr22LogoSelected(ql); }); }');
  }
  if (id === 'qrscan') {
    L.push('var qf=document.getElementById("qrFileInp"); if(qf){ qf.addEventListener("change",function(){ scanQRFile(qf); }); }');
  }
  if (id === 'graph') {
    L.push('document.querySelectorAll("[data-graph-fn]").forEach(function(b){ b.addEventListener("click",function(){ setGraphFn(b.getAttribute("data-graph-fn")); }); });');
    L.push('try{ drawGraph(); }catch(e){}');
  }
  if (id === 'matrix') {
    L.push('document.querySelectorAll("[data-mat-op]").forEach(function(b){ b.addEventListener("click",function(){ window.__matOp=b.getAttribute("data-mat-op"); document.querySelectorAll("[data-mat-op]").forEach(function(x){ x.classList.toggle("active",x===b); }); try{ runToolCalc(); }catch(e){} }); });');
  }
  if (id === 'speed') {
    L.push('document.querySelectorAll("[data-speed-mode]").forEach(function(b){ b.addEventListener("click",function(){ speedMode(b.getAttribute("data-speed-mode"),b); }); });');
  }
  if (id === 'worldclock') {
    L.push('var wc=document.getElementById("wcCity"); if(wc){ wc.addEventListener("change",function(){ document.querySelectorAll(".wc-row").forEach(function(r){ r.classList.toggle("wc-active",r.getAttribute("data-city")===wc.value); }); var a=document.querySelector(".wc-row.wc-active"); if(a)a.scrollIntoView({block:"nearest"}); }); }');
  }
  if (id === 'sci') {
    L.push('document.querySelectorAll(".sci-key").forEach(function(b){ b.addEventListener("click",function(){ try{ act(b.getAttribute("data-a"),b.getAttribute("data-v")||""); }catch(e){} }); });');
    L.push('var sb=document.getElementById("stepsBtn"); if(sb){ sb.addEventListener("click",function(){ try{ toggleSteps(); }catch(e){} }); }');
  }
  return L.join('\n');
}

function calcInlineScript(tool) {
  var id = tool.id || '';
  var calcBody = tool.calc || tool.calcFunction || '';
  var companion = (companions[id] && companions[id].code) || '';
  var isV30 = /v30ShowResult|v30Fmt/.test(calcBody);
  var wrapper = NAMED_WRAPPERS[id] || null;
  var isScientific = tool.extra === 'scientific' || tool.slug === 'scientific-calculator';

  var parts = [];
  parts.push('<script>');
  parts.push(NOOP_STUBS);
  if (isV30 && v30Snippet) {
    parts.push('/* V30 compatibility (source L24628-24642): V30 calc bodies call');
    parts.push('   v30ShowResult()/v30Fmt() instead of setRes()/getId(). */');
    parts.push(v30Snippet);
  }
  if (companion) {
    parts.push('/* Companion functions/state, verbatim from the v30 source');
    parts.push('   (' + (companions[id].sourceLines || '') + '). See companions.json. */');
    parts.push(companion);
  }
  if (wrapper) {
    parts.push('function ' + wrapper.name + '(' + wrapper.params + '){');
    parts.push(calcBody);
    parts.push('}');
  }
  // runToolCalc: what the Calculate button runs.
  if (isScientific) {
    // The keypad drives act() directly; Calculate evaluates the typed
    // expression in the sciExpr field instead.
    parts.push('function runToolCalc(){');
    parts.push('  var expr=(document.getElementById("sciExpr")&&document.getElementById("sciExpr").value||"").trim();');
    parts.push('  if(!expr){ showValError("sci","Type an expression above, or use the keypad."); return; }');
    parts.push('  var r=safe(expr);');
    parts.push('  if(r===null){ showValError("sci","Could not evaluate that expression."); return; }');
    parts.push('  setD(fmt(r,true),expr+" =");');
    parts.push('  setRes("sci",fmt(r,true),"Result",expr+" = "+fmt(r));');
    parts.push('}');
  } else if (wrapper) {
    if (id === 'matrix') {
      parts.push('function runToolCalc(){ matOp(window.__matOp || "add"); }');
    } else {
      parts.push('function runToolCalc(){ ' + wrapper.name + '(); }');
    }
  } else if (calcBody) {
    parts.push('function runToolCalc(){');
    parts.push(calcBody);
    parts.push('}');
  } else {
    parts.push('function runToolCalc(){');
    parts.push('  var e=document.getElementById("res-error");');
    parts.push('  if(e){ e.textContent="The calculator for this tool is not available yet."; e.hidden=false; }');
    parts.push('}');
  }
  parts.push('(function(){');
  parts.push('try{');
  parts.push('var form=document.getElementById("calc-form");');
  parts.push('if(form){ form.addEventListener("submit",function(ev){ ev.preventDefault(); try{ runToolCalc(); }catch(err){ var e=document.getElementById("res-error"); if(e){ e.textContent="Could not calculate. Please check your numbers and try again."; e.hidden=false; } } }); }');
  parts.push(toolWiringLines(tool));
  parts.push('}catch(e){}');
  parts.push('})();');
  var body = parts.join('\n');
  if (body.indexOf('</scr' + 'ipt>') !== -1) {
    warnings.push('tool "' + tool.slug + '": calc/companion code contains a literal </script> — page script may break');
  }
  parts.push('</scr' + 'ipt>');
  var html = parts.join('\n');
  return html;
}

function buildToolPage(tool) {
  var c = toolContentBySlug[tool.slug] || toolContentBySlug[tool.slug + '-calculator'] ||
    (SLUG_ALIASES[tool.slug] ? toolContentBySlug[SLUG_ALIASES[tool.slug]] : null) || null;
  if (!c) {
    warnings.push('skip tool page "' + tool.slug + '": no content/tools/' + tool.slug + '.json (or ' + tool.slug + '-calculator.json)');
    return;
  }
  var prefix = '../../';
  var canonical = BASE_URL + '/calculators/' + tool.slug + '/';
  var catSlug = tool.category || 'utility';
  var usedFor = c.usedFor || c.uses || '';

  var content = [];
  content.push('<p class="lead">' + esc(c.intro || tool.description || '') + '</p>');

  if (usedFor) {
    content.push('<section class="content-block"><h2>What it is used for</h2><p>' + esc(usedFor) + '</p></section>');
  }

  // Calculator card. The standard #res-box result section is kept only
  // where setRes()/showValError() are actually used (standard tools,
  // stats, sci submit evaluation). Custom-render tools (companions) and
  // V30 tools write their own containers instead.
  var calcBody = tool.calc || tool.calcFunction || '';
  var companionCode = (companions[tool.id] && companions[tool.id].code) || '';
  var isV30 = /v30ShowResult|v30Fmt/.test(calcBody);
  var isScientific = tool.extra === 'scientific' || tool.slug === 'scientific-calculator';
  var useStandardBox = isScientific || (!companionCode && !isV30);
  var fieldIds = (tool.fields || []).map(function (f) { return f.id; });
  var handled = (HANDLED_IDS[tool.id] || []).slice();
  var outputIds = collectOutputIds([calcBody, companionCode, isV30 ? v30Snippet : ''], fieldIds, handled);

  var calc = [];
  calc.push('<section class="calc-card" aria-label="' + esc(tool.title) + ' calculator">');
  if (isScientific) {
    calc.push(sciDisplayHtml());
    calc.push(sciKeypadHtml());
    calc.push('<form id="calc-form" class="calc-form">');
    (tool.fields || []).forEach(function (f) { calc.push(fieldHtml(f)); });
    calc.push('<button type="submit" id="calc-btn" class="btn btn-primary btn-block">Calculate</button>');
    calc.push('</form>');
  } else {
    if (tool.id === 'speed') calc.push(speedTabBarHtml());
    if (tool.id === 'matrix') calc.push(matrixOpButtonsHtml());
    calc.push('<form id="calc-form" class="calc-form">');
    if (tool.id === 'speed') {
      calc.push(speedFieldsHtml(tool.fields || []));
    } else {
      (tool.fields || []).forEach(function (f) {
        calc.push(fieldHtml(f, f.id === 'qr22Input' ? 'qr22InputLabel' : undefined));
      });
    }
    calc.push('<button type="submit" id="calc-btn" class="btn btn-primary btn-block">Calculate</button>');
    calc.push('</form>');
    if (tool.id === 'graph') calc.push(graphPresetHtml());
    if (tool.id === 'worldclock') calc.push(worldClockRowsHtml(tool));
    if (tool.id === 'qrscan') calc.push(qrscanMediaHtml());
  }
  if (outputIds.length) {
    calc.push('<div class="tool-outputs">' + outputIds.map(outputContainerHtml).join('\n') + '</div>');
  }
  if (tool.id === 'qrscan') calc.push(qrscanResultHtml());
  if (tool.id === 'qr') calc.push(qrActionsHtml());
  if (tool.id === 'pwd') calc.push('<div class="share-row"><button type="button" class="btn btn-secondary btn-small" onclick="copyPwd()">Copy password</button></div>');
  if (tool.id === 'qrscan') calc.push('<div class="share-row"><button type="button" class="btn btn-secondary btn-small" onclick="stopQRScan()">Stop camera</button></div>');
  if (useStandardBox) {
    calc.push('<div class="result-box" id="res-box">');
    calc.push('<p class="result-label" id="res-label">' + esc(tool.resultLabel || 'Result') + '</p>');
    calc.push('<p class="result-value" id="res-value">&mdash;</p>');
    calc.push('<p class="result-details" id="res-details"></p>');
    calc.push('<p class="result-error" id="res-error" hidden></p>');
    calc.push('<div class="share-row"><button type="button" class="btn btn-secondary btn-small" id="share-result">Share result</button><span class="share-status" id="share-status" role="status"></span></div>');
    calc.push('</div>');
  } else {
    // Custom-render / V30 pages have no standard box, but the submit
    // catch in the page script still reports into #res-error, so the
    // element must exist for a failed calculation to say so.
    calc.push('<p class="result-error" id="res-error" hidden></p>');
  }
  calc.push('</section>');
  content.push(calc.join('\n'));

  if (c.explanation) {
    content.push('<section class="content-block"><h2>How the result is worked out</h2><p>' + esc(c.explanation) + '</p></section>');
  }
  if (c.formula) {
    var f = '<section class="content-block"><h2>Formula</h2><p class="formula-box">' + esc(c.formula) + '</p>';
    if (c.formulaNote) f += '<p>' + esc(c.formulaNote) + '</p>';
    f += '</section>';
    content.push(f);
  }
  // Registry note (only gst has one): trusted HTML from tools.json, raw.
  if (tool.note) {
    content.push('<section class="content-block"><h2>Notes &amp; sources</h2><p>' + tool.note + '</p></section>');
  }
  if (c.example) {
    content.push('<section class="content-block"><h2>Worked example</h2><p>' + esc(c.example) + '</p></section>');
  }
  if (Array.isArray(c.howTo) && c.howTo.length) {
    content.push('<section class="content-block"><h2>How to use</h2><ol class="steps">' +
      c.howTo.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol></section>');
  }
  if (Array.isArray(c.tips) && c.tips.length) {
    content.push('<section class="content-block"><h2>Tips</h2><ul>' +
      c.tips.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul></section>');
  }
  if (Array.isArray(c.mistakes) && c.mistakes.length) {
    content.push('<section class="content-block"><h2>Common mistakes</h2><ul>' +
      c.mistakes.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul></section>');
  }
  if (Array.isArray(c.faqs) && c.faqs.length) {
    content.push('<section class="content-block faq-list"><h2>Frequently asked questions</h2>' +
      c.faqs.map(function (f) {
        return '<details><summary>' + esc(f.q) + '</summary><p>' + esc(f.a) + '</p></details>';
      }).join('') + '</section>');
  }

  // Related calculators: content list first, then same-category fill, max 3.
  var related = [];
  (Array.isArray(c.related) ? c.related : []).forEach(function (slug) {
    var t = resolveToolSlug(slug);
    if (t && t.slug !== tool.slug && related.indexOf(t.slug) === -1) related.push(t.slug);
  });
  tools.forEach(function (t) {
    if (related.length >= 3) return;
    if (t.slug !== tool.slug && t.category === catSlug && related.indexOf(t.slug) === -1) related.push(t.slug);
  });
  // Invariant: still <3 after same-category fill (e.g. 3-tool categories
  // whose content lists were short) -> fill from other categories in
  // registry order, deduped, never self, never repeated.
  tools.forEach(function (t) {
    if (related.length >= 3) return;
    if (t.slug !== tool.slug && related.indexOf(t.slug) === -1) related.push(t.slug);
  });
  if (related.length) {
    content.push('<section class="content-block"><h2>Related calculators</h2><ul class="related-list">' +
      related.slice(0, 3).map(function (slug) {
        return '<li><a href="' + prefix + 'calculators/' + encodeURIComponent(slug) + '/">' + esc(toolBySlug[slug].title) + '</a></li>';
      }).join('') + '</ul></section>');
  }

  content.push('<div class="disclaimer-box"><p>Results are a guide based on the numbers you enter. ' +
    'For loan, tax or investment decisions, check the figures with the bank, the official tax portal, or a qualified adviser.</p>' +
    (c.lastReviewed ? '<p>Last reviewed: ' + esc(c.lastReviewed) + '.</p>' : '') + '</div>');

  var crumbs = [
    { name: 'Home', url: '/' },
    { name: categoryName(catSlug), url: '/categories/' + catSlug + '/' },
    { name: tool.title, url: '/calculators/' + tool.slug + '/' }
  ];
  var schemas = [webAppJsonLd(tool, canonical), breadcrumbJsonLd(crumbs)];
  if (Array.isArray(c.faqs) && c.faqs.length) {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: c.faqs.map(function (f) {
        return {
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a }
        };
      })
    });
  }

  renderPage({
    outDir: 'calculators/' + tool.slug,
    title: tool.title + ' | SuvoCalc v' + siteVersion,
    description: (tool.description || tool.title + ' — free online calculator on SuvoCalc.').slice(0, 160),
    canonical: canonical,
    h1: tool.title,
    breadcrumb: breadcrumbHtml(crumbs),
    content: content.join('\n'),
    activeNav: 'tools',
    jsonLd: schemas,
    extraScripts: calcInlineScript(tool),
    toolSlug: tool.slug,
    toolTitle: tool.title
  });
}

/* ------------------------------------------------------------------ */
/* homepage                                                            */
/* ------------------------------------------------------------------ */

function buildHomepage() {
  var used = new Set();
  var markUsed = function (list) { list.forEach(function (t) { used.add(t.slug); }); };
  var prefix = '';

  var sections = [];

  // Hero sub-line + search + intro (the H1 comes from the template).
  sections.push('<section class="hero">');
  sections.push('<p class="hero-sub">' + esc(home.heroSubtitle || '') + '</p>');
  sections.push('<div class="search-box"><div class="search-input-wrap">' +
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
    '<input type="search" class="search-input" id="home-search" placeholder="Search ' + toolCount + ' calculators&hellip;" aria-label="Search calculators" autocomplete="off">' +
    '</div><p class="search-hint">Try &ldquo;EMI&rdquo;, &ldquo;GST&rdquo;, &ldquo;BMI&rdquo; or &ldquo;SIP&rdquo;.</p></div>');
  sections.push('<div class="search-results" id="home-search-results" hidden></div>');
  sections.push('</section>');
  if (home.intro) sections.push('<p class="lead narrow">' + esc(home.intro) + '</p>');

  function sectionHtml(id, title, sub, inner, link) {
    var head = '<div class="section-head"><h2 class="section-title">' + esc(title) + '</h2>' +
      (link ? '<a href="' + esc(link.href) + '">' + esc(link.text) + '</a>' : '') + '</div>';
    return '<section class="section" id="' + id + '">' + head +
      (sub ? '<p class="section-sub">' + esc(sub) + '</p>' : '') + inner + '</section>';
  }
  function cardsHtml(list) {
    return '<div class="card-grid">' + list.map(function (t) { return toolCardHtml(t, prefix); }).join('') + '</div>';
  }

  // Featured tool: the registry's featured flag, falling back to GST.
  // Reserve its slug FIRST so it cannot also appear in Popular (a tool
  // appears in at most one homepage section).
  var featured = tools.filter(function (t) { return t.featured; })[0] || resolveToolSlug('gst');
  if (featured) markUsed([featured]);

  // Popular calculators (8, from the popular flag; fill from registry order).
  var popular = tools.filter(function (t) { return t.popular && !used.has(t.slug); });
  tools.forEach(function (t) {
    if (popular.length >= 8) return;
    if (popular.indexOf(t) === -1 && !used.has(t.slug)) popular.push(t);
  });
  popular = popular.slice(0, 8);
  markUsed(popular);
  sections.push(sectionHtml('popular', 'Popular Calculators', '',
    cardsHtml(popular), { href: 'tools/index.html', text: 'View all tools' }));

  // Categories (7 cards with real counts from tools.json).
  var catCards = categories.map(function (cat) {
    var n = countInCategory(cat.slug);
    // Registry categories carry no descriptions; fall back to a plain
    // count-based line rather than an empty paragraph.
    var desc = cat.description || ('Browse ' + n + ' free ' + cat.name + ' calculators.');
    return '<article class="card category-card">' +
      '<h3><a href="categories/' + encodeURIComponent(cat.slug) + '/">' + esc(cat.name) + '</a></h3>' +
      '<p>' + esc(desc) + '</p>' +
      '<span class="count">' + n + (n === 1 ? ' calculator' : ' calculators') + '</span>' +
      '<a class="btn btn-secondary btn-small" href="categories/' + encodeURIComponent(cat.slug) + '/">Browse ' + esc(cat.name) + '</a>' +
      '</article>';
  }).join('');
  sections.push(sectionHtml('categories', 'Browse by Category', '',
    '<div class="card-grid">' + catCards + '</div>', null));

  // Recently Used — rendered by main.js from localStorage; hidden when empty.
  sections.push('<section class="section" id="recently-used" hidden>' +
    '<div class="section-head"><h2 class="section-title">Recently Used</h2></div>' +
    '<div class="card-grid" id="recently-used-grid"></div></section>');

  // Featured tool section (slug already reserved above).
  if (featured) {
    sections.push(sectionHtml('featured', 'Featured Tool', 'Updated for GST 2.0',
      '<div class="callout"><p><strong>' + esc(featured.title) + '</strong> &mdash; ' +
      esc(featured.description || '') + '</p>' +
      '<p><a class="btn btn-primary" href="calculators/' + encodeURIComponent(featured.slug) + '/">Open ' + esc(featured.title) + '</a></p></div>', null));
  }

  // Grouped picks — each tool appears in at most one homepage section.
  // Groups are data-driven by category slug, so a registry rename still
  // works: finance = slugs starting finance/tax, health = contains health,
  // student = contains education/student, utility = contains utilit.
  function groupSlugs(pred) {
    return categories.filter(function (c) { return pred(c.slug); }).map(function (c) { return c.slug; });
  }
  function pick(pred, max) {
    var list = tools.filter(function (t) { return !used.has(t.slug) && pred(t); }).slice(0, max);
    markUsed(list);
    return list;
  }
  function groupSection(id, title, catSlugs, max, linkText) {
    var list = pick(function (t) { return catSlugs.indexOf(t.category) !== -1; }, max);
    if (!list.length || !catSlugs.length) return;
    sections.push(sectionHtml(id, title, '',
      cardsHtml(list), { href: 'categories/' + catSlugs[0] + '/', text: linkText }));
  }
  groupSection('finance', 'Useful Financial Calculators',
    groupSlugs(function (s) { return s.indexOf('finance') === 0 || s.indexOf('tax') === 0; }), 6, 'All finance tools');
  groupSection('health', 'Health &amp; Fitness',
    groupSlugs(function (s) { return s.indexOf('health') !== -1; }), 4, 'All health tools');
  groupSection('student', 'Student &amp; Education',
    groupSlugs(function (s) { return s.indexOf('education') !== -1 || s.indexOf('student') !== -1; }), 4, 'All student tools');
  groupSection('utility', 'Daily Utility Tools',
    groupSlugs(function (s) { return s.indexOf('utilit') !== -1; }), 4, 'All utility tools');

  // Scientific calculator entry point (not a counted tool).
  sections.push('<section class="section"><div class="callout"><p><strong>Need a calculator right now?</strong> ' +
    'Open the scientific calculator for quick everyday maths.</p>' +
    '<p><a class="btn btn-primary" href="calculators/scientific-calculator/">Open Calculator</a></p></div></section>');

  // Why SuvoCalc (3 honest bullets).
  if (Array.isArray(home.why) && home.why.length) {
    sections.push('<section class="section"><div class="section-head"><h2 class="section-title">Why SuvoCalc</h2></div>' +
      '<ul class="why-list">' + home.why.slice(0, 3).map(function (w) {
        return '<li><h3>' + esc(w.title) + '</h3><p>' + esc(w.text) + '</p></li>';
      }).join('') + '</ul></section>');
  }

  // How to use (3 steps).
  if (Array.isArray(home.howTo) && home.howTo.length) {
    sections.push('<section class="section"><div class="section-head"><h2 class="section-title">How to Use</h2></div>' +
      '<ol class="steps-grid">' + home.howTo.slice(0, 3).map(function (s, i) {
        return '<li><span class="step-num">' + (i + 1) + '</span><h3>' + esc(s.title) + '</h3><p>' + esc(s.text) + '</p></li>';
      }).join('') + '</ol></section>');
  }

  // FAQ (5–6 real questions, FAQPage schema).
  var faqs = Array.isArray(home.faq) ? home.faq : [];
  if (faqs.length) {
    sections.push('<section class="section faq-list"><div class="section-head"><h2 class="section-title">Frequently Asked Questions</h2></div>' +
      faqs.map(function (f) {
        return '<details><summary>' + esc(f.q) + '</summary><p>' + esc(f.a) + '</p></details>';
      }).join('') + '</section>');
  }

  sections.push('<p><a class="btn btn-primary" href="tools/index.html">Explore All Tools</a></p>');

  var schemas = [{
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: siteName,
    url: BASE_URL + '/',
    applicationCategory: 'CalculatorApplication',
    operatingSystem: 'Any',
    softwareVersion: siteVersion + '.0',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    description: home.intro || (toolCount + ' free online calculators.')
  }];
  if (faqs.length) {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map(function (f) {
        return {
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a }
        };
      })
    });
  }

  var toolIndex = '<script type="application/json" id="tool-index">' +
    JSON.stringify(toolIndexJson(tools)).replace(/</g, '\\u003c') + '</script>';

  renderPage({
    outDir: '',
    title: siteName + ' — ' + toolCount + ' Free Online Calculators | SuvoCalc v' + siteVersion,
    description: (home.intro || '').slice(0, 160),
    canonical: BASE_URL + '/',
    h1: home.heroTitle || (toolCount + ' free calculators'),
    breadcrumb: '',
    content: sections.join('\n'),
    activeNav: 'home',
    jsonLd: schemas,
    extraScripts: toolIndex,
    bodyClass: 'page-home'
  });
}

/* ------------------------------------------------------------------ */
/* tools index + category pages                                        */
/* ------------------------------------------------------------------ */

function buildToolsIndex() {
  var prefix = '../';
  var filters = ['<button type="button" class="filter-btn active" data-filter-category="all" aria-pressed="true">All (' + toolCount + ')</button>']
    .concat(categories.map(function (cat) {
      return '<button type="button" class="filter-btn" data-filter-category="' + esc(cat.slug) + '">' +
        esc(cat.name) + ' (' + countInCategory(cat.slug) + ')</button>';
    })).join('');

  var content = [];
  content.push('<p class="lead">All ' + toolCount + ' free calculators in one place. Search by name or filter by category — every card opens a full calculator with its formula and a worked example.</p>');
  content.push('<div class="search-box"><div class="search-input-wrap">' +
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
    '<input type="search" class="search-input" id="tool-search" placeholder="Search calculators&hellip;" aria-label="Search calculators" autocomplete="off">' +
    '</div></div>');
  content.push('<div class="filter-bar" id="category-filters" role="group" aria-label="Filter by category">' + filters + '</div>');
  content.push('<p class="meta-line" id="tool-count">' + toolCount + ' calculators</p>');
  content.push('<div class="card-grid" id="tool-grid">' +
    tools.map(function (t) { return toolCardHtml(t, prefix); }).join('') + '</div>');
  content.push('<div class="empty-state" id="tool-empty" hidden>No calculator matches your search. Try a different word or category.</div>');

  renderPage({
    outDir: 'tools',
    title: 'All Tools — ' + toolCount + ' Free Calculators | SuvoCalc v' + siteVersion,
    description: 'Browse all ' + toolCount + ' free SuvoCalc calculators: finance, tax, investment, health, education and daily utilities. No login needed.',
    canonical: BASE_URL + '/tools/',
    h1: 'All Tools',
    breadcrumb: breadcrumbHtml([
      { name: 'Home', url: '/' },
      { name: 'All Tools', url: '/tools/' }
    ]),
    content: content.join('\n'),
    activeNav: 'tools',
    jsonLd: [
      { '@context': 'https://schema.org', '@type': 'WebPage', name: 'All Tools | SuvoCalc', url: BASE_URL + '/tools/' },
      breadcrumbJsonLd([
        { name: 'Home', url: '/' },
        { name: 'All Tools', url: '/tools/' }
      ])
    ]
  });
}

function buildCategoryPages() {
  categories.forEach(function (cat) {
    var list = tools.filter(function (t) { return t.category === cat.slug; });
    var prefix = '../../';
    var content = [];
    content.push('<p class="lead">' + esc(cat.description || (categoryName(cat.slug) + ' calculators on SuvoCalc.')) + '</p>');
    content.push('<p class="meta-line">' + list.length + (list.length === 1 ? ' calculator' : ' calculators') + '</p>');
    if (list.length) {
      content.push('<div class="card-grid">' + list.map(function (t) { return toolCardHtml(t, prefix); }).join('') + '</div>');
    } else {
      content.push('<div class="empty-state">No calculators in this category yet.</div>');
    }
    renderPage({
      outDir: 'categories/' + cat.slug,
      title: cat.name + ' Calculators | SuvoCalc v' + siteVersion,
      description: ('Free ' + cat.name.toLowerCase() + ' calculators on SuvoCalc: ' +
        list.slice(0, 4).map(function (t) { return t.title; }).join(', ') + '.').slice(0, 160),
      canonical: BASE_URL + '/categories/' + cat.slug + '/',
      h1: cat.name + ' Calculators',
      breadcrumb: breadcrumbHtml([
        { name: 'Home', url: '/' },
        { name: 'All Tools', url: '/tools/' },
        { name: cat.name, url: '/categories/' + cat.slug + '/' }
      ]),
      content: content.join('\n'),
      activeNav: 'categories',
      jsonLd: [
        { '@context': 'https://schema.org', '@type': 'WebPage', name: cat.name + ' Calculators | SuvoCalc', url: BASE_URL + '/categories/' + cat.slug + '/' },
        breadcrumbJsonLd([
          { name: 'Home', url: '/' },
          { name: 'All Tools', url: '/tools/' },
          { name: cat.name, url: '/categories/' + cat.slug + '/' }
        ])
      ]
    });
  });
}

/* ------------------------------------------------------------------ */
/* blog                                                                */
/* ------------------------------------------------------------------ */

var STATIC_PAGES = [
  { slug: 'about', title: 'About SuvoCalc' },
  { slug: 'contact', title: 'Contact SuvoCalc' },
  { slug: 'privacy', title: 'Privacy Policy' },
  { slug: 'terms', title: 'Terms of Use' },
  { slug: 'disclaimer', title: 'Disclaimer' },
  { slug: 'faq', title: 'Frequently Asked Questions' }
];

function buildBlog() {
  var dir = path.join(ROOT, 'content', 'blog');
  var files = [];
  try {
    files = fs.readdirSync(dir).filter(function (f) { return /\.md$/i.test(f); }).sort();
  } catch (e) { files = []; }
  if (files.length === 0) {
    warnings.push('no blog articles found in content/blog/ — blog index will be empty');
  }
  var posts = [];
  files.forEach(function (file) {
    var slug = file.replace(/\.md$/i, '');
    var parsed = parseFrontMatter(readFile(path.join(dir, file)));
    var body = parsed.body;
    var title = parsed.meta.title || '';
    if (!title) {
      var m = body.match(/^#{1}\s+(.*)$/m);
      title = m ? m[1].trim() : slug;
    }
    var desc = parsed.meta.description || '';
    if (!desc) {
      var firstPara = body.replace(/^#{1}\s+.*$/m, '').split(/\n\s*\n/).map(function (s) { return s.trim(); }).filter(Boolean)[0] || '';
      desc = firstPara.replace(/<[^>]+>/g, '').replace(/[#*_`\[\]()]/g, '').slice(0, 160);
    }
    var date = parsed.meta.date || '';
    var readMin = parsed.meta.minutes || parsed.meta.readMinutes || '';
    var relatedRaw = parsed.meta.related;
    var related = Array.isArray(relatedRaw) ? relatedRaw :
      (typeof relatedRaw === 'string' && relatedRaw ? relatedRaw.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : []);
    posts.push({ slug: slug, title: title, description: desc, date: date, readMin: readMin, related: related, body: body });
  });

  // Article pages.
  posts.forEach(function (post) {
    var prefix = '../../';
    var canonical = BASE_URL + '/blog/' + post.slug + '/';
    var content = [];
    var metaBits = [];
    if (post.date) metaBits.push(esc(post.date));
    if (post.readMin) metaBits.push(esc(post.readMin) + ' min read');
    if (metaBits.length) content.push('<p class="meta-line">' + metaBits.join(' &middot; ') + '</p>');
    content.push('<div class="article-body">' + mdToHtml(stripFirstH1(post.body)) + '</div>');
    var relTools = post.related.map(function (s) { return resolveToolSlug(s); })
      .filter(function (t) { return !!t; })
      .map(function (t) { return t.slug; });
    if (relTools.length) {
      content.push('<section class="content-block"><h2>Try these calculators</h2><ul class="related-list">' +
        relTools.map(function (slug) {
          return '<li><a href="' + prefix + 'calculators/' + encodeURIComponent(slug) + '/">' + esc(toolBySlug[slug].title) + '</a></li>';
        }).join('') + '</ul></section>');
    }
    renderPage({
      outDir: 'blog/' + post.slug,
      title: post.title + ' | SuvoCalc Blog',
      description: post.description.slice(0, 160),
      canonical: canonical,
      h1: post.title,
      breadcrumb: breadcrumbHtml([
        { name: 'Home', url: '/' },
        { name: 'Blog', url: '/blog/' },
        { name: post.title, url: '/blog/' + post.slug + '/' }
      ]),
      content: content.join('\n'),
      activeNav: 'blog',
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: post.title,
          description: post.description,
          url: canonical,
          datePublished: post.date || undefined,
          author: { '@type': 'Organization', name: siteName }
        },
        breadcrumbJsonLd([
          { name: 'Home', url: '/' },
          { name: 'Blog', url: '/blog/' },
          { name: post.title, url: '/blog/' + post.slug + '/' }
        ])
      ]
    });
  });

  // Blog index.
  var list = posts.map(function (post) {
    var metaBits = [];
    if (post.date) metaBits.push(esc(post.date));
    if (post.readMin) metaBits.push(esc(post.readMin) + ' min read');
    return '<article class="post-card"><h2><a href="' + esc(post.slug) + '/">' + esc(post.title) + '</a></h2>' +
      (metaBits.length ? '<p class="post-meta">' + metaBits.join(' &middot; ') + '</p>' : '') +
      '<p>' + esc(post.description) + '</p>' +
      '<a class="btn btn-secondary btn-small" href="' + esc(post.slug) + '/">Read guide</a></article>';
  }).join('');
  renderPage({
    outDir: 'blog',
    title: 'Blog & Guides | SuvoCalc v' + siteVersion,
    description: 'SuvoCalc guides: how each calculator works, with formulas, examples and tips. ' + posts.length + ' guides.',
    canonical: BASE_URL + '/blog/',
    h1: 'Blog & Guides',
    breadcrumb: breadcrumbHtml([
      { name: 'Home', url: '/' },
      { name: 'Blog', url: '/blog/' }
    ]),
    content: '<p class="lead">Plain guides to the calculators on this site — what each one does, the formula behind it, and a worked example.</p>' +
      (list ? '<div class="post-list">' + list + '</div>' : '<div class="empty-state">No guides published yet.</div>'),
    activeNav: 'blog',
    jsonLd: [
      { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Blog & Guides | SuvoCalc', url: BASE_URL + '/blog/' },
      breadcrumbJsonLd([
        { name: 'Home', url: '/' },
        { name: 'Blog', url: '/blog/' }
      ])
    ]
  });
}

/* ------------------------------------------------------------------ */
/* static pages (about / contact / privacy / terms / disclaimer / faq)  */
/* ------------------------------------------------------------------ */

function buildStaticPages() {
  STATIC_PAGES.forEach(function (page) {
    var mdPath = path.join(ROOT, 'content', 'pages', page.slug + '.md');
    if (!fileExists(mdPath)) {
      warnings.push('skip page "' + page.slug + '": content/pages/' + page.slug + '.md is missing');
      return;
    }
    var md = readFile(mdPath);
    var parsed = parseFrontMatter(md);
    var body = parsed.body;
    var title = parsed.meta.title || page.title;
    var m = body.match(/^#{1}\s+(.*)$/m);
    if (!parsed.meta.title && m) title = m[1].trim();
    renderPage({
      outDir: page.slug,
      title: title + ' | SuvoCalc v' + siteVersion,
      description: (title + ' — SuvoCalc, ' + toolCount + ' free online calculators.').slice(0, 160),
      canonical: BASE_URL + '/' + page.slug + '/',
      h1: title,
      breadcrumb: breadcrumbHtml([
        { name: 'Home', url: '/' },
        { name: title, url: '/' + page.slug + '/' }
      ]),
      content: '<div class="article-body narrow">' + mdToHtml(stripFirstH1(body)) + '</div>',
      activeNav: (page.slug === 'about' || page.slug === 'contact') ? page.slug : '',
      jsonLd: [
        { '@context': 'https://schema.org', '@type': 'WebPage', name: title + ' | SuvoCalc', url: BASE_URL + '/' + page.slug + '/' },
        breadcrumbJsonLd([
          { name: 'Home', url: '/' },
          { name: title, url: '/' + page.slug + '/' }
        ])
      ]
    });
  });
}

/* ------------------------------------------------------------------ */
/* sitemap + robots                                                    */
/* ------------------------------------------------------------------ */

function buildSitemapRobots() {
  var seen = {};
  var urls = sitemapUrls.filter(function (u) { return !seen[u] && (seen[u] = true); });
  var xml = ['<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];
  urls.forEach(function (u) {
    xml.push('  <url><loc>' + esc(BASE_URL + '/' + u) + '</loc></url>');
  });
  xml.push('</urlset>');
  writeFile('sitemap.xml', xml.join('\n') + '\n');
  generated.push('sitemap.xml');
  writeFile('robots.txt',
    'User-agent: *\nAllow: /\n\nSitemap: ' + BASE_URL + '/sitemap.xml\n');
  generated.push('robots.txt');
}

/* ------------------------------------------------------------------ */
/* run                                                                 */
/* ------------------------------------------------------------------ */

buildHomepage();
buildToolsIndex();
buildCategoryPages();
allPageTools.forEach(buildToolPage);
buildBlog();
buildStaticPages();
buildSitemapRobots();

console.log('SuvoCalc v' + siteVersion + ' build complete: ' + generated.length + ' files written.');
console.log('  counted tools: ' + toolCount + ' (+ ' + extraPages.filter(function (t) { return t.counted === false; }).length + ' uncounted page(s))');
console.log('  categories: ' + categories.length + ' | blog posts: ' +
  (function () { try { return fs.readdirSync(path.join(ROOT, 'content', 'blog')).filter(function (f) { return /\.md$/i.test(f); }).length; } catch (e) { return 0; } })());
if (warnings.length) {
  console.log('Warnings (' + warnings.length + '):');
  warnings.forEach(function (w) { console.log('  - ' + w); });
}
