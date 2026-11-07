import { describe, it, expect } from 'vitest';
import { calcMois, ecartCA3, TAUX_2026 } from '../src/calc';
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
