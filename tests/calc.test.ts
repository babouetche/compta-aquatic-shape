import { describe, it, expect } from 'vitest';
import { calcMois, calcReel, ecartCA3, TAUX_2026 } from '../src/calc';
const seeds = import.meta.glob('../src/seed.json', { eager: true, import: 'default' });
const seed: any = Object.values(seeds)[0];

// Valeurs de référence : cahier des charges §4  [mois, a1, l20, tvaCalc, tvaDeclaree, ecart]
const REF: [string, number, number, number, number, number][] = [
  ['2026-01', 4081, 287, 529, 505, 24],
  ['2026-02', 2478, 135, 361, 351, 10],
  ['2026-03', 2017, 135, 268, 243, 25],
  ['2026-04', 3575, 286, 429, 429, 0],
  ['2026-05', 4417, 353, 530, 530, 0],
  ['2026-06', 1556, 117, 194, 187, 7],
  ['2026-07', 1725, 104, 241, 207, 34],
  ['2026-08', 1873, 69, 306, 306, 0],
  ['2026-09', 8792, 700, 1058, 1107, -49],
  ['2026-10', 3187, 255, 382, 382, 0],
];
const mois = (seed?.mois ?? {}) as Record<string, any>;
const d = describe.skipIf(!seed); // données perso absentes du dépôt public

d('calcMois — tableau §4', () => {
  for (const [m, a1, l20, tva, decl, ecart] of REF) {
    it(m, () => {
      const r = calcMois(mois[m].caTTC, mois[m].retroTTC);
      expect(r.a1).toBe(a1);
      expect(r.l20).toBe(l20);
      expect(r.tvaPay).toBe(tva);
      expect(mois[m].ca3.net).toBe(decl);
      expect(ecartCA3(r, mois[m].ca3)).toBe(ecart);
    });
  }
  it('total écart = +51', () => {
    const t = REF.reduce((s, r) => s + (ecartCA3(calcMois(mois[r[0]].caTTC, mois[r[0]].retroTTC), mois[r[0]].ca3) ?? 0), 0);
    expect(t).toBe(51);
  });
});

describe('règles', () => {
  it('crédit de TVA : tvaPay = 0, tvaNette < 0', () => {
    const r = calcMois(600, 2400);
    expect(r.tvaNette).toBeLessThan(0);
    expect(r.tvaPay).toBe(0);
    expect(r.credit).toBe(true);
  });
  it('URSSAF = a1 × (25,6 + 2,2 + 0,2 %)', () => {
    const r = calcMois(1200, 0);
    expect(r.a1).toBe(1000);
    expect(r.urssaf).toBeCloseTo(280, 5);
    expect(TAUX_2026.cotisations).toBe(0.256);
  });
  it('reste = caTTC − rétro − TVA − URSSAF', () => {
    const r = calcMois(4897, 1720);
    expect(r.reste).toBeCloseTo(4897 - 1720 - r.tvaPay - r.urssaf, 5);
  });
  it('écart absent si CA3 non saisie', () => {
    expect(ecartCA3(calcMois(1200, 0), undefined)).toBeNull();
  });
});

describe('EI au réel', () => {
  it('sans autres charges : même TVA que le calcul micro', () => {
    const r = calcReel(4897, 1720);
    const mc = calcMois(4897, 1720);
    expect([r.a1, r.tax08, r.l20, r.tvaPay]).toEqual([mc.a1, mc.tax08, mc.l20, mc.tvaPay]);
  });
  it('bénéfice = recettes HT − rétro HT − autres charges HT', () => {
    const r = calcReel(1200, 600, [{ libelle: 'Matériel', ht: 100, tva: 20 }]);
    expect(r.a1).toBe(1000);
    expect(r.retroHT).toBe(500);
    expect(r.chargesHT).toBe(600);
    expect(r.benefice).toBe(400);
  });
  it('TVA des autres achats ajoutée en ligne 20', () => {
    const r = calcReel(1200, 600, [{ libelle: 'Matériel', ht: 100, tva: 20 }]);
    expect(r.l20Retro).toBe(100);
    expect(r.l20Autres).toBe(20);
    expect(r.tvaPay).toBe(200 - 120);
  });
  it('provisions : social sur le bénéfice, impôt sur bénéfice − social', () => {
    const r = calcReel(1200, 0, [], { tauxSocial: 0.4, tauxPAS: 0.1 });
    expect(r.provSocial).toBeCloseTo(400, 6);
    expect(r.provImpot).toBeCloseTo(60, 6);
    expect(r.reste).toBeCloseTo(1200 - 200 - 400 - 60, 6);
  });
  it('perte : aucune provision', () => {
    const r = calcReel(1200, 1800);
    expect(r.benefice).toBeLessThan(0);
    expect(r.provSocial).toBe(0);
    expect(r.provImpot).toBe(0);
  });
});

import { regimeDe, calculMois } from '../src/regime';
describe('régime par mois', () => {
  it('défaut : réel depuis 2026-01', () => {
    expect(regimeDe('2026-01', { structure: '', adresse: '' })).toBe('reel');
    expect(regimeDe('2025-12', { structure: '', adresse: '' })).toBe('micro');
  });
  it('micro si choisi', () => {
    expect(regimeDe('2026-05', { structure: '', adresse: '', regime: 'micro' })).toBe('micro');
  });
  it('bascule au mois choisi', () => {
    const r = { structure: '', adresse: '', reelDepuis: '2026-11' };
    expect(calculMois('2026-10', { caTTC: 1200, retroTTC: 0, refFacture: '', cheques: [] }, r, TAUX_2026).urssaf).toBeCloseTo(280, 5);
    expect((calculMois('2026-11', { caTTC: 1200, retroTTC: 0, refFacture: '', cheques: [] }, r, TAUX_2026) as any).mode).toBe('reel');
  });
});
