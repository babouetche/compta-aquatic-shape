import { calcMois, calcReel, REEL_DEFAUT, type Calcul, type CalculReel, type Taux } from './calc';
import type { Mois, Reglages } from './types';

export const REEL_DEPUIS_DEFAUT = '2026-01';
export const regimeDe = (k: string, r: Reglages): 'micro' | 'reel' =>
  (r.regime ?? 'reel') === 'reel' && k >= (r.reelDepuis || REEL_DEPUIS_DEFAUT) ? 'reel' : 'micro';

export const optsReel = (r: Reglages) => ({ tauxSocial: r.tauxSocial ?? REEL_DEFAUT.tauxSocial, tauxPAS: r.tauxPAS ?? REEL_DEFAUT.tauxPAS });

/** Calcul du mois selon le régime applicable à ce mois. */
export function calculMois(k: string, m: Mois, r: Reglages, taux: Taux): Calcul | CalculReel {
  return regimeDe(k, r) === 'reel' ? calcReel(m.caTTC, m.retroTTC, m.charges ?? [], optsReel(r)) : calcMois(m.caTTC, m.retroTTC, taux);
}
export const estReel = (c: Calcul | CalculReel): c is CalculReel => (c as CalculReel).mode === 'reel';
