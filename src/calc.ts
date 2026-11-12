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

// ————————————————————————————————————————————————————————————————
// EI au régime réel (BNC, déclaration contrôlée, impôt sur le revenu).
// Plus de « Prestations de services BNC » ni de versement libératoire : les cotisations
// sociales dépendent du BÉNÉFICE (recettes − charges) et sont prélevées par l'URSSAF selon
// un échéancier provisionnel, régularisé l'année suivante. L'impôt passe par le prélèvement
// à la source. Ici on calcule donc des PROVISIONS (sommes à mettre de côté), pas des montants
// à déclarer. La TVA (CA3) est inchangée.
// ————————————————————————————————————————————————————————————————
export interface Charge { libelle: string; ht: number; tva: number }
export interface OptsReel { tauxSocial: number; tauxPAS: number }
/** tauxSocial ≈ 29 % du bénéfice (estimation validée le 12/11/2026 : ≈ 6 800 € dus pour ≈ 23 300 € de bénéfice). tauxPAS = ton taux de prélèvement à la source. */
export const REEL_DEFAUT: OptsReel = { tauxSocial: 0.29, tauxPAS: 0 };

export interface CalculReel extends Calcul {
  mode: 'reel';
  l20Retro: number; l20Autres: number;          // TVA déductible : piscine + autres achats
  retroHT: number; chargesHT: number;           // chargesHT = rétro HT + autres charges HT
  benefice: number;                             // recettes HT − charges HT (avant cotisations)
  provSocial: number; provImpot: number;        // à mettre de côté
}

/**
 * retroDeducTTC : TTC de la rétro dont la TVA est déduite sur CETTE CA3 (ligne 20), c'est-à-dire la rétro
 * PAYÉE ce mois-là (une seule fois). Par défaut = retroTTC du mois (méthode jan–oct 2026).
 */
export function calcReel(caTTC: number, retroTTC: number, charges: Charge[] = [], o: OptsReel = REEL_DEFAUT, retroDeducTTC = retroTTC): CalculReel {
  const a1 = Math.round(caTTC / 1.2);
  const tax08 = Math.round(a1 * 0.2);
  const l20Retro = Math.round(retroDeducTTC / 6);
  const l20Autres = Math.round(charges.reduce((s, c) => s + (c.tva || 0), 0));
  const l20 = l20Retro + l20Autres;
  const tvaNette = tax08 - l20;
  const tvaPay = Math.max(0, tvaNette);
  const retroHT = retroTTC - Math.round(retroTTC / 6);
  const autresHT = charges.reduce((s, c) => s + (c.ht || 0), 0);
  const autresTTC = autresHT + charges.reduce((s, c) => s + (c.tva || 0), 0);
  const chargesHT = retroHT + autresHT;
  const benefice = a1 - chargesHT;
  const provSocial = Math.max(0, benefice) * o.tauxSocial;
  const provImpot = Math.max(0, benefice - provSocial) * o.tauxPAS; // cotisations déductibles du revenu imposable
  return {
    mode: 'reel', a1, tax08, l20, l20Retro, l20Autres, tvaNette, tvaPay, credit: tvaNette < 0,
    urssaf: provSocial, urssafDetail: { cotisations: provSocial, liberatoire: 0, formation: 0 },
    retroHT, chargesHT, benefice, provSocial, provImpot,
    reste: caTTC - retroTTC - autresTTC - tvaPay - provSocial - provImpot,
  };
}

// ——— Rétrocession SCM (convention du 30/11/2023) ———
/** 40 % du CA HT encaissé + TVA 20 % = 40 % du TTC encaissé (arrondi au centime). */
export const retroDue = (caTTC: number) => Math.round(caTTC * 0.4 * 100) / 100;
/** N° d'autofacture : numérotée par MOIS DE RÈGLEMENT (redevance de M payée en M+1). AF-2026-11 = redevance d'octobre. */
export function numAF(moisRedevance: string): string {
  const [a, m] = moisRedevance.split('-').map(Number);
  const d = new Date(Date.UTC(a, m, 1)); // mois suivant
  return `AF-${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
