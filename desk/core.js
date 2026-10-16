// Proposeroo Desk core: pure, framework-free logic. Works in browser and Node. Built from scratch.
export const KEY = 'prd:v1';
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const num = x => (typeof x === 'number' && isFinite(x)) ? x : (parseFloat(x) || 0);
export const cents = x => Math.round(num(x) * 100);

export function emptyState() {
  return { v: 1, settings: { business: 'Your Business', email: '', address: '', currency: 'USD', taxPct: 0, nextQuote: 1, nextInvoice: 1 },
    clients: [], projects: [], entries: [], quotes: [], invoices: [], timer: null };
}
export function load(storage) {
  try { const s = JSON.parse(storage.getItem(KEY)); return validate(s) ? s : emptyState(); } catch { return emptyState(); }
}
export function save(storage, s) { storage.setItem(KEY, JSON.stringify(s)); }
export function validate(s) {
  return !!s && s.v === 1 && ['clients', 'projects', 'entries', 'quotes', 'invoices'].every(k => Array.isArray(s[k])) && typeof s.settings === 'object';
}

export function addClient(s, c) { const x = { id: uid(), name: String(c.name || '').trim() || 'Client', email: c.email || '', address: c.address || '' }; s.clients.push(x); return x; }
export function addProject(s, p) {
  if (!s.clients.some(c => c.id === p.clientId)) throw new Error('Unknown client');
  const x = { id: uid(), clientId: p.clientId, name: String(p.name || '').trim() || 'Project', rate: num(p.rate), archived: false }; s.projects.push(x); return x;
}
export function addEntry(s, e) {
  const minutes = Math.round(num(e.minutes));
  if (minutes <= 0) throw new Error('Minutes must be > 0');
  if (!s.projects.some(p => p.id === e.projectId)) throw new Error('Unknown project');
  const x = { id: uid(), projectId: e.projectId, date: e.date || today(), minutes, note: e.note || '', billable: e.billable !== false, invoiceId: null };
  s.entries.push(x); return x;
}
export function updateEntry(s, id, patch) {
  const e = s.entries.find(x => x.id === id); if (!e) throw new Error('Unknown entry');
  if (e.invoiceId) throw new Error('Entry is already invoiced');
  if (patch.minutes != null && Math.round(num(patch.minutes)) <= 0) throw new Error('Minutes must be > 0');
  Object.assign(e, patch, patch.minutes != null ? { minutes: Math.round(num(patch.minutes)) } : {}); return e;
}
export function deleteEntry(s, id) {
  const e = s.entries.find(x => x.id === id); if (e && e.invoiceId) throw new Error('Entry is already invoiced');
  s.entries = s.entries.filter(x => x.id !== id);
}
export function today(d = new Date()) { return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }

// Timer
export function startTimer(s, projectId, note = '', now = Date.now()) {
  if (s.timer) throw new Error('A timer is already running');
  if (!s.projects.some(p => p.id === projectId)) throw new Error('Unknown project');
  s.timer = { projectId, note, startedAt: now }; return s.timer;
}
export function timerElapsed(s, now = Date.now()) { return s.timer ? Math.max(0, now - s.timer.startedAt) : 0; }
export function stopTimer(s, now = Date.now()) {
  if (!s.timer) throw new Error('No timer running');
  const minutes = Math.max(1, Math.ceil(timerElapsed(s, now) / 60000));
  const t = s.timer; s.timer = null;
  return addEntry(s, { projectId: t.projectId, note: t.note, minutes, date: today(new Date(t.startedAt)) });
}

// Totals (integer cents)
export function lineCents(it) { return Math.round(num(it.qty) * cents(it.price)); }
export function totals(doc) {
  const sub = (doc.items || []).reduce((a, it) => a + lineCents(it), 0);
  const tax = Math.round(sub * num(doc.taxPct) / 100);
  return { subtotal: sub / 100, tax: tax / 100, total: (sub + tax) / 100 };
}
const pad = n => String(n).padStart(4, '0');

