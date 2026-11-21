// Minimal repro for the sci keypad ')' bug — reuses calc-harness.js internals.
const vm = require('vm'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const harness = fs.readFileSync(path.join(__dirname, 'calc-harness.js'), 'utf8');
const cut = harness.indexOf('/* ---------- runner ---------- */');
eval(harness.slice(0, cut));
const pageHtml = fs.readFileSync(path.join(ROOT, 'calculators', 'scientific-calculator', 'index.html'), 'utf8');
function seq(sbx, steps) { for (const [a, v] of steps) vm.runInContext(`act('${a}','${v}');`, sbx); return sbx.__getEl('dNum').textContent; }
function fresh() { const sbx = buildContext(pageHtml, {}); runPage(sbx, pageHtml); return sbx; }
let sbx = fresh();
console.log('(2+3)=        keypad ->', JSON.stringify(seq(sbx, [['ob', ''], ['num', '2'], ['add', ''], ['num', '3'], ['cb2', ''], ['eq', '']])));
sbx = fresh();
console.log('(2+3)*4=      keypad ->', JSON.stringify(seq(sbx, [['ob', ''], ['num', '2'], ['add', ''], ['num', '3'], ['cb2', ''], ['mul', ''], ['num', '4'], ['eq', '']])));
sbx = fresh();
console.log('2+3= (no br)  keypad ->', JSON.stringify(seq(sbx, [['num', '2'], ['add', ''], ['num', '3'], ['eq', '']])));
sbx = fresh();
console.log('(45+15)*3-100/4 keypad ->', JSON.stringify(seq(sbx, [['ob', ''], ['num', '4'], ['num', '5'], ['add', ''], ['num', '1'], ['num', '5'], ['cb2', ''], ['mul', ''], ['num', '3'], ['sub', ''], ['num', '1'], ['num', '0'], ['num', '0'], ['div', ''], ['num', '4'], ['eq', '']])));
sbx = fresh();
vm.runInContext("document.getElementById('sciExpr').value='(45+15)*3-100/4'; runToolCalc();", sbx);
console.log('(45+15)*3-100/4 expr field ->', JSON.stringify(sbx.__getEl('res-value').textContent));
// show the corrupt expression the keypad builds
sbx = fresh();
vm.runInContext("act('ob');act('num','2');act('add');act('num','3');act('cb2');", sbx);
console.log('after (2+3) keypad, dExpr shows:', JSON.stringify(sbx.__getEl('dExpr').textContent), '| dNum:', JSON.stringify(sbx.__getEl('dNum').textContent));
