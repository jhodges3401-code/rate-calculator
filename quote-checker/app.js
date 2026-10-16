import { floorRate, check } from './check.js';
const $ = id => document.getElementById(id), KEY = 'quote-checker-v1';
const IDS = ['floor', 'income', 'expenses', 'tax', 'weeks', 'hpw', 'bill', 'price', 'hours', 'discountPct', 'feePct', 'costs', 'revisionsHours', 'contingencyPct'];
const m0 = n => isFinite(n) ? '$' + Math.round(n).toLocaleString('en-US') : '–', m2 = n => isFinite(n) ? '$' + n.toFixed(2) : '–';
let mode = 'known';
try { const s = JSON.parse(localStorage.getItem(KEY) || '{}'); IDS.forEach(k => { if (s[k] != null) $(k).value = s[k]; }); if (s.mode) mode = s.mode; } catch {}
const num = id => parseFloat($(id).value) || 0;
function setMode(m) { mode = m; document.querySelectorAll('.seg button').forEach(b => b.classList.toggle('on', b.dataset.mode === m)); $('mKnown').hidden = m !== 'known'; $('mCalc').hidden = m !== 'calc'; render(); }
const COPY = { healthy: ['Healthy quote', 'Comfortably above your floor. Send it.'], thin: ['Thin margin', 'Just above your floor. One extra revision round could put it under.'], below: ['Below your floor', 'At this price you earn less than your minimum. Raise it or cut scope.'], incomplete: ['Add your numbers', 'Enter a floor, a price and estimated hours.'] };
let last = '';
function render() {
  const floor = mode === 'known' ? num('floor') : floorRate({ income: num('income'), expenses: num('expenses'), tax: num('tax'), weeks: num('weeks'), hpw: num('hpw'), bill: num('bill') });
  $('oFloor').textContent = isFinite(floor) && floor > 0 ? m2(floor) + '/hr' : '–';
  const q = Object.fromEntries(['price', 'hours', 'discountPct', 'feePct', 'costs', 'revisionsHours', 'contingencyPct'].map(k => [k, num(k)]));
  const r = check(q, floor);
  $('verdict').className = 'verdict ' + r.verdict; $('vT').textContent = COPY[r.verdict][0]; $('vP').textContent = COPY[r.verdict][1];
  $('oEff').textContent = isFinite(r.effective) ? m2(r.effective) + '/hr' : '–';
  $('oVs').textContent = isFinite(r.ratio) ? `${r.ratio >= 1 ? '+' : ''}${Math.round((r.ratio - 1) * 100)}% vs your floor` : '';
  const max = Math.max(floor * 1.6 || 1, r.effective || 0); $('bar').style.width = Math.max(0, Math.min(100, (r.effective || 0) / max * 100)) + '%';
  $('bar').style.background = r.verdict === 'healthy' ? 'var(--ok)' : r.verdict === 'thin' ? 'var(--warn)' : 'var(--bad)';
  $('mark').style.left = Math.min(100, floor / max * 100) + '%'; $('markL').textContent = 'floor ' + (isFinite(floor) ? m2(floor) : '');
  $('tP').textContent = m0(q.price); $('tD').textContent = m0(r.afterDiscount); $('tF').textContent = '−' + m0(r.fees); $('tC').textContent = '−' + m0(q.costs);
  $('tN').textContent = m0(r.net); $('tH').textContent = isFinite(r.realHours) ? r.realHours.toFixed(1) + ' h' : '–';
  $('oMin').textContent = isFinite(r.minPrice) ? m0(Math.ceil(r.minPrice)) : '–';
  $('oMinP').textContent = isFinite(r.minPrice) ? (q.price >= r.minPrice ? `Your quote is ${m0(q.price - r.minPrice)} above it.` : `That's ${m0(r.minPrice - q.price)} more than your quote, with the same discount and fees.`) : '';
  $('tips').innerHTML = ''; r.tips.forEach(t => { const li = document.createElement('li'); li.textContent = t; $('tips').append(li); });
  last = `Quote check: ${m0(q.price)} for ~${q.hours} h → ${COPY[r.verdict][0]}. Real rate ${m2(r.effective)}/hr vs floor ${m2(floor)}/hr. Lowest price that clears the floor: ${m0(Math.ceil(r.minPrice))}. (Free Quote Checker by Orvian Market)`;
  try { localStorage.setItem(KEY, JSON.stringify({ ...Object.fromEntries(IDS.map(k => [k, $(k).value])), mode })); } catch {}
}
document.querySelectorAll('input').forEach(e => e.addEventListener('input', render));
document.querySelectorAll('.seg button').forEach(b => b.onclick = () => setMode(b.dataset.mode));
$('copy').onclick = async () => { try { await navigator.clipboard.writeText(last); $('copy').textContent = 'Copied!'; } catch { $('copy').textContent = 'Copy failed'; } setTimeout(() => $('copy').textContent = 'Copy summary', 1500); };
setMode(mode);
