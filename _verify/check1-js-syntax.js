#!/usr/bin/env node
/* SuvoCalc v31 verification — Check 1: JS syntax.
 * node --check on build.js, assets/js/main.js, assets/js/calc.js, and every
 * classic inline <script> block in every generated HTML page (89 pages).
 * JSON-LD / application/json blocks are data, not JS — skipped by design.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const out = { checked: 0, failures: [], jsFiles: [], inlineScripts: 0 };

function nodeCheck(code, label) {
  const tmp = path.join('/tmp', 'v31-check-' + process.pid + '.js');
  fs.writeFileSync(tmp, code);
  try {
    execFileSync('node', ['--check', tmp], { stdio: 'pipe', timeout: 15000 });
    out.checked++;
    return true;
  } catch (e) {
    out.failures.push({ file: label, error: (e.stderr || e.stdout || e.message).toString().slice(0, 500) });
    out.checked++;
    return false;
  } finally { try { fs.unlinkSync(tmp); } catch (e) {} }
}

// standalone JS files
for (const f of ['build.js', 'assets/js/main.js', 'assets/js/calc.js']) {
  const p = path.join(ROOT, f);
  out.jsFiles.push(f);
  nodeCheck(fs.readFileSync(p, 'utf8'), f);
}

// every generated HTML page (89): index.html files under ROOT except template.html
function walk(dir, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== '_verify') walk(p, acc); }
    else if (e.name.endsWith('.html') && e.name !== 'template.html') acc.push(p);
  }
  return acc;
}
const pages = walk(ROOT, []);
const scriptRe = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
for (const page of pages) {
  const html = fs.readFileSync(page, 'utf8');
  let m, idx = 0;
  while ((m = scriptRe.exec(html)) !== null) {
    const attrs = m[1], code = m[2];
    if (/src\s*=/.test(attrs)) continue;                       // external file
    if (/type\s*=\s*["']application\/(ld\+)?json["']/.test(attrs)) continue; // data block
    out.inlineScripts++;
    nodeCheck(code, path.relative(ROOT, page) + ' :: inline script #' + idx);
    idx++;
  }
}

console.log(JSON.stringify(out, null, 2));
fs.writeFileSync(path.join(__dirname, 'check1-js-syntax.json'), JSON.stringify(out, null, 2));
console.log(`\nTOTAL checked=${out.checked} inline=${out.inlineScripts} jsFiles=${out.jsFiles.length} failures=${out.failures.length}`);
