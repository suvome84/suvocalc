/* SuvoCalc — shared calculator helpers (assets/js/calc.js)
 *
 * Ported from suvocalc_v30_fixed.html (v30 source). The calc bodies in
 * tools.json call these helpers exactly as the source did.
 *
 * ADAPTATIONS (deliberate, vs. the source):
 * 1. SYM(): the source reads the locale engine (`SC_GL.L.sym`, source
 *    L8383) so the symbol follows the user's currency setting. v31 has no
 *    locale engine in scope, so SYM() returns '₹' as specified for v31.
 *    (V30 calc bodies read `window.SC_GL.L.sym` directly with a '₹'
 *    fallback — see the extraction report — so they are unaffected.)
 * 2. setRes(): the source writes into the per-tool box `#res-<toolId>` and
 *    builds a rich result card (buildResCard), animates the number and
 *    injects per-tool charts/visuals (source L10284-10321). v31 uses one
 *    shared result section per tool page, so setRes() writes into
 *    #res-value / #res-label / #res-details and shows #res-box, as
 *    specified for v31. The source's guards are preserved verbatim in
 *    spirit: a NaN/undefined result shows "Invalid input", an Infinity
 *    result shows the division-by-zero message (source L10288-10295).
 *    The source's `₹`-for-locale substitution (L10297-10303) is skipped:
 *    SYM() is always '₹' in v31, so there is nothing to substitute.
 *    The source stored the result in `window._resStore` for copy/share;
 *    that store is kept (simplified: no _getInputs/_toolTitle/_now, which
 *    do not exist in v31 scope).
 * 3. showValError(): the source writes the message into the per-tool box
 *    `#res-<toolId>` (source L6957-6961). v31 uses the shared #res-error
 *    element, as specified for v31, and hides #res-box while an error is
 *    shown.
 * 4. isValidNum() / safeNum(): NOT in the v31 spec's named list, but they
 *    are included because the verbatim calc bodies in tools.json already
 *    call them (isValidNum: emi, sip, elec, stock, …; safeNum: lcomp).
 *    Both are copied verbatim from the source (L6949, L6946). Without
 *    them the verbatim bodies would throw ReferenceError. No other
 *    helpers are defined here.
 *
 * NOT in this file (the generator must ship them with the owning tool,
 * see the extraction report): v30ShowResult/v30Fmt (used by the nine V30
 * calc bodies instead of setRes), toast/trackTool/bumpStreak/
 * checkMilestone (called by a few handler bodies), and the per-tool
 * companion functions (e.g. renderTP/setTP/cvCfg for the converter,
 * safe() for the scientific calculator). No AI, no ads, no tracking.
 */

function getId(id){const el=document.getElementById(id);return el?el.value:'';}

function SYM(){return '₹';}

function fmt(n,sep=false){
  if(typeof n!=='number')return String(n);
  if(!isFinite(n))return n>0?'∞':'-∞';
  if(isNaN(n))return'Error';
  if(Math.abs(n)>=1e15||(Math.abs(n)<1e-9&&n!==0))return n.toExponential(6);
  const s=parseFloat(n.toPrecision(12)).toString();
  if(sep&&!s.includes('e')){const[i,d]=s.split('.');return parseInt(i).toLocaleString('en-IN')+(d?'.'+d:'');}
  return s;
}

function isValidNum(v){return typeof v==='number'&&isFinite(v)&&!isNaN(v);}

function safeNum(v){const n=parseFloat(v);return isNaN(n)?0:n;}

function setRes(toolId, value, label, detailsHtml){
  var valueEl=document.getElementById('res-value');
  var labelEl=document.getElementById('res-label');
  var detailsEl=document.getElementById('res-details');
  var boxEl=document.getElementById('res-box');
  var errEl=document.getElementById('res-error');
  var valueStr=String(value);
  if(valueStr.indexOf('NaN')!==-1||valueStr==='undefined'){
    if(errEl){errEl.textContent='Invalid input — please check values';errEl.style.display='';}
    if(boxEl)boxEl.style.display='none';
    return;
  }
  if(valueStr.indexOf('Infinity')!==-1){
    if(errEl){errEl.textContent='Division by zero — please check values';errEl.style.display='';}
    if(boxEl)boxEl.style.display='none';
    return;
  }
  if(errEl)errEl.style.display='none';
  if(valueEl)valueEl.textContent=valueStr;
  if(labelEl)labelEl.textContent=label||'';
  if(detailsEl)detailsEl.innerHTML=detailsHtml||'';
  if(boxEl)boxEl.style.display='';
  window._resStore=window._resStore||{};
  window._resStore[toolId]={id:toolId,num:value,lbl:label,sub:detailsHtml||'',time:new Date().toISOString()};
}

function showValError(toolId, msg){
  var errEl=document.getElementById('res-error');
  if(errEl){errEl.textContent=msg;errEl.style.display='';}
  var boxEl=document.getElementById('res-box');
  if(boxEl)boxEl.style.display='none';
}
