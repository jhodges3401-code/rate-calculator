import * as D from './core.js';
import * as I from './importers.js';
import * as L from './limits.js';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let S = D.load(localStorage);
const save = () => { D.save(localStorage, S); render(); };
const money = v => D.fmtMoney(v, S.settings.currency);
const C = id => S.clients.find(c => c.id === id) || {}, P = id => S.projects.find(p => p.id === id) || {};
const err = f => (...a) => { try { f(...a); } catch (e) { alert(e.message); } };

$$('.tabs button').forEach(b => b.onclick = () => { $$('.tabs button').forEach(x => x.classList.toggle('on', x === b)); $$('.tab').forEach(t => t.hidden = t.id !== b.dataset.tab); });

function projOpts() { const ps = S.projects.filter(p => !p.archived); return ps.length ? ps.map(p => `<option value="${p.id}">${esc(C(p.clientId).name)} · ${esc(p.name)}</option>`).join('') : '<option value="">Add a client and project first</option>'; }
function clientOpts() { return S.clients.length ? S.clients.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('') : '<option value="">Add a client first</option>'; }

function render() {
  const po = projOpts(), co = clientOpts();
  const keep = (sel, html) => { const el = $(sel), v = el.value; el.innerHTML = html; if ([...el.options].some(o => o.value === v)) el.value = v; };
  keep('#tProject', po); keep('#eForm [name=projectId]', po); keep('#iForm [name=clientId]', co); keep('#qForm [name=clientId]', co); keep('#pForm [name=clientId]', co);
  // timer
  $('#tBtn').textContent = S.timer ? 'Stop' : 'Start'; $('#tBtn').classList.toggle('stop', !!S.timer);
  if (S.timer) { $('#tProject').value = S.timer.projectId; $('#tNote').value = S.timer.note; }
  $('#tProject').disabled = $('#tNote').disabled = !!S.timer;
  // entries
  const es = [...S.entries].sort((a, b) => b.date.localeCompare(a.date));
  $('#entries').innerHTML = es.length ? `<table><thead><tr><th>Date</th><th>Client · Project</th><th>Note</th><th class=n>Hours</th><th>Status</th><th></th></tr></thead><tbody>${es.map(e => { const p = P(e.projectId), inv = S.invoices.find(i => i.id === e.invoiceId);
    return `<tr><td>${e.date}</td><td>${esc(C(p.clientId).name)} · ${esc(p.name)}</td><td>${esc(e.note)}</td><td class=n>${(e.minutes / 60).toFixed(2)}</td><td>${inv ? esc(inv.number) : e.billable ? 'Unbilled' : 'Non-billable'}</td><td>${inv ? '' : `<button class=link data-del-entry="${e.id}">Delete</button>`}</td></tr>`; }).join('')}</tbody></table>` : '<p class=muted>No time yet. Start the timer above or add time manually.</p>';
  // unbilled hint
  const cid = $('#iForm [name=clientId]').value; const ub = cid ? D.unbilled(S, cid) : [];
  $('#unbilledHint').textContent = cid ? `${ub.length} unbilled entr${ub.length === 1 ? 'y' : 'ies'} · ${(ub.reduce((a, e) => a + e.minutes, 0) / 60).toFixed(2)} h for ${C(cid).name}` : '';
  // invoices
  const inv = [...S.invoices].reverse();
  $('#invList').innerHTML = inv.length ? `<table><thead><tr><th>Number</th><th>Client</th><th>Date</th><th>Due</th><th class=n>Total</th><th>Status</th><th></th></tr></thead><tbody>${inv.map(i => { const st = i.status === 'paid' ? 'paid' : D.isOverdue(i) ? 'overdue' : 'unpaid';
    return `<tr><td>${esc(i.number)}</td><td>${esc(C(i.clientId).name)}</td><td>${i.date}</td><td>${i.due}</td><td class=n>${money(D.totals(i).total)}</td><td><span class="tag ${st}">${st}</span></td><td><button class=link data-view-inv="${i.id}">View / PDF</button><button class=link data-pay="${i.id}">${i.status === 'paid' ? 'Mark unpaid' : 'Mark paid'}</button><button class=link data-del-inv="${i.id}">Delete</button></td></tr>`; }).join('')}</tbody></table>` : '<p class=muted>No invoices yet.</p>';
  // quotes
  const qs = [...S.quotes].reverse();
  $('#qList').innerHTML = qs.length ? `<table><thead><tr><th>Number</th><th>Client</th><th>Date</th><th class=n>Total</th><th>Status</th><th></th></tr></thead><tbody>${qs.map(q => `<tr><td>${esc(q.number)}</td><td>${esc(C(q.clientId).name)}</td><td>${q.date}</td><td class=n>${money(D.totals(q).total)}</td><td>${esc(q.status)}</td><td><button class=link data-view-q="${q.id}">View / PDF</button>${q.status !== 'accepted' ? `<button class=link data-q2i="${q.id}">Turn into invoice</button>` : ''}</td></tr>`).join('')}</tbody></table>` : '<p class=muted>No quotes yet.</p>';
  // clients
  $('#cList').innerHTML = S.clients.length ? `<h2>Clients</h2><table><thead><tr><th>Client</th><th>Projects (rate/h)</th></tr></thead><tbody>${S.clients.map(c => `<tr><td><b>${esc(c.name)}</b><br><span class=muted>${esc(c.email)}</span></td><td>${S.projects.filter(p => p.clientId === c.id).map(p => `${esc(p.name)} (${money(p.rate)})`).join(', ') || '—'}</td></tr>`).join('')}</tbody></table>` : '';
  $('#planStatus').textContent = L.isPro(S) ? `${L.planLabel(S)} is active. Thank you!` : `${L.planLabel(S)}: all features, ${L.FREE_CLIENTS} client, a small footer on PDFs, and import preview. Export is always free.`;
  $('#lDeact').hidden = !L.isPro(S); $('#lForm').hidden = L.isPro(S); $('#lBuy').hidden = L.isPro(S);
  $('#clientGate').textContent = L.canAddClient(S) ? '' : `The free plan includes ${L.FREE_CLIENTS} client. Unlock Pro in Settings & data for unlimited clients.`;
  const f = $('#sForm'); ['business', 'email', 'address', 'currency', 'taxPct'].forEach(k => { if (document.activeElement !== f[k]) f[k].value = S.settings[k] ?? ''; });
}
$('#iForm [name=clientId]').onchange = render;

