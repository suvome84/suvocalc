#!/usr/bin/env node
/* SuvoCalc v31 verification — Check 3: calculator test table.
 * Runs the ACTUAL generated per-tool inline script from each calculator page
 * inside a Node vm with a DOM shim, feeds test vectors, and compares the
 * captured result against an INDEPENDENTLY computed expected value
 * (formulas re-derived in this harness — never by re-running calc code).
 * A tool with no runnable assertion is NEEDS-BROWSER, never PASS.
 */
const vm = require('vm');
const nodeCrypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const tools = require(path.join(ROOT, 'tools.json'));
const calcJs = fs.readFileSync(path.join(ROOT, 'assets/js/calc.js'), 'utf8');

/* ---------- DOM shim ---------- */
function ctxStub() {
  return new Proxy({}, {
    get(t, k) { if (k === 'canvas') return {}; return function () {}; },
    set() { return true; }
  });
}
function makeEl(id) {
  const el = {
    id, tagName: 'DIV', value: '', textContent: '', innerHTML: '',
    style: {}, hidden: false, checked: false, className: '',
    placeholder: '', src: '', width: 0, height: 0, offsetWidth: 300,
    _attrs: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, removeEventListener() {},
    appendChild() {}, click() {}, focus() {}, play() {}, pause() {},
    closest() { return { querySelectorAll() { return []; } }; },
    querySelectorAll() { return []; }, querySelector() { return null; },
    getAttribute(n) { return el._attrs[n] !== undefined ? el._attrs[n] : null; },
    setAttribute(n, v) { el._attrs[n] = v; },
    getContext() { return ctxStub(); },
    toDataURL() { return 'data:image/png;base64,xxx'; },
  };
  return el;
}

function buildContext(pageHtml, fieldValues) {
  const elements = new Map();
  const getEl = (id) => {
    if (!elements.has(id)) elements.set(id, makeEl(id));
    return elements.get(id);
  };
  // pre-create every id present in the page HTML
  const idRe = /id="([^"]+)"/g; let m;
  while ((m = idRe.exec(pageHtml)) !== null) getEl(m[1]);
  // world-clock rows: elements with class wc-time + data-tz
  const wcTimes = [];
  const wcRe = /<[^>]*class="[^"]*wc-time[^"]*"[^>]*data-tz="([^"]+)"[^>]*>/g;
  while ((m = wcRe.exec(pageHtml)) !== null) {
    const e = makeEl('wc-' + m[1]); e._attrs['data-tz'] = m[1]; wcTimes.push(e);
  }
  const document = {
    getElementById: (id) => elements.get(id) || null,
    querySelectorAll: (sel) => (sel === '.wc-time' ? wcTimes : []),
    querySelector: () => null,
    createElement: (tag) => makeEl('created-' + tag),
    addEventListener() {}, removeEventListener() {},
    documentElement: { setAttribute() {} },
    body: makeEl('body'),
  };
  const sandbox = {
    console, Math, JSON, Intl, Date, Number, String, Array, Object,
    Uint32Array, Uint8Array,
    parseFloat, parseInt, isNaN, isFinite, Error, RegExp, Promise,
    setTimeout, clearTimeout,
    setInterval: () => 0,           // stub: never schedule (avoids hanging)
    clearInterval: () => {},
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    crypto: { getRandomValues(arr) { nodeCrypto.randomFillSync(arr); return arr; } },
    addEventListener() {}, removeEventListener() {},
    navigator: { vibrate() {}, mediaDevices: undefined, userAgent: 'node-shim' },
    location: { href: '' },
    Audio: function () { this.play = function () {}; },
    Image: function () {},
    document,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  // field values (defaults from registry first, then test vector)
  for (const [id, v] of Object.entries(fieldValues)) {
    const el = getEl(id);
    if (typeof v === 'object' && v !== null && 'checked' in v) { el.checked = v.checked; el.value = v.value || ''; }
    else el.value = String(v);
  }
  sandbox.__getEl = getEl;
  sandbox.__wcTimes = wcTimes;
  sandbox.__elements = elements;
  return sandbox;
}

