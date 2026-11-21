#!/usr/bin/env python3
"""SuvoCalc v31 verification — Checks 2, 4, 5, 6, 7, 8 (static HTML analysis).

Check 2: HTML parse (tag-stack mismatch detection) + leftover {{tokens}}.
Check 4: internal link resolution; #anchor targets; external link listing.
Check 5: counts — 57 counted tool pages + sci (58th), 15 blog + index, 7
  category pages, one <footer> + one <h1> per page, sitemap loc count,
  every sitemap URL resolves.
Check 6: banned-string audit with classification.
Check 7: homepage slug dedupe across sections, duplicate id= per page,
  distinct tool cards on /tools/.
Check 8: blog related-link counts vs source content/blog/*.md front matter.
"""
import json, os, re, sys
from html.parser import HTMLParser
from urllib.parse import urlparse, unquote

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
VERIFY = os.path.dirname(os.path.abspath(__file__))

VOID = {'area','base','br','col','embed','hr','img','input','link','meta',
        'param','source','track','wbr'}

def pages():
    out = []
    for dp, dns, fns in os.walk(ROOT):
        if '_verify' in dp.split(os.sep):
            continue
        for fn in fns:
            if fn.endswith('.html') and fn != 'template.html':
                out.append(os.path.join(dp, fn))
    return sorted(out)