// timer
setInterval(() => { $('#tClock').textContent = D.fmtDuration(D.timerElapsed(S)); }, 500);
$('#tBtn').onclick = err(() => { if (S.timer) D.stopTimer(S); else { if (!$('#tProject').value) throw new Error('Add a client and project first'); D.startTimer(S, $('#tProject').value, $('#tNote').value); } save(); });

const fd = f => Object.fromEntries(new FormData(f));
$('#eForm').onsubmit = err(ev => { ev.preventDefault(); const d = fd(ev.target); D.addEntry(S, { projectId: d.projectId, date: d.date, minutes: Number(d.hours) * 60, note: d.note, billable: !!d.billable }); ev.target.hours.value = ''; ev.target.note.value = ''; save(); });
$('#eForm [name=date]').value = D.today();
$('#cForm').onsubmit = err(ev => { ev.preventDefault(); L.assertCanAddClient(S); D.addClient(S, fd(ev.target)); ev.target.reset(); save(); });
$('#pForm').onsubmit = err(ev => { ev.preventDefault(); D.addProject(S, fd(ev.target)); ev.target.name.value = ''; ev.target.rate.value = ''; save(); });
$('#iForm').onsubmit = err(ev => { ev.preventDefault(); const d = fd(ev.target); const inv = D.invoiceFromTime(S, { clientId: d.clientId, from: d.from || undefined, to: d.to || undefined, taxPct: d.taxPct === '' ? undefined : Number(d.taxPct) }); save(); showDoc('invoice', inv); });
$('#lForm').onsubmit = async ev => { ev.preventDefault(); try { const p = await L.activate(S, ev.target.key.value); ev.target.reset(); save(); alert(`${L.planLabel(S)} unlocked. Thank you for supporting Proposeroo Desk!`); } catch (e) { alert(e.message); } };
$('#lDeact').onclick = () => { if (confirm('Remove the license key from this browser?')) { L.deactivate(S); save(); } };
$('#sForm').onsubmit = err(ev => { ev.preventDefault(); const d = fd(ev.target); Object.assign(S.settings, d, { taxPct: Number(d.taxPct) || 0 }); save(); });

