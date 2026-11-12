// Forfaits réglés en plusieurs fois (reprend l'artefact « Paiements échelonnés Aquatic Shape »).
// Montants en € TTC ; « séances » = séances déjà ajoutées sur le compte Deciplus du client.

export interface Versement { date: string; montant: number }
export interface Paiement {
  id: string; nom: string;
  paye: number; total: number;          // € TTC
  seances: number; seancesTotal: number;
  maj?: string;
  versements?: Versement[];             // historique des versements saisis dans l'app
}

export const reste = (p: Paiement) => Math.max(0, (p.total || 0) - (p.paye || 0));
export const solde = (p: Paiement) => reste(p) === 0;

export function resume(ps: Paiement[]) {
  return {
    due: ps.reduce((s, p) => s + reste(p), 0),
    paid: ps.reduce((s, p) => s + (p.paye || 0), 0),
    ok: ps.filter(solde).length,
    n: ps.length,
  };
}

/** Ajoute un versement (plafonné au total) et le note dans l'historique. */
export function verser(p: Paiement, montant: number, date = new Date().toISOString()): Paiement {
  const v = Math.min(montant, reste(p));
  return { ...p, paye: (p.paye || 0) + v, maj: date, versements: [...(p.versements ?? []), { date: date.slice(0, 10), montant: v }] };
}

/** Ajoute des séances (plafonné aux séances prévues). */
export const ajouterSeances = (p: Paiement, n: number, date = new Date().toISOString()): Paiement =>
  ({ ...p, seances: Math.min(p.seancesTotal, (p.seances || 0) + n), maj: date });

/** Tri : plus gros reste dû d'abord, puis nom. */
export const trier = (ps: Paiement[]) => ps.slice().sort((a, b) => reste(b) - reste(a) || a.nom.localeCompare(b.nom, 'fr'));

/** Séances « méritées » par ce qui est payé (prorata), pour savoir combien en ajouter sur Deciplus. */
export const seancesCouvertes = (p: Paiement) => (p.total ? Math.floor((p.paye / p.total) * p.seancesTotal) : 0);

export const slug = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'c-' + Date.now();

export function normaliserPaiements(x: unknown): Paiement[] {
  if (!Array.isArray(x)) return [];
  return x.filter(p => p && typeof p.nom === 'string').map((p: any) => ({
    id: p.id || slug(p.nom), nom: p.nom,
    paye: Number(p.paye) || 0, total: Number(p.total) || 0,
    seances: Number(p.seances) || 0, seancesTotal: Number(p.seancesTotal) || 0,
    maj: p.maj, versements: Array.isArray(p.versements) ? p.versements : undefined,
  }));
}