function runPage(sandbox, pageHtml) {
  vm.runInContext(calcJs, sandbox, { filename: 'calc.js' });
  const scripts = [...pageHtml.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(x => !/src\s*=/.test(x[1]) && !/application\/(ld\+)?json/.test(x[1]))
    .map(x => x[2]);
  const toolScript = scripts.find(s => s.includes('runToolCalc'));
  if (!toolScript) throw new Error('no runToolCalc script found in page');
  vm.runInContext(toolScript, sandbox, { filename: 'tool-page.js' });
  return sandbox;
}

function capture(sandbox, toolId) {
  const g = (id) => { const e = sandbox.__elements.get(id); return e ? e.textContent : null; };
  const gh = (id) => { const e = sandbox.__elements.get(id); return e ? e.innerHTML : null; };
  return {
    resValue: g('res-value'), resLabel: g('res-label'), resDetails: gh('res-details'),
    resError: g('res-error'),
    custom: (id) => gh(id), customText: (id) => g(id),
  };
}
const num = (s) => { if (s === null || s === undefined) return NaN; const m = String(s).replace(/[₹,\s]/g, '').match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : NaN; };
const stripTags = (s) => (s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

/* ---------- independent expectations (re-derived formulas) ---------- */
function emiCalc(P, annualPct, months) { const r = annualPct / 12 / 100; return P * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1); }
function flames(n1, n2) { // independent re-implementation of the FLAMES elimination rule
  let a = n1.toLowerCase().replace(/\s/g, '').split('');
  let b = n2.toLowerCase().replace(/\s/g, '').split('');
  for (let i = 0; i < a.length; i++) { const j = b.indexOf(a[i]); if (j !== -1) { a[i] = null; b[j] = null; } }
  const count = a.filter(x => x !== null).length + b.filter(x => x !== null).length;
  const arr = ['Friends', 'Love', 'Affection', 'Marriage', 'Enemies', 'Siblings'];
  let idx = 0;
  while (arr.length > 1) { idx = (idx + count - 1) % arr.length; arr.splice(idx, 1); if (idx >= arr.length) idx = 0; }
  return arr[0];
}

/* ---------- test definitions: one entry per tool id ---------- */
const T = {};
T.pct = { inputs: { pA: 20, pB: 500 }, check: (c) => eq(num(c.resValue), 100, 'res-value') };
T.emi = { cases: [
  { inputs: { eP: 500000, eR: 8.5, eN: 60 }, check: (c) => eq(num(c.resValue), Math.round(emiCalc(500000, 8.5, 60)), 'res-value') },
  { inputs: { eP: 500000, eR: 0, eN: 60 }, check: (c) => eq(num(c.resValue), 8333, 'res-value (0% interest: 500000/60)') },
]};
T.disc = { inputs: { dO: 1000, dP: 20 }, check: (c) => eq(num(c.resValue), 800, 'res-value') };
T.ci = { cases: [
  { inputs: { ciP: 100000, ciR: 8, ciN: 5, ciC: 'Yearly' }, check: (c) => eq(num(c.resValue), Math.round(100000 * Math.pow(1.08, 5)), 'res-value') },
  { inputs: { ciP: 100000, ciR: 0, ciN: 5, ciC: 'Yearly' }, check: (c) => eq(num(c.resValue), 100000, 'res-value (0% rate)') },
]};
T.si = { inputs: { siP: 100000, siRate: 8, siT: 5 }, check: (c) => eq(num(c.resValue), 40000, 'res-value') };
T.sal = { inputs: { salG: 1200000, salPF1: 12, salT: 2400 }, check: (c) => eq(num(c.resValue), 87800, 'res-value') };
T.budget = { inputs: { budInc: 100000, budExp: 50000, budSave: 20000 }, check: (c) => eq(num(c.resValue), 20000, 'res-value') };
T.loan = { inputs: { lnI: 60000, lnE: 5000, lnR: 9, lnT: 20 }, check: (c) => eq(num(c.resValue), Math.round(25000 * (Math.pow(1.0075, 240) - 1) / (0.0075 * Math.pow(1.0075, 240))), 'res-value') };
T.emi2 = { inputs: { emi2Inc: 60000, emi2Emi: 5000, emi2Rate: 9, emi2Ten: 20 }, check: (c) => {
  const txt = stripTags(c.custom('emi2Res')); const first = txt.match(/₹\s*([\d,]+)/);
  return eq(first ? num(first[1]) : NaN, Math.round(25000 * (Math.pow(1.0075, 240) - 1) / (0.0075 * Math.pow(1.0075, 240))), 'max loan in emi2Res'); } };
T.overtime = { inputs: { otRate: 200, otHours: 40, otOTHours: 10, otMulti: 1.5 }, check: (c) => eq(num(c.resValue), 11000, 'res-value') };
T.lcomp = { inputs: { lcP: 500000, lcR1: 9, lcN1: 240, lcR2: 8.5, lcN2: 180 }, check: (c) => {
  const html = c.custom('res-lcomp') || ''; const e1 = Math.round(emiCalc(500000, 9, 240)), e2 = Math.round(emiCalc(500000, 8.5, 180));
  const t1 = emiCalc(500000, 9, 240) * 240, t2 = emiCalc(500000, 8.5, 180) * 180;
  const better = t1 < t2 ? 'Loan 1' : 'Loan 2';
  const ok = html.includes(e1.toLocaleString('en-IN')) && html.includes(e2.toLocaleString('en-IN')) && html.includes(better + ' saves');
  return ok ? pass(`EMI1 ₹${e1.toLocaleString('en-IN')}, EMI2 ₹${e2.toLocaleString('en-IN')}, ${better} saves`) : fail(`res-lcomp missing EMI ${e1}/${e2} or "${better} saves"`, html.slice(0, 200)); } };
T.gst = { cases: [
  { inputs: { gA: 1000, gR: 18, gM: 'Add GST', gT: 'Within state (CGST + SGST)' }, check: (c) => {
    const d = stripTags(c.resDetails);
    const ok = num(c.resValue) === 180 && d.includes('₹180') && d.includes('₹1,180') && d.includes('₹90');
    return ok ? pass('GST ₹180, total ₹1,180, CGST ₹90, SGST ₹90') : fail(`value=${c.resValue} details=${d}`, ''); } },
  { inputs: { gA: 1180, gR: 18, gM: 'Remove GST', gT: 'Within state (CGST + SGST)' }, check: (c) => {
    const d = stripTags(c.resDetails);
    const ok = num(c.resValue) === 180 && d.includes('₹1,000') && d.includes('₹180');
    return ok ? pass('base ₹1,000, GST ₹180') : fail(`value=${c.resValue} details=${d}`, ''); } },
  { inputs: { gA: 1000, gR: 40, gM: 'Add GST', gT: 'Within state (CGST + SGST)' }, check: (c) => {
    const d = stripTags(c.resDetails);
    const ok = num(c.resValue) === 400 && d.includes('₹1,400');
    return ok ? pass('GST ₹400, total ₹1,400') : fail(`value=${c.resValue} details=${d}`, ''); } },
]};
T.tax = { cases: [
  { inputs: { txI: 1500000, txR: 'New Regime 2025-26' }, check: (c) => eq(num(c.resValue), 97500, 'res-value (salaried: taxable 14,25,000 after 75,000 std deduction)') },
  { inputs: { txI: 1280000, txR: 'New Regime 2025-26' }, check: (c) => eq(num(c.resValue), 5200, 'res-value (marginal relief: slab tax 60,750 capped at 5,000 + 4% cess)') },
]};
T.hra = { inputs: { hraSal: 50000, hraDA: 10000, hraRcv: 20000, hraRent: 15000, hraCity: 'Metro' }, check: (c) => {
  const txt = stripTags(c.custom('hraRes')); const m = txt.match(/₹\s*([\d,]+)/);
  return eq(m ? num(m[1]) : NaN, 9000, 'exemption in hraRes'); } };
T.homeloan = { inputs: { hlLoan: 5000000, hlRate: 8.5, hlTenure: 20, hlIncome: 1500000, hlSlab: 30 }, check: (c) => {
  const e = emiCalc(5000000, 8.5, 240);
  const yr1P = Math.min(e * 12 - 200000, 150000);
  const expected = Math.round((200000 + yr1P) * 0.30);
  const txt = stripTags(c.custom('homeloanRes')); const m = txt.match(/₹\s*([\d,]+)/);
  return eq(m ? num(m[1]) : NaN, expected, 'annual tax saving in homeloanRes'); } };
T.breakeven = { inputs: { beFixed: 50000, bePrice: 100, beVar: 60, beUnits: 1000 }, check: (c) => eq(num(c.resValue), 1250, 'res-value') };
T.sip = { cases: [
  { inputs: { siM: 5000, siR: 12, siY: 10 }, check: (c) => eq(num(c.resValue), Math.round(5000 * ((Math.pow(1.01, 120) - 1) / 0.01) * 1.01), 'res-value') },
  { inputs: { siM: 5000, siR: 0, siY: 10 }, check: (c) => eq(num(c.resValue), 600000, 'res-value (0% return: 5000x120)') },
]};
T.stock = { inputs: { stB: 100, stQ: 10, stS: 150, stY: 1 }, check: (c) => eq(num(c.resValue), 500, 'res-value') };
T.crypto = { inputs: { crI: 10000, crB: 50000, crN: 75000 }, check: (c) => eq(num(c.resValue), 0.2, 'res-value (coins)') };
T.retire = { inputs: { rtA: 30, rtR: 60, rtE: 50000, rtI: 8, rtF: 6 }, check: (c) => {
  const fut = 50000 * Math.pow(1.06, 30); const corpus = Math.round(fut * 12 / 0.02);
  return eq(num(c.resValue), corpus, 'res-value'); } };
T.ppf = { inputs: { ppfY: 150000, ppfR: 7.1, ppfT: 15 }, check: (c) => {
  let bal = 0; for (let i = 1; i <= 15; i++) bal = (bal + 150000) * 1.071;
  return eq(num(c.resValue), Math.round(bal), 'res-value'); } };
T.fd = { inputs: { fdP: 100000, fdR: 7, fdT: 5, fdFreq: 'Quarterly' }, check: (c) => {
  const txt = stripTags(c.custom('fdRes')); const m = txt.match(/₹\s*([\d,]+)/);
  return eq(m ? num(m[1]) : NaN, Math.round(100000 * Math.pow(1 + 0.07 / 4, 20)), 'maturity in fdRes'); } };
T.cagr = { inputs: { cagrStart: 100000, cagrEnd: 200000, cagrYrs: 5 }, check: (c) => {
  const txt = stripTags(c.custom('cagrRes'));
  return txt.includes('14.87%') ? pass('CAGR 14.87%') : fail('CAGR 14.87% not found', txt.slice(0, 200)); } };
T.networth = { inputs: { nwCash: 100000, nwInvest: 500000, nwProperty: 2000000, nwOther: 50000, nwHomeLoan: 1000000, nwPersonal: 100000, nwCC: 50000 }, check: (c) => {
  const txt = stripTags(c.custom('networthRes')); const m = txt.match(/₹\s*([\d,]+)/);
  return eq(m ? num(m[1]) : NaN, 1500000, 'net worth in networthRes'); } };
T.savgoal = { inputs: { sgGoal: 100000, sgSaved: 0, sgMonthly: 5000, sgMonths: 0, sgRate: 4 }, check: (c) => {
  let bal = 0, m = 0; const rate = 0.04 / 12;
  while (bal < 100000 && m < 600) { bal = bal * (1 + rate) + 5000; m++; }
  const expected = `${Math.floor(m / 12) > 0 ? Math.floor(m / 12) + 'y ' : ''}${m % 12}m`;
  return (c.resValue || '').trim() === expected ? pass(`time to goal ${expected} (${m} months)`) : fail(`expected res-value "${expected}"`, `got "${c.resValue}"`); } };
T.bmi = { inputs: { bH: 170, bW: 70 }, check: (c) => approx(num(c.resValue), 70 / 1.7 / 1.7, 0.01, 'res-value') };
T.age = { inputs: { aD: '2000-01-15' }, check: (c) => {
  const now = new Date(), d = new Date('2000-01-15');
  let y = now.getFullYear() - d.getFullYear(), mo = now.getMonth() - d.getMonth(), da = now.getDate() - d.getDate();
  if (da < 0) { mo--; da += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
  if (mo < 0) { y--; mo += 12; }
  return (c.resValue || '').trim() === `${y} yrs` ? pass(`${y} yrs, ${mo} mo, ${da} d`) : fail(`expected "${y} yrs"`, `got "${c.resValue}"`); } };
T.preg = { inputs: { prD: '2026-01-01', prC: 28 }, check: (c) => {
  const edd = new Date('2026-01-01'); edd.setDate(edd.getDate() + 280);
  return (c.resValue || '').trim() === edd.toDateString() ? pass(`EDD ${edd.toDateString()}`) : fail(`expected "${edd.toDateString()}"`, `got "${c.resValue}"`); } };
T.calorie = { inputs: { clA: 30, clW: 70, clH: 170, clG: 'Male', clAc: 'Moderate (3-5 days/wk)' }, check: (c) => eq(num(c.resValue), Math.round((10 * 70 + 6.25 * 170 - 5 * 30 + 5) * 1.55), 'res-value') };
T.bodyfat = { inputs: { bfG: 'Male', bfH: 175, bfW: 85, bfN: 38, bfHp: 95 }, check: (c) => {
  const bf = 495 / (1.0324 - 0.19077 * Math.log10(85 - 38) + 0.15456 * Math.log10(175)) - 450;
  return approx(num(c.resValue), bf, 0.05, 'res-value'); } };
T.wtr = { inputs: { wtrW: 70, wtrA: 'Moderately Active (3–5 days/wk)', wtrC: 'Temperate / Normal' }, check: (c) => {
  const h = c.custom('res-wtr') || '';
  return h.includes('2.5 L') && h.includes('2520 ml') ? pass('2.5 L / 2520 ml') : fail('expected "2.5 L" and "2520 ml"', stripTags(h).slice(0, 200)); } };
T.sleep = { cases: [
  { inputs: { sleepMode: 'I want to wake at…', sleepTime: '07:00' }, check: (c) => {
    const h = c.custom('res-sleep') || '';
    return h.includes('21:46') && h.includes('23:16') && h.includes('00:46')
      ? pass('wake 07:00 → sleep 21:46 (6c, best), 23:16 (5c), 00:46 (4c)')
      : fail('expected slots 21:46 / 23:16 / 00:46', stripTags(h).slice(0, 300)); } },
  { inputs: { sleepMode: 'I want to sleep at…', sleepTime: '22:00' }, check: (c) => {
    const h = c.custom('res-sleep') || '';
    return h.includes('04:14') && h.includes('05:44') && h.includes('07:14')
      ? pass('sleep 22:00 → wake 04:14 (4c), 05:44 (5c), 07:14 (6c, best)')
      : fail('expected slots 04:14 / 05:44 / 07:14', stripTags(h).slice(0, 300)); } },
]};
T.heartrate = { inputs: { hrAge: 30, hrRest: 60 }, check: (c) => {
  const d = stripTags(c.resDetails);
  return (c.resValue || '').includes('190') && d.includes('125-138')
    ? pass('max 190 bpm, Zone 1 125-138') : fail('expected max 190 + zone 125-138', `${c.resValue} | ${d.slice(0, 200)}`); } };
T.cgpa = { inputs: { cgS1: 8, cgS2: 9, cgS3: 7, cgS4: 8 }, check: (c) => eq(num(c.resValue), 8, 'res-value') };
T.grade = { inputs: { grM: 85, grT: 100 }, check: (c) => (c.resValue || '').trim() === 'A' ? pass('grade A, 85%') : fail('expected grade A', `got "${c.resValue}"`) };
T.matrix = { inputs: { ma00: 1, ma01: 2, ma10: 3, ma11: 4, mb00: 5, mb01: 6, mb10: 7, mb11: 8 }, invoke: (sbx) => {
    vm.runInContext('window.__matOp="add"; runToolCalc();', sbx);
    const add = sbx.__getEl('matResult').textContent;
    vm.runInContext('window.__matOp="mul"; runToolCalc();', sbx);
    const mul = sbx.__getEl('matResult').textContent;
    return { add, mul }; }, check: (c, extra) => {
    const okAdd = extra.add.includes('[6, 8]') && extra.add.includes('[10, 12]');
    const okMul = extra.mul.includes('[19, 22]') && extra.mul.includes('[43, 50]');
    return okAdd && okMul ? pass('add [6,8]/[10,12]; mul [19,22]/[43,50]') : fail('add/mul mismatch', `add=${extra.add} mul=${extra.mul}`); } };
T.pomo = { inputs: { pomMode: 'Pomodoro (25 min)' }, check: (c, extra, sbx) => {
    const st = sbx.__getEl('pomStatus').textContent;
    const running = vm.runInContext('pomRunning', sbx);
    return running === true && st.includes('Focus')
      ? pass('pomStart → running, status "🎯 Focus!" (1s ticking needs browser)')
      : fail('expected pomRunning=true + Focus status', `running=${running} status="${st}"`); } };
T.attend = { inputs: { attTotal: 100, attAttended: 80, attReq: 75 }, check: (c) => {
    const d = stripTags(c.resDetails);
    return (c.resValue || '').includes('80.0%') && d.includes('Can miss: 6')
      ? pass('80.0%, SAFE, can miss 6') : fail('expected 80.0% + Can miss: 6', `${c.resValue} | ${d.slice(0, 200)}`); } };
T.date = { inputs: { dd1: '2026-01-01', dd2: '2026-02-01' }, check: (c) => eq(num(c.resValue), 31, 'res-value (days)') };
T.tzc = { inputs: { tzTime: '2026-11-21T12:00', tzFrom: 'UTC+0', tzTo: 'UTC+5:30' }, check: (c) => {
    const ms = new Date('2026-11-21T12:00').getTime();
    const expected = new Date(ms + 5.5 * 3600000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const h = c.custom('res-tzc') || '';
    return h.includes(expected) ? pass(`UTC+0 12:00 → UTC+5:30 ${expected}`) : fail(`expected time "${expected}"`, stripTags(h).slice(0, 200)); } };
T.worldclock = { inputs: { wcCity: 'Asia/Kolkata' }, invoke: (sbx) => { vm.runInContext('updateWorldClock();', sbx); return {}; },
  check: (c, extra, sbx) => {
    const rows = sbx.__wcTimes;
    if (!rows.length) return fail('no .wc-time rows in page', '');
    const bad = [];
    for (const el of rows) {
      const tz = el._attrs['data-tz'];
      const expected = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: tz }).format(new Date());
      const parse = (s) => { const p = s.split(':').map(Number); return p[0] * 3600 + p[1] * 60 + p[2]; };
      if (!/^\d{2}:\d{2}:\d{2}$/.test(el.textContent || '') || Math.abs(parse(el.textContent) - parse(expected)) > 2) bad.push(`${tz}: got "${el.textContent}" expected ~"${expected}"`);
    }
    return bad.length ? fail(`${bad.length} rows wrong`, bad.join('; ')) : pass(`${rows.length} rows show live Intl time (±2s)`); } };
T.elec = { inputs: { elU: 200, elR: 6.5, elF: 50 }, check: (c) => eq(num(c.resValue), 1350, 'res-value') };
T.fuel = { inputs: { fuD: 300, fuM: 15, fuP: 105 }, check: (c) => eq(num(c.resValue), 2100, 'res-value') };
T.rng = { inputs: { rnA: 1, rnB: 100, rnC: 5 }, check: (c) => {
    const nums = (c.resValue || '').split(',').map(s => parseInt(s.trim(), 10));
    const ok = nums.length === 5 && nums.every(n => n >= 1 && n <= 100);
    return ok ? pass(`5 numbers in [1,100]: ${c.resValue}`) : fail('expected 5 numbers in [1,100]', `got "${c.resValue}"`); } };
T.pwd = { inputs: { pwdLen: 16, pwUC: { checked: true }, pwLC: { checked: true }, pwNM: { checked: true }, pwSP: { checked: true } }, check: (c, extra, sbx) => {
    const out = sbx.__getEl('pwdOut').textContent || '';
    const allowed = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    const ok = out.length === 16 && [...out].every(ch => allowed.includes(ch));
    const w = sbx.__getEl('pwStr').style.width;
    return ok && w === '100%' ? pass('16 chars from full set, strength 100%') : fail('password property check', `out="${out}" width="${w}"`); } };
T.conv = { inputs: { tp1: 1, tp2: 'km', tp3: 'm' }, invoke: (sbx) => {
    vm.runInContext("tpM='len'; doTP();", sbx);
    const len = sbx.__getEl('tpO').textContent;
    vm.runInContext("tpM='tmp';", sbx);
    sbx.__getEl('tp1').value = '100'; sbx.__getEl('tp2').value = '°C'; sbx.__getEl('tp3').value = '°F';
    vm.runInContext('doTP();', sbx);
    const tmp = sbx.__getEl('tpO').textContent;
    return { len, tmp }; }, check: (c, extra) => {
    const ok = (extra.len || '').trim() === '1000 m' && (extra.tmp || '').trim() === '212 °F';
    return ok ? pass('1 km = 1000 m; 100°C = 212°F') : fail('conversion mismatch', `len="${extra.len}" tmp="${extra.tmp}"`); } };
T.graph = { inputs: { graphFn: 'x*x' }, check: (c, extra, sbx) => {
    const info = sbx.__getEl('graphInfo').textContent || '';
    const m = info.match(/(\d+) points plotted/);
    return m && parseInt(m[1], 10) > 0 ? pass(`f(x)=x*x, ${m[1]} points plotted`) : fail('expected ">0 points plotted"', info); } };
T.tip = { cases: [
  { inputs: { tipB: 1000, tipP: 15, tipS: 2 }, check: (c) => eq(num(c.resValue), 150, 'res-value') },
  { inputs: { tipB: 1000, tipP: 0, tipS: 2 }, check: (c) => eq(num(c.resValue), 0, 'res-value (0% tip)') },
]};
T.qr = { inputs: { qr22Input: 'https://example.com', qr22Color: '#000000', qr22Bg: '#ffffff', qr22Size: '300' }, check: (c, extra, sbx) => {
    const src = sbx.__getEl('qr22Img').src || '';
    const ok = src.startsWith('https://api.qrserver.com/v1/create-qr-code/') && src.includes('data=https%3A%2F%2Fexample.com') && src.includes('size=300x300');
    return ok ? pass('api.qrserver.com URL built with encoded text, 300x300 (image load needs internet)') : fail('QR URL wrong', src); } };
T.qrscan = { needsBrowser: 'Camera + BarcodeDetector/file-upload path — no DOM-runnable core; startQRScan returns early without navigator.mediaDevices.' };
T.speed = { inputs: { spSpeed: '', spDist: 120, spTime: 2, spUnit: 'km' }, invoke: (sbx) => {
    vm.runInContext('runToolCalc();', sbx);
    const sdt = sbx.__getEl('res-speed').innerHTML;
    vm.runInContext("_speedMode='pace';", sbx);
    sbx.__getEl('paceRace').value = '10'; sbx.__getEl('paceTime').value = '00:50:00';
    vm.runInContext('runToolCalc();', sbx);
    const pace = sbx.__getEl('res-speed').innerHTML;
    return { sdt, pace }; }, check: (c, extra) => {
    const okS = stripTags(extra.sdt).includes('Speed = 60.00 km/h');
    const okP = stripTags(extra.pace).includes('5:00 /km');
    return okS && okP ? pass('SDT: 120 km / 2 h = 60.00 km/h; Pace: 10 km in 50:00 = 5:00 /km') : fail('speed mismatch', `sdt=${stripTags(extra.sdt).slice(0, 150)} pace=${stripTags(extra.pace).slice(0, 150)}`); } };
T.unitprice = { inputs: { upPrice1: 100, upQty1: 1, upUnit1: 'kg', upPrice2: 180, upQty2: 2, upUnit2: 'kg' }, check: (c) => {
    const txt = stripTags(c.custom('unitpriceRes'));
    return txt.includes('Product B') && txt.includes('10.000') ? pass('B wins ₹90/kg vs ₹100/kg, saves ₹10.000') : fail('expected Product B + 10.000', txt.slice(0, 250)); } };
T.stats = { inputs: { statsInp: '1,2,3,4,5' }, check: (c) => {
    const h = c.custom('res-stats') || '';
    const ok = h.includes('3.000') && h.includes('2.000') && h.includes('1.414');
    return ok ? pass('mean 3.000, median 3, mode None, range 4, variance 2.000, stddev 1.414') : fail('stats mismatch', stripTags(h).slice(0, 300)); } };
T.split19 = { inputs: { v19SplitTotal: 1000, v19SplitPeople: 4, v19SplitTip: 10 }, check: (c) => {
    const h = c.custom('v19SplitRes') || '';
    return h.includes('₹275.00') ? pass('each pays ₹275.00') : fail('expected ₹275.00', stripTags(h).slice(0, 200)); } };
T.area = { cases: [
  { inputs: { arS: 'Rectangle', arA: 10, arB: 5 }, check: (c) => eq(num(c.resValue), 50, 'res-value') },
  { inputs: { arS: 'Trapezoid', arA: 10, arB: 6, arC: 4 }, check: (c) => eq(num(c.resValue), 32, 'res-value (trapezoid 0.5*(10+6)*4)') },
]};
T.numera = { inputs: { numDob: '1990-01-01', numName: 'RAM' }, check: (c) => {
    const txt = stripTags(c.custom('numeraRes'));
    return txt.includes('Life Path Number') && txt.includes('Name Number') && /\b3\b/.test(txt) && /\b7\b/.test(txt)
      ? pass('Life Path 3 (1990-01-01 → 21 → 3), Name 7 (RAM = 2+1+4)') : fail('numerology mismatch', txt.slice(0, 250)); } };
T.love = { inputs: { loveName1: 'Rahul', loveName2: 'Priya' }, check: (c) => {
    const txt = stripTags(c.custom('loveRes'));
    const expected = flames('Rahul', 'Priya');
    return txt.includes(expected) ? pass(`FLAMES = ${expected} (independently computed)`) : fail(`expected FLAMES "${expected}"`, txt.slice(0, 250)); } };
T.sci = { inputs: { sciExpr: '(45+15)*3-100/4' }, invoke: (sbx) => {
    vm.runInContext('runToolCalc();', sbx);
    const exprRes = sbx.__getEl('res-value').textContent;
    // keypad: (45+15)*3-100/4 = 155, with explicit brackets (matches the
    // content example). Unparenthesised entry follows JS precedence: 65.
    vm.runInContext("act('ac');", sbx);
    for (const [a, v] of [['ob', ''], ['num', '4'], ['num', '5'], ['add', ''], ['num', '1'], ['num', '5'], ['cb2', ''], ['mul', ''], ['num', '3'], ['sub', ''], ['num', '1'], ['num', '0'], ['num', '0'], ['div', ''], ['num', '4'], ['eq', '']]) {
      vm.runInContext(`act('${a}','${v}');`, sbx);
    }
    const keypadRes = sbx.__getEl('dNum').textContent;
    vm.runInContext("act('ac');", sbx);
    for (const [a, v] of [['num', '4'], ['num', '5'], ['add', ''], ['num', '1'], ['num', '5'], ['mul', ''], ['num', '3'], ['sub', ''], ['num', '1'], ['num', '0'], ['num', '0'], ['div', ''], ['num', '4'], ['eq', '']]) {
      vm.runInContext(`act('${a}','${v}');`, sbx);
    }
    const precedenceRes = sbx.__getEl('dNum').textContent;
    vm.runInContext("act('ac'); act('num','3'); act('num','0'); act('sin');", sbx);
    const sinRes = sbx.__getEl('dNum').textContent;
    return { exprRes, keypadRes, precedenceRes, sinRes }; }, check: (c, extra) => {
    const ok = num(extra.exprRes) === 155 && num(extra.keypadRes) === 155 && num(extra.precedenceRes) === 65 && Math.abs(num(extra.sinRes) - 0.5) < 1e-9;
    return ok ? pass('expr (45+15)*3-100/4 = 155; keypad bracketed = 155; keypad unparenthesised = 65 (JS precedence); sin(30°) = 0.5')
      : fail('BUG: bracketed keypad path must give 155 (expr field, unparenthesised keypad and sin all pass)', JSON.stringify(extra) + ' — see _verify/repro-sci-bracket.js; root cause: case cb2 sets cur=0 so fullE() becomes "(… )0"'); } };

/* ---------- helpers ---------- */
function pass(actual) { return { status: 'PASS', actual }; }
function fail(expected, actual) { return { status: 'FAIL', expected, actual }; }
function eq(actual, expected, what) {
  return actual === expected ? pass(`${what} = ${actual} (expected ${expected})`)
    : fail(`expected ${what} = ${expected}`, `got ${actual}`);
}
function approx(actual, expected, tol, what) {
  return Math.abs(actual - expected) <= tol ? pass(`${what} = ${actual} (expected ≈${expected.toFixed(4)})`)
    : fail(`expected ${what} ≈ ${expected.toFixed(4)} (±${tol})`, `got ${actual}`);
}

/* ---------- runner ---------- */
const rows = [];
let loadErrors = [];
for (const tool of tools.tools) {
  const def = T[tool.id];
  const pagePath = path.join(ROOT, 'calculators', tool.slug, 'index.html');
  const pageHtml = fs.readFileSync(pagePath, 'utf8');
  const baseInputs = {};
  for (const f of (tool.fields || [])) {
    if (f.default !== undefined) baseInputs[f.id] = f.default;
    else if (f.type === 'checkbox') baseInputs[f.id] = { checked: !!f.checked };
    else baseInputs[f.id] = '';
  }
  if (!def) { rows.push({ id: tool.id, slug: tool.slug, status: 'NEEDS-BROWSER', note: 'no test definition' }); continue; }
  if (def.needsBrowser) { rows.push({ id: tool.id, slug: tool.slug, status: 'NEEDS-BROWSER', note: def.needsBrowser, inputs: '(n/a — camera/device)' }); continue; }
  const cases = def.cases || [{ inputs: def.inputs, check: def.check }];
  const caseResults = [];
  for (const cs of cases) {
    try {
      const sbx = buildContext(pageHtml, { ...baseInputs, ...cs.inputs });
      runPage(sbx, pageHtml);
      let extra = {};
      if (def.invoke) extra = def.invoke(sbx) || {};
      else vm.runInContext('runToolCalc();', sbx);
      const cap = capture(sbx, tool.id);
      caseResults.push(cs.check(cap, extra, sbx));
    } catch (e) {
      caseResults.push({ status: 'FAIL', expected: 'no exception', actual: `EXCEPTION: ${e.message}\n${(e.stack || '').split('\n').slice(0, 3).join(' | ')}` });
    }
  }
  const allPass = caseResults.every(r => r.status === 'PASS');
  rows.push({
    id: tool.id, slug: tool.slug,
    status: allPass ? 'PASS' : 'FAIL',
    inputs: JSON.stringify(def.cases ? def.cases.map(c => c.inputs) : def.inputs),
    expected: caseResults.map(r => r.status === 'PASS' ? r.actual : r.expected).join(' || '),
    actual: caseResults.map(r => r.status === 'PASS' ? r.actual : r.actual).join(' || '),
    note: def.cases ? `${cases.length} sub-cases` : '',
  });
}

const counts = { PASS: 0, FAIL: 0, 'NEEDS-BROWSER': 0 };
for (const r of rows) counts[r.status]++;
fs.writeFileSync(path.join(__dirname, 'calc-results.json'), JSON.stringify({ counts, rows }, null, 2));
console.log(`\nPASS=${counts.PASS} FAIL=${counts.FAIL} NEEDS-BROWSER=${counts['NEEDS-BROWSER']} (total ${rows.length})`);
for (const r of rows) {
  console.log(`${r.status.padEnd(13)} ${r.id.padEnd(12)} ${r.slug}`);
  if (r.status !== 'PASS') console.log(`    inputs: ${r.inputs}\n    expected: ${r.expected}\n    actual: ${r.actual}`);
}
