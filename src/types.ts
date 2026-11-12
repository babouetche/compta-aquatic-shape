import type { CA3, Charge } from './calc';
import type { Paiement } from './paiements';
export interface Cheque { num: string; montant: number; date: string }
export interface Mois {
  caTTC: number; retroTTC: number; refFacture: string; cheques: Cheque[];
  compensation?: { montant: number; objet: string; netAPayer: number };
  ca3?: CA3; maj?: string;
  // EI au réel
  charges?: Charge[];          // autres dépenses pro du mois (HT + TVA)
  urssafPreleve?: number;      // ce que l'URSSAF a réellement prélevé ce mois
  pasPreleve?: number;         // acompte d'impôt (prélèvement à la source) prélevé ce mois
}
export interface Reglages {
  structure: string; adresse: string; payeur?: string;
  regime?: 'micro' | 'reel';   // défaut : réel
  reelDepuis?: string;         // YYYY-MM, défaut 2026-01 ; les mois d'avant sont calculés en micro
  tauxSocial?: number;         // estimation cotisations / bénéfice (0,43 par défaut)
  tauxPAS?: number;            // taux de prélèvement à la source (impots.gouv)
}
export interface Donnees { mois: Record<string, Mois>; reglages: Reglages; paiements?: Paiement[] }
