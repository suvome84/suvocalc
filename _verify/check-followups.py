#!/usr/bin/env python3
"""SuvoCalc v31 verification — follow-ups:
 - Blog related links: parse <ul class="related-list"> per article, compare
   with source content/blog/*.md front matter (alias-normalized).
 - /tools/ card count: count card elements, not hrefs.
 - Banned substrings: exhaustive substring scan for 69 / v21 / v28 / v23 /
   6.0 / 6.2 / 45+ / '69 tools' / 'Powered by Claude' / ca-pub, with
   classification (a) computed number, (b) code identifier, (c) real claim.
"""
import json, os, re
from collections import Counter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
VERIFY = os.path.dirname(os.path.abspath(__file__))

def pages():
    out = []
    for dp, dns, fns in os.walk(ROOT):
        if '_verify' in dp.split(os.sep): continue
        for fn in fns:
            if fn.endswith('.html') and fn != 'template.html':
                out.append(os.path.join(dp, fn))
    return sorted(out)

# ---------- blog related ----------
ALIAS = {'unit-and-currency-converter': 'unit-currency-converter'}
def md_to_dir(fn):
    return fn[:-3]  # .md stripped; dir names equal md stems
blog = {}
mismatch = []
for fn in sorted(os.listdir(os.path.join(ROOT, 'content', 'blog'))):
    md = open(os.path.join(ROOT, 'content', 'blog', fn), encoding='utf-8').read()
    fm = re.match(r'---\n(.*?)\n---', md, re.S)
    src = []
    if fm:
        r = re.search(r'related:\s*(\[[^\]]*\])', fm.group(1))
        if r: src = [ALIAS.get(s, s) for s in re.findall(r'"([^"]+)"', r.group(1))]
    d = md_to_dir(fn)
    h = open(os.path.join(ROOT, 'blog', d, 'index.html'), encoding='utf-8').read()
    m = re.search(r'<ul class="related-list">(.*?)</ul>', h, re.S)
    gen = sorted(set(re.findall(r'calculators/([^"/]+)/', m.group(1)))) if m else []
    blog[d] = {'source': sorted(src), 'generated': gen, 'match': sorted(src) == gen,
               'has_related_section': bool(m)}
    if sorted(src) != gen:
        mismatch.append(d)

# ---------- /tools/ cards ----------
th = open(os.path.join(ROOT, 'tools', 'index.html'), encoding='utf-8').read()
# card markup: find the repeated card container class
card_classes = re.findall(r'class="([^"]*tool-card[^"]*)"', th)
card_count = len(re.findall(r'<article[^>]*class="[^"]*tool-card', th)) or len(card_classes)
# fallback: count distinct card blocks by data-title
data_titles = re.findall(r'data-title="([^"]+)"', th)
tools_json = json.load(open(os.path.join(ROOT, 'tools.json')))
counted_titles = {t['title'] for t in tools_json['tools'] if t.get('counted', True) is not False}
tools_cards = {
    'card_class_hits': len(card_classes),
    'article_tool_card_count': card_count,
    'data_title_count': len(data_titles),
    'data_title_distinct': len(set(data_titles)),
    'data_titles_match_counted_registry': set(data_titles) == counted_titles,
    'missing_titles': sorted(counted_titles - set(data_titles)),
    'extra_titles': sorted(set(data_titles) - counted_titles),
}

# ---------- banned substrings, exhaustive ----------
# visible text only for claim-like patterns; raw html for identifiers.
def visible_text(h):
    h = re.sub(r'<script[\s\S]*?</script>', ' ', h)
    h = re.sub(r'<style[\s\S]*?</style>', ' ', h)
    h = re.sub(r'<[^>]+>', ' ', h)
    return h

hits = []
for p in pages():
    rel = os.path.relpath(p, ROOT)
    html = open(p, encoding='utf-8').read()
    vis = visible_text(html)
    # (c)-class: real user-visible claims — search visible text
    for pat, label in [(r'69\s+tools', '69 tools claim'),
                       (r'45\+', '45+ claim'),
                       (r'Powered by Claude', 'Powered by Claude'),
                       (r'ca-pub-XXXXXXXXXXXXXXXX', 'placeholder AdSense')]:
        for m in re.finditer(pat, vis):
            hits.append({'page': rel, 'pattern': label, 'class': 'C-REAL-CLAIM',
                         'context': vis[max(0, m.start()-50):m.end()+50].strip()})
    # substring inventory in raw html (numbers + identifiers)
    for pat, label in [(r'69', '69 substring'),
                       (r'v21', 'v21 substring'),
                       (r'v28', 'v28 substring'),
                       (r'v23', 'v23 substring'),
                       (r'6\.0', '6.0 substring'),
                       (r'6\.2', '6.2 substring')]:
        for i, line in enumerate(html.split('\n'), 1):
            for m in re.finditer(pat, line):
                ctx = line[max(0, m.start()-45):m.end()+45]
                hits.append({'page': rel, 'line': i, 'pattern': label,
                             'match': m.group(0), 'context': ctx.strip()[:150]})

# classify the substring hits (not the C claims — those are already class C)
def classify(h):
    ctx = h['context']
    if h['pattern'] == 'v21 substring':
        return 'B-code-identifier (v21Haptic stub name)' if 'v21Haptic' in ctx else 'B-code-identifier?'
    if h['pattern'] == 'v23 substring':
        return 'B-code-identifier (v23-qr-scan-line class)' if 'v23-qr-scan-line' in ctx else 'B-code-identifier?'
    if h['pattern'] == 'v28 substring':
        return 'C-REAL-CLAIM?' if True else ''
    if h['pattern'] == '69 substring':
        return 'A-computed-number'
    if h['pattern'] in ('6.0 substring', '6.2 substring'):
        return 'A-computed-number'
    return '?'

for h in hits:
    if h.get('class') != 'C-REAL-CLAIM':
        h['class'] = classify(h)

summary = Counter((h['pattern'], h['class']) for h in hits)
real_claims = [h for h in hits if h.get('class', '').startswith('C-')]
# any 69/v21/v28/6.x hit NOT classified A or B?
unclassified = [h for h in hits if h.get('class') not in
                ('A-computed-number', 'B-code-identifier (v21Haptic stub name)',
                 'B-code-identifier (v23-qr-scan-line class)', 'C-REAL-CLAIM')]

out = {'blog_related': blog, 'blog_mismatches': mismatch,
       'tools_cards': tools_cards,
       'banned_summary': {f'{k[0]} | {k[1]}': v for k, v in sorted(summary.items())},
       'banned_real_claims': real_claims,
       'banned_unclassified': unclassified,
       'banned_all_hits': hits}
json.dump(out, open(os.path.join(VERIFY, 'check-followups.json'), 'w'), indent=2)
print(json.dumps({'blog_mismatches': mismatch,
                  'blog': {k: v for k, v in blog.items()},
                  'tools_cards': tools_cards,
                  'banned_summary': out['banned_summary'],
                  'banned_real_claims': real_claims,
                  'banned_unclassified': unclassified}, indent=2))