// quotes
const addLine = (it = {}) => { const r = document.createElement('div'); r.className = 'row qi'; r.innerHTML = `<input name=desc placeholder="Description" aria-label="Description" style="flex:1" value="${esc(it.desc)}"><input name=qty type=number step=0.01 min=0 placeholder="Qty" aria-label="Quantity" style="width:90px" value="${esc(it.qty ?? 1)}"><input name=price type=number step=0.01 min=0 placeholder="Price" aria-label="Price" style="width:120px" value="${esc(it.price)}"><button type=button class=link>Remove</button>`; r.querySelector('button').onclick = () => r.remove(); $('#qItems').append(r); };
addLine(); $('#qAdd').onclick = () => addLine();
$('#qForm').onsubmit = err(ev => { ev.preventDefault(); const items = $$('.qi').map(r => ({ desc: r.querySelector('[name=desc]').value, qty: Number(r.querySelector('[name=qty]').value), price: Number(r.querySelector('[name=price]').value) })).filter(i => i.desc && i.qty > 0);
  if (!items.length) throw new Error('Add at least one line item'); const t = ev.target.taxPct.value; const q = D.makeQuote(S, { clientId: ev.target.clientId.value, items, taxPct: t === '' ? undefined : Number(t) }); $('#qItems').innerHTML = ''; addLine(); save(); showDoc('quote', q); });

document.addEventListener('click', err(ev => { const b = ev.target.closest('button'); if (!b) return; const d = b.dataset;
  if (d.delEntry && confirm('Delete this entry?')) { D.deleteEntry(S, d.delEntry); save(); }
  if (d.viewInv) showDoc('invoice', S.invoices.find(i => i.id === d.viewInv));
  if (d.viewQ) showDoc('quote', S.quotes.find(q => q.id === d.viewQ));
  if (d.pay) { const i = S.invoices.find(x => x.id === d.pay); D.setPaid(S, i.id, i.status !== 'paid'); save(); }
  if (d.delInv && confirm('Delete this invoice? Its time entries become unbilled again.')) { D.deleteInvoice(S, d.delInv); save(); }
  if (d.q2i) { const inv = D.invoiceFromQuote(S, d.q2i); save(); showDoc('invoice', inv); }
}));

function showDoc(kind, x) {
  const c = C(x.clientId), t = D.totals(x), st = S.settings, isInv = kind === 'invoice';
  $('#doc').innerHTML = `<div class=actions><button class=b1 id=pdf>Download PDF / Print</button><button class=b2 id=closeDoc>Close</button></div>
  <article class=sheet><div class=top><div><h3>${isInv ? 'Invoice' : 'Quote'}</h3><p class=muted>${esc(x.number)}<br>Date: ${x.date}${isInv ? `<br>Due: ${x.due}` : ''}${isInv && x.status === 'paid' ? `<br><span class="tag paid">PAID ${x.paidAt}</span>` : ''}</p></div>
  <div style="text-align:right"><b>${esc(st.business)}</b><br>${esc(st.email)}<br>${esc(st.address)}</div></div>
  <p><span class=muted>${isInv ? 'Bill to' : 'Prepared for'}</span><br><b>${esc(c.name)}</b><br>${esc(c.email)}<br>${esc(c.address)}</p>
  <table><thead><tr><th>Description</th><th class=n>Qty</th><th class=n>Price</th><th class=n>Amount</th></tr></thead><tbody>${x.items.map(i => `<tr><td>${esc(i.desc)}</td><td class=n>${i.qty}</td><td class=n>${money(i.price)}</td><td class=n>${money(D.lineCents(i) / 100)}</td></tr>`).join('')}</tbody></table>
  <table class=tot><tr><td>Subtotal</td><td class=n>${money(t.subtotal)}</td></tr><tr><td>Tax (${x.taxPct || 0}%)</td><td class=n>${money(t.tax)}</td></tr><tr class=grand><td>Total</td><td class=n>${money(t.total)}</td></tr></table>
  ${x.notes ? `<p>${esc(x.notes)}</p>` : ''}<p class=muted style="margin-top:40px">Thank you for your business.</p>${L.pdfFooter(S) ? `<p class="muted wm" style="margin-top:24px;font-size:11px;text-align:center">${esc(L.pdfFooter(S))}</p>` : ''}</article>`;
  $('#doc').hidden = false; $('#pdf').onclick = () => window.print(); $('#closeDoc').onclick = () => { $('#doc').hidden = true; };
}
// data
const dl = (name, text, type) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
$('#xJson').onclick = () => dl(`proposeroo-desk-backup-${D.today()}.json`, D.exportJSON(S), 'application/json');
$('#xEntries').onclick = () => dl(`time-entries-${D.today()}.csv`, D.entriesCSV(S), 'text/csv');
$('#xInv').onclick = () => dl(`invoices-${D.today()}.csv`, D.invoicesCSV(S), 'text/csv');
$('#iJson').onchange = err(async ev => { const f = ev.target.files[0]; if (!f) return; const s = D.importJSON(await f.text()); if (confirm('Replace all data in this browser with this backup?')) { S = s; await L.recheck(S); save(); } ev.target.value = ''; });
$('#demo').onclick = err(() => { if ((S.clients.length || S.entries.length) && !confirm('Add sample data alongside your data?')) return;
  const c = D.addClient(S, { name: 'Sample Co (demo)', email: 'billing@example.com', address: '1 Example St' }); c.demo = true; const p = D.addProject(S, { clientId: c.id, name: 'Website refresh', rate: 85 }); const p2 = D.addProject(S, { clientId: c.id, name: 'Monthly SEO', rate: 60 });
  D.addEntry(S, { projectId: p.id, minutes: 150, note: 'Homepage layout', date: D.today() }); D.addEntry(S, { projectId: p.id, minutes: 95, note: 'Client revisions', date: D.today() }); D.addEntry(S, { projectId: p2.id, minutes: 60, note: 'Keyword report', date: D.today() });
  D.makeQuote(S, { clientId: c.id, items: [{ desc: 'Landing page design', qty: 1, price: 900 }, { desc: 'Copy edits (hours)', qty: 4, price: 85 }], taxPct: 0 }); save(); });
