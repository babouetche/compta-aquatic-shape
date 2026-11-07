// Formules du cahier des charges §2 — NE PAS MODIFIER sans validation de Baptiste.
export interface Taux { cotisations: number; liberatoire: number; formation: number }
export const TAUX_2026: Taux = { cotisations: 0.256, liberatoire: 0.022, formation: 0.002 };

export interface CA3 { a1: number; tva08: number; deduc: number; ligne: '20' | '21'; net: number }

export interface Calcul {
  a1: number; tax08: number; l20: number; tvaNette: number; tvaPay: number; credit: boolean;
  urssaf: number; urssafDetail: { cotisations: number; liberatoire: number; formation: number };
  reste: number;
}

export function calcMois(caTTC: number, retroTTC: number, t: Taux = TAUX_2026): Calcul {
  const a1 = Math.round(caTTC / 1.2);
  const tax08 = Math.round(a1 * 0.2);
  const l20 = Math.round(retroTTC / 6); // TVA de la facture piscine = TTC/6
  const tvaNette = tax08 - l20;
  const tvaPay = Math.max(0, tvaNette);
  const urssafDetail = { cotisations: a1 * t.cotisations, liberatoire: a1 * t.liberatoire, formation: a1 * t.formation };
  const urssaf = urssafDetail.cotisations + urssafDetail.liberatoire + urssafDetail.formation;
  return { a1, tax08, l20, tvaNette, tvaPay, credit: tvaNette < 0, urssaf, urssafDetail, reste: caTTC - retroTTC - tvaPay - urssaf };
}

/** Écart = TVA calculée − TVA déclarée (positif = déclaré en moins). null si CA3 non saisie. */
export function ecartCA3(c: Calcul, ca3?: CA3): number | null {
  return ca3 ? c.tvaPay - ca3.net : null;
}