export function unbilled(s, clientId, from = '0000-00-00', to = '9999-99-99') {
  const pids = new Set(s.projects.filter(p => p.clientId === clientId).map(p => p.id));
  return s.entries.filter(e => pids.has(e.projectId) && e.billable && !e.invoiceId && e.date >= from && e.date <= to);
}
export function invoiceFromTime(s, { clientId, from, to, date = today(), dueDays = 14, taxPct }) {
  const es = unbilled(s, clientId, from, to);
  if (!es.length) throw new Error('No unbilled time for this client and range');
  const items = s.projects.filter(p => p.clientId === clientId).map(p => {
    const mine = es.filter(e => e.projectId === p.id); if (!mine.length) return null;
    const hours = Math.round(mine.reduce((a, e) => a + e.minutes, 0) / 60 * 100) / 100;
    return { desc: `${p.name}: ${hours} h${from || to ? ` (${from || '…'} to ${to || '…'})` : ''}`, qty: hours, price: p.rate, entryIds: mine.map(e => e.id) };
  }).filter(Boolean);
  const inv = makeInvoice(s, { clientId, date, dueDays, items, taxPct });
  es.forEach(e => { e.invoiceId = inv.id; });
  return inv;
}
export function makeInvoice(s, { clientId, date = today(), dueDays = 14, items = [], taxPct, notes = '' }) {
  if (!s.clients.some(c => c.id === clientId)) throw new Error('Unknown client');
  const due = today(new Date(new Date(date + 'T12:00:00').getTime() + dueDays * 864e5));
  const inv = { id: uid(), number: 'INV-' + pad(s.settings.nextInvoice++), clientId, date, due, items, taxPct: taxPct ?? s.settings.taxPct, notes, status: 'unpaid', paidAt: null };
  s.invoices.push(inv); return inv;
}
export function makeQuote(s, { clientId, date = today(), items = [], taxPct, notes = '' }) {
  if (!s.clients.some(c => c.id === clientId)) throw new Error('Unknown client');
  const q = { id: uid(), number: 'Q-' + pad(s.settings.nextQuote++), clientId, date, items, taxPct: taxPct ?? s.settings.taxPct, notes, status: 'draft' };
  s.quotes.push(q); return q;
}
export function invoiceFromQuote(s, quoteId, opts = {}) {
  const q = s.quotes.find(x => x.id === quoteId); if (!q) throw new Error('Unknown quote');
  q.status = 'accepted';
  return makeInvoice(s, { clientId: q.clientId, items: q.items.map(i => ({ desc: i.desc, qty: i.qty, price: i.price })), taxPct: q.taxPct, notes: q.notes, ...opts });
}
export function setPaid(s, id, paid, when = today()) {
  const inv = s.invoices.find(x => x.id === id); if (!inv) throw new Error('Unknown invoice');
  inv.status = paid ? 'paid' : 'unpaid'; inv.paidAt = paid ? when : null; return inv;
}
export function isOverdue(inv, on = today()) { return inv.status === 'unpaid' && inv.due < on; }
export function deleteInvoice(s, id) {
  s.entries.forEach(e => { if (e.invoiceId === id) e.invoiceId = null; });
  s.invoices = s.invoices.filter(x => x.id !== id);
}

// Export / import
const csvCell = v => { const t = String(v ?? ''); return /[",\n\r]/.test(t) || /^[=+\-@]/.test(t) ? '"' + (/^[=+\-@]/.test(t) ? "'" : '') + t.replace(/"/g, '""') + '"' : t; };
export const toCSV = rows => rows.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
export function entriesCSV(s) {
  const P = Object.fromEntries(s.projects.map(p => [p.id, p])), C = Object.fromEntries(s.clients.map(c => [c.id, c]));
  return toCSV([['date', 'client', 'project', 'hours', 'minutes', 'note', 'billable', 'invoice'],
    ...s.entries.map(e => { const p = P[e.projectId] || {}; const inv = s.invoices.find(i => i.id === e.invoiceId);
      return [e.date, (C[p.clientId] || {}).name, p.name, (e.minutes / 60).toFixed(2), e.minutes, e.note, e.billable ? 'yes' : 'no', inv ? inv.number : '']; })]);
}
export function invoicesCSV(s) {
  const C = Object.fromEntries(s.clients.map(c => [c.id, c]));
  return toCSV([['number', 'client', 'date', 'due', 'subtotal', 'tax', 'total', 'status', 'paid_at'],
    ...s.invoices.map(i => { const t = totals(i); return [i.number, (C[i.clientId] || {}).name, i.date, i.due, t.subtotal.toFixed(2), t.tax.toFixed(2), t.total.toFixed(2), i.status, i.paidAt || '']; })]);
}
export const exportJSON = s => JSON.stringify(s, null, 2);
export function importJSON(text) { const s = JSON.parse(text); if (!validate(s)) throw new Error('Not a Proposeroo Desk backup'); return s; }
export function fmtMoney(v, currency = 'USD') { return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(num(v)); }
export function fmtDuration(ms) { const t = Math.floor(ms / 1000); return [Math.floor(t / 3600), Math.floor(t / 60) % 60, t % 60].map(x => String(x).padStart(2, '0')).join(':'); }
