// Forfaits réglés en plusieurs fois. Montants en € TTC ; « séances » = séances créditées sur Deciplus.
// Chaque versement est daté, avec son moyen de paiement (et son n° de chèque le cas échéant).

export type Moyen = 'cb' | 'cheque' | 'especes' | 'virement' | 'autre';
export const MOYENS: Record<Moyen, string> = { cb: 'Carte bancaire', cheque: 'Chèque', especes: 'Espèces', virement: 'Virement', autre: 'Autre' };
export const MOYENS_COURTS: Record<Moyen, string> = { cb: 'CB', cheque: 'Chèque', especes: 'Espèces', virement: 'Virement', autre: 'Autre' };

export interface Versement {
  id: string;
  date: string;            // YYYY-MM-DD
  montant: number;         // € TTC
  moyen: Moyen;
  ref?: string;            // n° de chèque, référence de virement…
  note?: string;
  ancien?: boolean;        // datation d'un montant déjà compté dans « payé avant le suivi »
  factureId?: string;      // facture émise pour ce versement
}

export interface Paiement {
  id: string; nom: string;
  total: number;                       // prix du forfait, € TTC
  seances: number; seancesTotal: number;
  payeAvant: number;                   // déjà payé, sans détail (reprise de l'ancien suivi)
  versements: Versement[];
  paye: number;                        // = payeAvant + Σ versements (gardé à jour pour la compatibilité)
  formule?: string;                    // ex. « Forfait 30 séances »
  plan?: string;                       // ex. « 3 fois par chèque »
  moyenHabituel?: Moyen;
  email?: string; tel?: string;
  notes?: string;
  maj?: string;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const uid = () => Math.random().toString(36).slice(2, 9);
export const aujourdhui = () => new Date().toISOString().slice(0, 10);

export const payeTotal = (p: Paiement) => r2((p.payeAvant || 0) + p.versements.reduce((s, v) => s + (v.montant || 0), 0));
export const reste = (p: Paiement) => Math.max(0, r2((p.total || 0) - payeTotal(p)));
export const solde = (p: Paiement) => reste(p) === 0;
const sync = (p: Paiement): Paiement => ({ ...p, paye: payeTotal(p), maj: new Date().toISOString() });

export function resume(ps: Paiement[]) {
  return {
    due: r2(ps.reduce((s, p) => s + reste(p), 0)),
    paid: r2(ps.reduce((s, p) => s + payeTotal(p), 0)),
    ok: ps.filter(solde).length,
    n: ps.length,
  };
}

/**
 * Ajoute un versement. `ancien` = on date un montant déjà compté dans « payé avant le suivi » :
 * il est retiré de payeAvant (le total payé ne bouge pas). Sinon le montant est plafonné au reste dû.
 */
export function ajouterVersement(p: Paiement, v: Omit<Versement, 'id'> & { id?: string }): Paiement {
  if (v.ancien) {
    const m = Math.min(v.montant, p.payeAvant || 0);
    if (m <= 0) return p;
    return sync({ ...p, payeAvant: r2((p.payeAvant || 0) - m), versements: trierVersements([...p.versements, { ...v, id: v.id ?? uid(), montant: m, ancien: true }]) });
  }
  const m = Math.min(v.montant, reste(p));
  if (m <= 0) return p;
  return sync({ ...p, versements: trierVersements([...p.versements, { ...v, id: v.id ?? uid(), montant: r2(m) }]) });
}

/** Supprime un versement ; s'il datait un ancien montant, ce montant redevient « payé avant le suivi ». */
export function supprimerVersement(p: Paiement, id: string): Paiement {
  const v = p.versements.find(x => x.id === id);
  if (!v) return p;
  return sync({ ...p, payeAvant: r2((p.payeAvant || 0) + (v.ancien ? v.montant : 0)), versements: p.versements.filter(x => x.id !== id) });
}

export const modifierVersement = (p: Paiement, id: string, patch: Partial<Versement>): Paiement =>
  sync({ ...p, versements: trierVersements(p.versements.map(v => (v.id === id ? { ...v, ...patch } : v))) });

export const trierVersements = (vs: Versement[]) => vs.slice().sort((a, b) => a.date.localeCompare(b.date));

/** Rang du versement chez cette cliente (1er, 2e…), en comptant un éventuel montant non daté comme 1er. */
export const rangVersement = (p: Paiement, id: string) => p.versements.findIndex(v => v.id === id) + 1 + (p.payeAvant > 0 ? 1 : 0);

/** Ajoute des séances (plafonné aux séances prévues). */
export const ajouterSeances = (p: Paiement, n: number): Paiement =>
  ({ ...p, seances: Math.min(p.seancesTotal, (p.seances || 0) + n), maj: new Date().toISOString() });

/** Séances financées par ce qui est payé (prorata) : combien on peut en créditer sur Deciplus. */
export const seancesCouvertes = (p: Paiement) => (p.total ? Math.floor((payeTotal(p) / p.total) * p.seancesTotal) : 0);

/** Tri : plus gros reste dû d'abord, puis nom. */
export const trier = (ps: Paiement[]) => ps.slice().sort((a, b) => reste(b) - reste(a) || a.nom.localeCompare(b.nom, 'fr'));

/** Encaissements d'un mois (YYYY-MM), par moyen : aide à remplir « Encaissé TTC ». */
export function encaisseDuMois(ps: Paiement[], mois: string) {
  const parMoyen: Partial<Record<Moyen, number>> = {};
  let total = 0; const lignes: { nom: string; v: Versement }[] = [];
  for (const p of ps) for (const v of p.versements) {
    if (v.ancien || !v.date.startsWith(mois)) continue;
    parMoyen[v.moyen] = r2((parMoyen[v.moyen] ?? 0) + v.montant); total = r2(total + v.montant); lignes.push({ nom: p.nom, v });
  }
  return { total, parMoyen, lignes: lignes.sort((a, b) => a.v.date.localeCompare(b.v.date)) };
}

export const slug = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'c-' + Date.now();

export function nouveauPaiement(nom: string, o: Partial<Paiement> = {}): Paiement {
  return sync({ id: slug(nom), nom, total: 390, seances: 0, seancesTotal: 30, payeAvant: 0, versements: [], paye: 0, ...o });
}

const estMoyen = (x: any): x is Moyen => typeof x === 'string' && x in MOYENS;

/** Import / migration : accepte l'ancien format (paye seul) et le nouveau. */
export function normaliserPaiements(x: unknown): Paiement[] {
  if (!Array.isArray(x)) return [];
  return x.filter(p => p && typeof p.nom === 'string').map((p: any) => {
    const versements: Versement[] = (Array.isArray(p.versements) ? p.versements : [])
      .filter((v: any) => v && Number(v.montant) > 0)
      .map((v: any) => ({
        id: v.id || uid(), date: String(v.date || '').slice(0, 10) || aujourdhui(), montant: r2(Number(v.montant)),
        moyen: estMoyen(v.moyen) ? v.moyen : 'autre', ref: v.ref || undefined, note: v.note || undefined,
        ancien: v.ancien || undefined, factureId: v.factureId || undefined,
      }));
    const somme = versements.reduce((s, v) => s + v.montant, 0);
    const paye = Number(p.paye) || 0;
    const payeAvant = p.payeAvant !== undefined ? Number(p.payeAvant) || 0 : Math.max(0, r2(paye - somme));
    const out: Paiement = {
      id: p.id || slug(p.nom), nom: p.nom,
      total: Number(p.total) || 0, seances: Number(p.seances) || 0, seancesTotal: Number(p.seancesTotal) || 0,
      payeAvant, versements: trierVersements(versements), paye: 0,
      formule: p.formule || undefined, plan: p.plan || undefined, moyenHabituel: estMoyen(p.moyenHabituel) ? p.moyenHabituel : undefined,
      email: p.email || undefined, tel: p.tel || undefined, notes: p.notes || undefined, maj: p.maj,
    };
    out.paye = payeTotal(out);
    return out;
  });
}
