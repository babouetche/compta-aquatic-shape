import { calcMois, calcReel, REEL_DEFAUT, type Calcul, type CalculReel, type Taux } from './calc';
import type { Mois, Reglages } from './types';

export const REEL_DEPUIS_DEFAUT = '2026-01';
export const regimeDe = (k: string, r: Reglages): 'micro' | 'reel' =>
  (r.regime ?? 'reel') === 'reel' && k >= (r.reelDepuis || REEL_DEPUIS_DEFAUT) ? 'reel' : 'micro';

export const optsReel = (r: Reglages) => ({ tauxSocial: r.tauxSocial ?? REEL_DEFAUT.tauxSocial, tauxPAS: r.tauxPAS ?? REEL_DEFAUT.tauxPAS });

/** Mois à partir duquel la TVA de la rétro se déduit au mois de PAIEMENT (rétro de M-1 payée en M). */
export const DEDUC_PAIEMENT_DEPUIS = '2026-11';
export const moisPrecedent = (k: string) => {
  const [a, m] = k.split('-').map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
};
/**
 * TTC de la rétro dont la TVA va en ligne 20 de la CA3 du mois k (déduite UNE seule fois).
 * Avant nov. 2026 : la rétro du mois (méthode utilisée jan–oct). Novembre 2026 : 0 (la TVA de AF-2026-11,
 * 254,96 €, a déjà été déduite sur la CA3 d'octobre). Ensuite : la rétro du mois précédent, payée en k.
 */
export function retroDeductible(k: string, m: Mois, tous: Record<string, Mois> = {}, r: Reglages = {} as Reglages): number {
  const depuis = r.deducPaiementDepuis || DEDUC_PAIEMENT_DEPUIS;
  if (k < depuis) return m.retroTTC;
  if (k === depuis) return 0;
  return tous[moisPrecedent(k)]?.retroTTC ?? 0;
}

/** Calcul du mois selon le régime applicable à ce mois. */
export function calculMois(k: string, m: Mois, r: Reglages, taux: Taux, tous: Record<string, Mois> = {}): Calcul | CalculReel {
  return regimeDe(k, r) === 'reel'
    ? calcReel(m.caTTC, m.retroTTC, m.charges ?? [], optsReel(r), retroDeductible(k, m, tous, r))
    : calcMois(m.caTTC, m.retroTTC, taux);
}

/** URSSAF : 2026 régularisée et soldée (8 723 €) ; à partir de 2027, mensualisation saisie dans les réglages. */
export const URSSAF_2026_SOLDE = 8723;
export function infoUrssaf(k: string, r: Reglages): { texte: string; mensuel?: number } {
  if (k.startsWith('2026')) return { texte: `2026 régularisée et soldée : ${URSSAF_2026_SOLDE.toLocaleString('fr-FR')} € (dernier prélèvement 237 € le 03/12/2026). Plus rien à déclarer ni à payer chaque mois en 2026.` };
  if (r.urssafMensuel) return { texte: 'Mensualisation URSSAF (prélèvement automatique).', mensuel: r.urssafMensuel };
  return { texte: 'Mensualisation à partir du 01/01/2027 : saisis le montant mensuel dans les réglages après la modulation de janvier.' };
}
export const estReel = (c: Calcul | CalculReel): c is CalculReel => (c as CalculReel).mode === 'reel';
