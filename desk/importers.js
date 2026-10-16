// Proposeroo Desk importers: Harvest time export + generic time CSV (Toggl/Clockify-style headers).
// Clean-room: based on publicly documented CSV column names only.
import { addClient, addProject, addEntry } from './core.js';

export function parseCSV(text) {
  const rows = []; let row = [], f = '', q = false, i = 0; text = String(text).replace(/^\uFEFF/, '');
  for (; i < text.length; i++) { const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += c; }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim() !== ''));
}
const norm = h => h.toLowerCase().replace(/[^a-z0-9]/g, '');
const ALIASES = {
  date: ['date', 'startdate', 'spentdate', 'day'],
  client: ['client', 'clientname', 'customer'],
  project: ['project', 'projectname'],
  task: ['task', 'taskname'],
  note: ['notes', 'note', 'description', 'comment'],
  hours: ['hours', 'durationdecimal', 'timeh', 'decimalhours', 'durationh'],
  duration: ['duration', 'time', 'durationhhmmss'],
  billable: ['billable', 'billable?', 'isbillable'],
  invoiced: ['invoiced', 'invoiced?'],
  rate: ['billablerate', 'rate', 'hourlyrate', 'billableratesusd'],
};
export function detect(header) {
  const n = header.map(norm), map = {};
  for (const [k, al] of Object.entries(ALIASES)) { const i = n.findIndex(h => al.map(norm).includes(h)); if (i >= 0) map[k] = i; }
  const format = ['hoursrounded', 'billableamount', 'projectcode'].some(h => n.includes(h)) ? 'harvest' : 'generic';
  return { map, format };
}
export function toDate(v) {
  v = String(v || '').trim(); let m;
  if ((m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  if ((m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/))) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`; } // US M/D/Y
  if ((m = v.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/))) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; // D.M.Y
  return null;
}
export function toMinutes(hours, duration) {
  if (hours != null && String(hours).trim() !== '') { const h = parseFloat(String(hours).replace(',', '.')); if (isFinite(h)) return Math.round(h * 60); }
  const m = String(duration || '').trim().match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
  if (m) return Math.round(+m[1] * 60 + +m[2] + (+(m[3] || 0)) / 60);
  return NaN;
}
const yes = v => /^(yes|true|1|y)$/i.test(String(v || '').trim());

// Returns a preview (no state change). Then applyImport() writes it.
export function previewImport(text) {
  const rows = parseCSV(text); if (rows.length < 2) throw new Error('The file has no data rows');
  const { map, format } = detect(rows[0]);
  if (map.date == null || map.project == null || (map.hours == null && map.duration == null)) throw new Error('Could not find Date, Project and Hours/Duration columns');
  const items = [], errors = [];
  rows.slice(1).forEach((r, i) => { const g = k => map[k] == null ? '' : (r[map[k]] ?? '').trim();
    const date = toDate(g('date')), minutes = toMinutes(g('hours'), g('duration'));
    if (!date || !(minutes > 0)) { errors.push(`Row ${i + 2}: bad date or hours`); return; }
    const invoiced = yes(g('invoiced'));
    items.push({ date, minutes, client: g('client') || 'Imported client', project: g('project') || 'Imported project',
      note: [g('task'), g('note')].filter(Boolean).join(': ') + (invoiced ? ' [already invoiced]' : ''),
      billable: map.billable == null ? true : yes(g('billable')), invoiced, rate: parseFloat(g('rate')) || 0 }); });
  return { format, items, errors, totalMinutes: items.reduce((a, x) => a + x.minutes, 0) };
}
export function applyImport(s, preview) {
  let created = { clients: 0, projects: 0, entries: 0 };
  for (const it of preview.items) {
    let c = s.clients.find(x => x.name.toLowerCase() === it.client.toLowerCase());
    if (!c) { c = addClient(s, { name: it.client }); created.clients++; }
    let p = s.projects.find(x => x.clientId === c.id && x.name.toLowerCase() === it.project.toLowerCase());
    if (!p) { p = addProject(s, { clientId: c.id, name: it.project, rate: it.rate }); created.projects++; }
    else if (!p.rate && it.rate) p.rate = it.rate;
    addEntry(s, { projectId: p.id, date: it.date, minutes: it.minutes, note: it.note, billable: it.billable && !it.invoiced }); created.entries++;
  }
  return created;
}