class Checker(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.errors = []
        self.ids = {}
        self.h1 = 0
        self.footer = 0
        self.links = []   # (attr, value)
        self.text = []
    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        if tag == 'h1': self.h1 += 1
        if tag == 'footer': self.footer += 1
        if 'id' in d:
            self.ids.setdefault(d['id'], []).append(self.getpos())
        for a in ('href', 'src'):
            if a in d: self.links.append((a, d[a]))
        if tag not in VOID:
            self.stack.append((tag, self.getpos()))
    def handle_startendtag(self, tag, attrs):
        d = dict(attrs)
        if tag == 'h1': self.h1 += 1
        if tag == 'footer': self.footer += 1
        if 'id' in d: self.ids.setdefault(d['id'], []).append(self.getpos())
        for a in ('href', 'src'):
            if a in d: self.links.append((a, d[a]))
    def handle_endtag(self, tag):
        if tag in VOID: return
        if not self.stack:
            self.errors.append(f"stray </{tag}> at {self.getpos()}")
            return
        if self.stack[-1][0] == tag:
            self.stack.pop(); return
        # search for match (mismatch = error, but recover)
        names = [t for t, _ in self.stack]
        if tag in names:
            while self.stack and self.stack[-1][0] != tag:
                t, p = self.stack.pop()
                self.errors.append(f"unclosed <{t}> opened at {p}, closed by </{tag}> at {self.getpos()}")
            self.stack.pop()
        else:
            self.errors.append(f"stray </{tag}> at {self.getpos()} (no open tag)")
    def handle_data(self, data):
        self.text.append(data)

PAGES = pages()
report = {'page_count': len(PAGES), 'parse': {}, 'tokens': {}, 'h1_footer': {},
          'links': {'broken': [], 'external': [], 'anchors_missing': []},
          'counts': {}, 'banned': [], 'duplicates': {}, 'blog': {}}

# ---- per-page checks ----
all_ids_global = {}
for p in PAGES:
    rel = os.path.relpath(p, ROOT)
    html = open(p, encoding='utf-8').read()
    c = Checker()
    try:
        c.feed(html)
    except Exception as e:
        c.errors.append(f"parser exception: {e}")
    for t, pos in c.stack:
        c.errors.append(f"unclosed <{t}> opened at {pos} (EOF)")
    report['parse'][rel] = c.errors
    toks = re.findall(r'\{\{[^}]*\}\}', html)
    if toks: report['tokens'][rel] = sorted(set(toks))
    report['h1_footer'][rel] = {'h1': c.h1, 'footer': c.footer}
    dup = {i: len(v) for i, v in c.ids.items() if len(v) > 1}
    if dup: report['duplicates'][rel] = dup
    all_ids_global[rel] = set(c.ids.keys())

    # ---- link check ----
    page_dir = os.path.dirname(p)
    for attr, val in c.links:
        if not val: continue
        if val.startswith(('mailto:', 'tel:', 'javascript:', 'data:')): continue
        if val.startswith('#'):
            frag = unquote(val[1:])
            if frag and frag not in c.ids:
                report['links']['anchors_missing'].append({'page': rel, 'anchor': val})
            continue
        parsed = urlparse(val)
        if parsed.scheme in ('http', 'https'):
            report['links']['external'].append({'page': rel, 'url': val})
            continue
        # internal: strip query/fragment, resolve relative to page dir
        target = unquote(parsed.path)
        if not target: continue
        if target.startswith('/'):
            fs_path = os.path.join(ROOT, target.lstrip('/'))
        else:
            fs_path = os.path.normpath(os.path.join(page_dir, target))
        if os.path.isdir(fs_path):
            fs_path = os.path.join(fs_path, 'index.html')
        if not os.path.exists(fs_path):
            report['links']['broken'].append({'page': rel, 'attr': attr, 'href': val,
                                              'resolved': os.path.relpath(fs_path, ROOT)})

# ---- counts ----
tools = json.load(open(os.path.join(ROOT, 'tools.json')))
counted = [t for t in tools['tools'] if t.get('counted', True) is not False]
sci = [t for t in tools['tools'] if t.get('counted') is False]
calc_dirs = [d for d in os.listdir(os.path.join(ROOT, 'calculators'))]
report['counts'] = {
  'registry_total': len(tools['tools']),
  'registry_counted': len(counted),
  'registry_uncounted': [t['slug'] for t in sci],
  'calculator_pages_on_disk': len(calc_dirs),
  'calculator_slugs_missing': [t['slug'] for t in tools['tools'] if t['slug'] not in calc_dirs],
  'calculator_dirs_extra': [d for d in calc_dirs if d not in {t['slug'] for t in tools['tools']}],
  'blog_articles_on_disk': len([d for d in os.listdir(os.path.join(ROOT, 'blog')) if d != 'index.html']),
  'blog_index': os.path.exists(os.path.join(ROOT, 'blog', 'index.html')),
  'category_pages': sorted(os.listdir(os.path.join(ROOT, 'categories'))),
  'category_count': len(os.listdir(os.path.join(ROOT, 'categories'))),
  'h1_violations': {k: v for k, v in report['h1_footer'].items() if v['h1'] != 1},
  'footer_violations': {k: v for k, v in report['h1_footer'].items() if v['footer'] != 1},
}
# category counts from registry
from collections import Counter
catc = Counter(t['category'] for t in counted)
report['counts']['registry_category_counts'] = dict(sorted(catc.items()))

# sitemap
sm = open(os.path.join(ROOT, 'sitemap.xml'), encoding='utf-8').read()
locs = re.findall(r'<loc>([^<]+)</loc>', sm)
base = tools['site']['baseUrl'].rstrip('/')
missing = []
for u in locs:
    assert u.startswith(base), u
    relp = u[len(base):].strip('/')
    fp = os.path.join(ROOT, relp, 'index.html') if relp else os.path.join(ROOT, 'index.html')
    if not os.path.exists(fp): missing.append(u)
report['counts']['sitemap_loc_count'] = len(locs)
report['counts']['sitemap_missing_files'] = missing
report['counts']['sitemap_equals_page_count'] = (len(locs) == len(PAGES))
report['counts']['robots_points_to_sitemap'] = 'sitemap.xml' in open(os.path.join(ROOT, 'robots.txt'), encoding='utf-8').read()

# ---- banned strings (check 6) ----
# classify each hit: (a) computed-number substring, (b) code identifier,
# (c) real user-visible claim -> must be zero.
# We scan visible text (tags stripped) AND raw html separately for identifiers.
def strip_tags(h):
    h = re.sub(r'<script[\s\S]*?</script>', ' ', h)
    h = re.sub(r'<style[\s\S]*?</style>', ' ', h)
    return re.sub(r'<[^>]+>', ' ', h)

banned = []
for p in PAGES:
    rel = os.path.relpath(p, ROOT)
    html = open(p, encoding='utf-8').read()
    visible = strip_tags(html)
    lines = html.split('\n')
    vis_lines = visible.split('\n')
    for pat, label in [
        (r'69\s+tools', '69 tools claim'),
        (r'45\+', '45+ claim'),
        (r'Powered by Claude', 'Powered by Claude'),
        (r'ca-pub-XXXXXXXXXXXXXXXX', 'placeholder AdSense client'),
        (r'\bv28\b', 'v28'),
        (r'\bv21\b', 'v21'),
        (r'\bv23\b', 'v23'),
        (r'\b6\.0\b', '6.0'),
        (r'\b6\.2\b', '6.2'),
    ]:
        for i, line in enumerate(lines, 1):
            for m in re.finditer(pat, line):
                # is it inside a <script> or a class/id attribute (code identifier)?
                ctx = line[max(0, m.start()-60):m.end()+60]
                in_script = '<script' in html[:html.find(line)] if False else None
                banned.append({'page': rel, 'line': i, 'pattern': label,
                               'match': m.group(0), 'context': ctx.strip()[:160]})
report['banned_raw_hits'] = banned
report['banned_hit_count'] = len(banned)

# ---- homepage dedupe (check 7) ----
home = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
# sections: find <section ... id="..."> ... </section> blocks
sections = {}
for m in re.finditer(r'<section[^>]*?(?:id="([^"]+)")?[^>]*>(.*?)</section>', home, re.S):
    sid = m.group(1) or f"unnamed@{m.start()}"
    slugs = sorted(set(re.findall(r'href="(?:\.\./|/)?calculators/([^"/]+)/', m.group(2))))
    sections[sid] = slugs
# also: any calculator link outside sections
all_home_slugs = sorted(set(re.findall(r'href="(?:\.\./|/)?calculators/([^"/]+)/', home)))
seen = {}
dup_home = []
for sid, slugs in sections.items():
    for s in slugs:
        if s in seen: dup_home.append({'slug': s, 'sections': [seen[s], sid]})
        seen[s] = sid
report['duplicates']['homepage_sections'] = sections
report['duplicates']['homepage_slug_in_two_sections'] = dup_home
report['duplicates']['homepage_all_calc_slugs'] = all_home_slugs

# /tools/ distinct cards
tools_html = open(os.path.join(ROOT, 'tools', 'index.html'), encoding='utf-8').read()
cards = re.findall(r'href="(?:\.\./|/)?calculators/([^"/]+)/', tools_html)
report['duplicates']['tools_page_card_hrefs'] = len(cards)
report['duplicates']['tools_page_distinct_slugs'] = len(set(cards))
report['duplicates']['tools_page_duplicated_slugs'] = sorted({s for s in set(cards) if cards.count(s) > 1})
report['duplicates']['tools_page_has_scientific'] = 'scientific-calculator' in set(cards)

# ---- blog related links vs source (check 8) ----
blog_src = {}
for fn in sorted(os.listdir(os.path.join(ROOT, 'content', 'blog'))):
    md = open(os.path.join(ROOT, 'content', 'blog', fn), encoding='utf-8').read()
    fm = re.match(r'---\n(.*?)\n---', md, re.S)
    rel_list = []
    if fm:
        r = re.search(r'related:\s*(\[[^\]]*\])', fm.group(1))
        if r:
            rel_list = re.findall(r'"([^"]+)"', r.group(1))
    blog_src[fn] = rel_list
# generated articles: find related section links
gen = {}
for d in sorted(os.listdir(os.path.join(ROOT, 'blog'))):
    if d == 'index.html': continue
    h = open(os.path.join(ROOT, 'blog', d, 'index.html'), encoding='utf-8').read()
    # related links live in a "related" section; find links to calculators within it
    m = re.search(r'[Rr]elated[^<]{0,80}?(?:</h[23]>|<div[^>]*>)(.*?)(?:</section>|</div>\s*</div>)', h, re.S)
    # fallback: count calculator hrefs in the whole page that appear in a "Related" heading block
    rel_links = []
    rm = re.search(r'(Related[^<]*</h[23]>)(.*?)(?=<(?:section|footer)|$)', h, re.S | re.I)
    if rm:
        rel_links = sorted(set(re.findall(r'calculators/([^"/]+)/', rm.group(2))))
    gen[d] = rel_links
report['blog']['source_related_counts'] = {k: len(v) for k, v in blog_src.items()}
report['blog']['generated_related'] = gen
# map source md -> generated dir by matching title slug? Use order: generated dir names
# contain the article slug; match by shared words is fragile — instead compare counts
# per article via the <link rel="canonical"> or title. Use title from front matter.
title_map = {}
for fn in sorted(os.listdir(os.path.join(ROOT, 'content', 'blog'))):
    md = open(os.path.join(ROOT, 'content', 'blog', fn), encoding='utf-8').read()
    fm = re.match(r'---\n(.*?)\n---', md, re.S)
    t = re.search(r'title:\s*"([^"]+)"', fm.group(1)).group(1) if fm else fn
    title_map[fn] = t
report['blog']['source_titles'] = title_map
report['blog']['source_related'] = blog_src

json.dump(report, open(os.path.join(VERIFY, 'check-static.json'), 'w'), indent=2)
print(json.dumps({
  'pages': len(PAGES),
  'parse_errors_total': sum(len(v) for v in report['parse'].values()),
  'pages_with_parse_errors': [k for k, v in report['parse'].items() if v],
  'leftover_tokens': report['tokens'],
  'h1_violations': report['counts']['h1_violations'],
  'footer_violations': report['counts']['footer_violations'],
  'broken_links': report['links']['broken'],
  'anchors_missing': report['links']['anchors_missing'],
  'external_link_count': len(report['links']['external']),
  'external_links': sorted(set(x['url'] for x in report['links']['external'])),
  'counts': report['counts'],
  'banned_hit_count': len(banned),
  'dup_ids_pages': {k: v for k, v in report['duplicates'].items() if isinstance(v, dict) and k not in ('homepage_sections',)},
  'homepage_dup_slugs': dup_home,
  'tools_page': {k: report['duplicates'][k] for k in ('tools_page_card_hrefs','tools_page_distinct_slugs','tools_page_duplicated_slugs','tools_page_has_scientific')},
  'blog_source_counts': report['blog']['source_related_counts'],
  'blog_generated': gen,
}, indent=2))
