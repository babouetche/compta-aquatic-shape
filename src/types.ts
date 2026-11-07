import type { CA3 } from './calc';
export interface Cheque { num: string; montant: number; date: string }
export interface Mois {
  caTTC: number; retroTTC: number; refFacture: string; cheques: Cheque[];
  compensation?: { montant: number; objet: string; netAPayer: number };
  ca3?: CA3; maj?: string;
}
export interface Reglages { structure: string; adresse: string; payeur?: string }
export interface Donnees { mois: Record<string, Mois>; reglages: Reglages }
