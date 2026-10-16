// Plans and limits. License keys are ECDSA P-256 signed codes verified offline with the
// public key below: no accounts, no network calls. Export and backup are always free.
export const FREE_CLIENTS = 1;
// Swap this one line once the Gumroad product exists (e.g. 'https://jhodges6.gumroad.com/l/xxxx').
export const BUY_URL = 'https://jhodges6.gumroad.com/l/proposeroo-desk';
export const TEAM_URL = 'https://jhodges6.gumroad.com/l/proposeroo-desk-team';
const PUB = { kty: 'EC', crv: 'P-256', x: 'IC7WUotFz8aOs1U2-GAC1H2CqVJ8k7ckGJgH9WbBQsM', y: 'maGUdPDD8FEl30c76BsboEw5XreUrANAuI_m74S_UGY' };
const PLANS = { PRO: 'pro', TEAM: 'team' };
const norm = k => String(k || '').replace(/\s+/g, '');
const b64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - s.length % 4) % 4)), c => c.charCodeAt(0));
let pubKey;
// pub is only overridden by tests (they sign with a throwaway key so no sellable key is ever committed).
export async function verifyKey(key, pub) {
  const m = /^PD1-(PRO|TEAM)-([A-Z2-9]{8})-([A-Za-z0-9_-]{80,90})$/i.exec(norm(key)); if (!m) return null;
  const plan = PLANS[m[1].toUpperCase()], id = m[2].toUpperCase();
  try {
    const k = pub ? await crypto.subtle.importKey('jwk', pub, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']) : (pubKey ??= await crypto.subtle.importKey('jwk', PUB, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']));
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, k, b64u(m[3]), new TextEncoder().encode(`PD1|${plan}|${id}`));
    return ok ? plan : null;
  } catch { return null; }
}
export function plan(s) { const l = s?.settings?.license; return l && PLANS[l.plan?.toUpperCase()] || 'free'; }
export const isPro = s => plan(s) !== 'free';
export const realClients = s => s.clients.filter(c => !c.demo).length;
export function canAddClient(s) { return isPro(s) || realClients(s) < FREE_CLIENTS; }
export function assertCanAddClient(s) { if (!canAddClient(s)) throw new Error(`The free plan includes ${FREE_CLIENTS} client. Unlock Pro in Settings & data for unlimited clients.`); }
export const canImport = s => isPro(s);
export const pdfFooter = s => isPro(s) ? '' : 'Made with Proposeroo Desk by Orvian Market';
export async function activate(s, key, pub) {
  const p = await verifyKey(key, pub); if (!p) throw new Error('That license key was not recognized. Copy it exactly from your Gumroad receipt and try again.');
  s.settings.license = { key: norm(key), plan: p }; return p;
}
// Re-check a stored license (e.g. after restoring a backup or on startup); drops anything that doesn't verify.
export async function recheck(s, pub) { const l = s.settings.license; if (!l) return 'free'; const p = typeof l === 'object' ? await verifyKey(l.key, pub) : null; if (p) l.plan = p; else delete s.settings.license; return plan(s); }
export function deactivate(s) { delete s.settings.license; }
export const planLabel = s => ({ free: 'Free plan', pro: 'Pro (single user)', team: 'Team (5 people)' })[plan(s)];
