// Factures clients. Prix saisis TTC (TVA 20 % incluse), comme sur les forfaits.
// Numérotation chronologique sans trou : AAAAMM-N (ex. 202610-15), N continue d'un mois à l'autre.
import type { Moyen } from './paiements';

export interface LigneFacture { designation: string; qte: number; puTTC: number }
export interface Facture {
  id: string;
  numero: string;
  date: string;                                   // YYYY-MM-DD (date d'émission)
  client: { nom: string; adresse?: string; email?: string };
  lignes: LigneFacture[];
  tauxTVA: number;                                // 0,20
  acquittee?: { date: string; moyen: Moyen; ref?: string };
  notes?: string;
  lien?: { paiementId: string; versementId: string };
  creeLe: string;
}
export interface Prestation { designation: string; puTTC: number }

export const PRESTATIONS_DEFAUT: Prestation[] = [
  { designation: 'Forfait 30 séances d\'aqua', puTTC: 390 },
  { designation: 'Forfait 20 séances d\'aqua', puTTC: 290 },
  { designation: 'Forfait 10 séances d\'aqua', puTTC: 150 },
];

const r2 = (n: number) => Math.round(n * 100) / 100;

export const ttcLigne = (l: LigneFacture) => r2((l.qte || 0) * (l.puTTC || 0));
export const htUnitaire = (l: LigneFacture, taux = 0.2) => r2((l.puTTC || 0) / (1 + taux));

/** Totaux : le TTC fait foi, le HT en est déduit, la TVA est la différence (pas d'écart d'arrondi). */
export function totaux(f: Pick<Facture, 'lignes' | 'tauxTVA'>) {
  const ttc = r2(f.lignes.reduce((s, l) => s + ttcLigne(l), 0));
  const ht = r2(ttc / (1 + f.tauxTVA));
  return { ttc, ht, tva: r2(ttc - ht) };
}

const suffixe = (numero: string) => { const m = /-(\d+)$/.exec(numero); return m ? +m[1] : 0; };

/** Prochain numéro : AAAAMM du jour d'émission + compteur suivant le plus grand déjà utilisé (ou le réglage « prochain n° »). */
export function prochainNumero(fs: Facture[], date: string, prochain?: number) {
  const n = Math.max(prochain ? prochain - 1 : 0, ...fs.map(f => suffixe(f.numero)));
  return `${date.slice(0, 4)}${date.slice(5, 7)}-${n + 1}`;
}

export const numeroPris = (fs: Facture[], numero: string, saufId?: string) => fs.some(f => f.numero === numero && f.id !== saufId);

export function nouvelleFacture(fs: Facture[], o: Partial<Facture> & { date?: string } = {}, prochain?: number): Facture {
  const date = o.date ?? new Date().toISOString().slice(0, 10);
  return {
    id: Math.random().toString(36).slice(2, 10), numero: prochainNumero(fs, date, prochain), date,
    client: { nom: '' }, lignes: [], tauxTVA: 0.2, creeLe: new Date().toISOString(), ...o,
  };
}

export const trierFactures = (fs: Facture[]) => fs.slice().sort((a, b) => b.date.localeCompare(a.date) || suffixe(b.numero) - suffixe(a.numero));

export function normaliserFactures(x: unknown): Facture[] {
  if (!Array.isArray(x)) return [];
  return x.filter(f => f && typeof f.numero === 'string' && Array.isArray(f.lignes)).map((f: any) => ({
    ...f, id: f.id || Math.random().toString(36).slice(2, 10), tauxTVA: typeof f.tauxTVA === 'number' ? f.tauxTVA : 0.2,
    client: { nom: f.client?.nom ?? '', adresse: f.client?.adresse, email: f.client?.email },
    lignes: f.lignes.map((l: any) => ({ designation: String(l.designation ?? ''), qte: Number(l.qte) || 1, puTTC: Number(l.puTTC) || 0 })),
  }));
}