let PV = null;
$('#iCsv').onchange = err(async ev => { const f = ev.target.files[0]; if (!f) return; ev.target.value = '';
  PV = I.previewImport(await f.text());
  $('#impPrev').innerHTML = `<div class="card" style="background:#f8fafc"><b>${PV.items.length} entries · ${(PV.totalMinutes / 60).toFixed(2)} h</b> <span class=muted>(${PV.format === 'harvest' ? 'Harvest export' : 'CSV'}${PV.errors.length ? `, ${PV.errors.length} rows skipped` : ''})</span>
  <table><thead><tr><th>Date</th><th>Client · Project</th><th>Note</th><th class=n>Hours</th></tr></thead><tbody>${PV.items.slice(0, 8).map(x => `<tr><td>${x.date}</td><td>${esc(x.client)} · ${esc(x.project)}</td><td>${esc(x.note)}</td><td class=n>${(x.minutes / 60).toFixed(2)}</td></tr>`).join('')}</tbody></table>${PV.items.length > 8 ? `<p class=muted>…and ${PV.items.length - 8} more</p>` : ''}
  ${PV.errors.length ? `<p class=muted>${PV.errors.slice(0, 5).map(esc).join('<br>')}</p>` : ''}<div class=row style="margin-top:10px">${L.canImport(S) ? `<button class=b1 id=impGo>Import ${PV.items.length} entries</button>` : `<span class=muted id=impGate>Importing is part of Pro. Unlock it below to bring these entries in.</span>`}<button class=b2 id=impCancel>Cancel</button></div></div>`;
  if ($('#impGo')) $('#impGo').onclick = err(() => { const r = I.applyImport(S, PV); PV = null; $('#impPrev').innerHTML = `<p class=muted>Imported ${r.entries} entries (${r.clients} new clients, ${r.projects} new projects). Invoiced rows were added as non-billable.</p>`; save(); });
  $('#impCancel').onclick = () => { PV = null; $('#impPrev').innerHTML = ''; }; });
// Buy buttons: one place to swap (L.BUY_URL). Until the Gumroad product exists they explain instead of linking nowhere.
$$('[data-buy]').forEach(a => { if (L.BUY_URL) { a.href = L.BUY_URL; a.target = '_blank'; a.rel = 'noopener'; } else { a.removeAttribute('target'); a.onclick = ev => { ev.preventDefault(); alert('Pro checkout opens soon. Everything in the free plan works today, and your data will carry over when you unlock Pro.'); }; } });
render();
L.recheck(S).then(p => { D.save(localStorage, S); render(); });
