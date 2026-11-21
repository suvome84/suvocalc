/* ==========================================================================
   SuvoCalc v31 — site JavaScript (main.js)
   One script for every page: nav, theme, search, recently-used, cookie
   banner, result sharing. No AI, no ads, no tracking, no other prompts.
   Every handler guards with a null check: elements exist only on some pages.
   Depends on nothing except the DOM. calc.js (calculator helpers + the
   per-tool calc functions) is a separate file owned by another worker.
   ========================================================================== */
(function () {
  'use strict';

  var THEME_KEY = 'sc_theme';
  var RECENT_KEY = 'sc_recently_used';
  var COOKIE_KEY = 'sc_cookie_seen';
  var RECENT_MAX = 6;

  /* ---- small helpers ---------------------------------------------------- */
  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function $all(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { /* storage unavailable (private mode): ignore */ }
  }

  /* ---- theme ------------------------------------------------------------ */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
  }

  var themeToggle = $('#theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* ignore */ }
    });
  }

  /* ---- active nav ------------------------------------------------------- */
  var activeNav = document.body ? document.body.getAttribute('data-active-nav') : null;
  if (activeNav) {
    $all('[data-nav="' + activeNav + '"]').forEach(function (link) {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
    });
  }

  /* ---- mobile nav toggle ------------------------------------------------- */
  var navToggle = $('#nav-toggle');
  var siteNav = $('#site-nav');
  if (navToggle && siteNav) {
    navToggle.addEventListener('click', function () {
      var open = siteNav.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    $all('.nav-link', siteNav).forEach(function (link) {
      link.addEventListener('click', function () {
        siteNav.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.setAttribute('aria-label', 'Open menu');
      });
    });
  }

  /* ---- tool index (embedded JSON, present on home + tools pages) -------- */
  function getToolIndex() {
    var el = $('#tool-index');
    if (!el) return [];
    try {
      var data = JSON.parse(el.textContent || '[]');
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return [];
    }
  }

  function toolUrlPrefix() {
    /* Pages link to calculators from different depths; the generator writes
       the correct prefix into data-tool-url-prefix on <body>. Default: root. */
    return document.body ? (document.body.getAttribute('data-tool-url-prefix') || '') : '';
  }

  function toolCardHtml(tool) {
    var prefix = toolUrlPrefix();
    var url = prefix + 'calculators/' + encodeURIComponent(tool.slug) + '/';
    return '<article class="card tool-card">' +
      '<h3><a href="' + esc(url) + '">' + esc(tool.title) + '</a></h3>' +
      '<p>' + esc(tool.description || '') + '</p>' +
      '<span class="category-tag">' + esc(tool.categoryLabel || tool.category || '') + '</span>' +
      '<a class="btn btn-secondary btn-small" href="' + esc(url) + '">Open Calculator</a>' +
      '</article>';
  }

  function searchTools(query, tools) {
    var q = (query || '').trim().toLowerCase();
    if (!q) return [];
    var words = q.split(/\s+/);
    return tools.filter(function (t) {
      var hay = ((t.title || '') + ' ' + (t.description || '') + ' ' + (t.category || '') + ' ' + (t.slug || '')).toLowerCase();
      return words.every(function (w) { return hay.indexOf(w) !== -1; });
    });
  }

  /* ---- homepage live search ---------------------------------------------- */
  var homeSearch = $('#home-search');
  var homeResults = $('#home-search-results');
  if (homeSearch && homeResults) {
    var homeTools = getToolIndex();
    homeSearch.addEventListener('input', function () {
      var matches = searchTools(homeSearch.value, homeTools).slice(0, 12);
      if (!homeSearch.value.trim()) {
        homeResults.innerHTML = '';
        homeResults.hidden = true;
        return;
      }
      if (matches.length === 0) {
        homeResults.innerHTML = '<div class="empty-state">No calculator matches "' +
          esc(homeSearch.value.trim()) + '". Try a different word, or browse all tools.</div>';
      } else {
        homeResults.innerHTML = '<div class="card-grid">' +
          matches.map(toolCardHtml).join('') + '</div>';
      }
      homeResults.hidden = false;
    });
  }

  /* ---- /tools/ page: search input + category filter buttons -------------- */
  var toolSearch = $('#tool-search');
  var toolGrid = $('#tool-grid');
  var filterBar = $('#category-filters');
  var activeCategory = 'all';

  function applyToolFilter() {
    if (!toolGrid) return;
    var q = toolSearch ? toolSearch.value.trim().toLowerCase() : '';
    var visible = 0;
    $all('.tool-card', toolGrid).forEach(function (card) {
      var cat = card.getAttribute('data-category') || '';
      var hay = ((card.getAttribute('data-title') || '') + ' ' +
        (card.getAttribute('data-description') || '')).toLowerCase();
      var okCat = activeCategory === 'all' || cat === activeCategory;
      var okQ = !q || hay.indexOf(q) !== -1;
      card.hidden = !(okCat && okQ);
      if (okCat && okQ) visible += 1;
    });
    var empty = $('#tool-empty');
    if (empty) empty.hidden = visible !== 0;
    var count = $('#tool-count');
    if (count) count.textContent = visible + (visible === 1 ? ' calculator' : ' calculators');
  }

  if (toolSearch) toolSearch.addEventListener('input', applyToolFilter);

  if (filterBar) {
    $all('[data-filter-category]', filterBar).forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeCategory = btn.getAttribute('data-filter-category') || 'all';
        $all('[data-filter-category]', filterBar).forEach(function (b) {
          var on = b === btn;
          b.classList.toggle('active', on);
          if (on) b.setAttribute('aria-pressed', 'true');
          else b.removeAttribute('aria-pressed');
        });
        applyToolFilter();
      });
    });
  }

  if (toolGrid) applyToolFilter();

  /* ---- recently used ------------------------------------------------------ */
  function recordRecent(slug, title) {
    if (!slug || !title) return;
    var list = readJson(RECENT_KEY, []);
    list = list.filter(function (item) { return item && item.slug !== slug; });
    list.unshift({ slug: slug, title: title });
    writeJson(RECENT_KEY, list.slice(0, RECENT_MAX));
  }

  /* On every tool page the generator writes data-tool-slug / data-tool-title
     on <body>; record the visit once per page load. */
  if (document.body) {
    var pageSlug = document.body.getAttribute('data-tool-slug');
    var pageTitle = document.body.getAttribute('data-tool-title');
    if (pageSlug && pageTitle) recordRecent(pageSlug, pageTitle);
  }

  /* Render the Recently Used section on the homepage (hidden when empty). */
  var recentSection = $('#recently-used');
  var recentGrid = $('#recently-used-grid');
  if (recentSection && recentGrid) {
    var recent = readJson(RECENT_KEY, []);
    if (recent.length === 0) {
      recentSection.hidden = true;
    } else {
      var tools = getToolIndex();
      var bySlug = {};
      tools.forEach(function (t) { bySlug[t.slug] = t; });
      var cards = recent
        .map(function (item) { return bySlug[item.slug]; })
        .filter(function (t) { return !!t; })
        .map(toolCardHtml);
      if (cards.length === 0) {
        recentSection.hidden = true;
      } else {
        recentGrid.innerHTML = cards.join('');
        recentSection.hidden = false;
      }
    }
  }

  /* ---- cookie banner (show once, nothing else auto-pops) ----------------- */
  var cookieBanner = $('#cookie-banner');
  var cookieAccept = $('#cookie-accept');
  if (cookieBanner) {
    var seen = false;
    try { seen = localStorage.getItem(COOKIE_KEY) === '1'; } catch (e) { seen = false; }
    if (!seen) cookieBanner.hidden = false;
    if (cookieAccept) {
      cookieAccept.addEventListener('click', function () {
        try { localStorage.setItem(COOKIE_KEY, '1'); } catch (e) { /* ignore */ }
        cookieBanner.hidden = true;
      });
    }
  }

  /* ---- share result (tool pages) ------------------------------------------ */
  var shareBtn = $('#share-result');
  if (shareBtn) {
    shareBtn.addEventListener('click', function () {
      var valueEl = $('#res-value');
      var labelEl = $('#res-label');
      var statusEl = $('#share-status');
      var value = valueEl ? valueEl.textContent.trim() : '';
      var label = labelEl ? labelEl.textContent.trim() : '';
      var text = (label ? label + ': ' : '') + (value || document.title);
      var fullText = text + ' — calculated on SuvoCalc (' + window.location.href + ')';
      function done(msg) {
        if (statusEl) statusEl.textContent = msg;
      }
      if (navigator.share) {
        navigator.share({ title: document.title, text: fullText, url: window.location.href })
          .then(function () { done('Shared'); })
          .catch(function () { /* user cancelled: stay silent */ });
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(fullText)
          .then(function () { done('Copied to clipboard'); })
          .catch(function () { done('Copy failed — select the result to copy it'); });
      } else {
        done('Sharing is not supported in this browser — select the result to copy it');
      }
    });
  }
})();
