import { describe, it, expect } from 'vitest';
import { totaux, prochainNumero, nouvelleFacture, htUnitaire, numeroPris, normaliserFactures, type Facture } from '../src/factures';

const f = (numero: string, date = '2026-10-15'): Facture => ({ id: numero, numero, date, client: { nom: 'X' }, lignes: [], tauxTVA: 0.2, creeLe: '' });

describe('factures', () => {
  it('totaux à partir du TTC (390 € → 325 HT + 65 TVA)', () => {
    expect(totaux({ tauxTVA: 0.2, lignes: [{ designation: 'Forfait 30 séances', qte: 1, puTTC: 390 }] })).toEqual({ ttc: 390, ht: 325, tva: 65 });
  });
  it('versement de 55 € → 45,83 HT + 9,17 TVA (comme la facture 202610-14)', () => {
    expect(totaux({ tauxTVA: 0.2, lignes: [{ designation: 'Versement', qte: 1, puTTC: 55 }] })).toEqual({ ttc: 55, ht: 45.83, tva: 9.17 });
  });
  it('plusieurs lignes et quantités', () => {
    expect(totaux({ tauxTVA: 0.2, lignes: [{ designation: 'a', qte: 2, puTTC: 15 }, { designation: 'b', qte: 1, puTTC: 150 }] }).ttc).toBe(180);
    expect(htUnitaire({ designation: 'a', qte: 1, puTTC: 150 })).toBe(125);
  });
  it('numérotation AAAAMM-N, N continue', () => {
    expect(prochainNumero([f('202610-14'), f('202610-15')], '2026-11-13')).toBe('202611-16');
    expect(prochainNumero([], '2026-11-13', 16)).toBe('202611-16');
    expect(prochainNumero([f('202611-20')], '2026-11-13', 16)).toBe('202611-21');
  });
  it('nouvelle facture : numéro suivant, TVA 20 %', () => {
    const n = nouvelleFacture([f('202610-15')], { date: '2026-12-01' });
    expect(n.numero).toBe('202612-16');
    expect(n.tauxTVA).toBe(0.2);
  });
  it('numéro déjà pris', () => {
    expect(numeroPris([f('202610-15')], '202610-15')).toBe(true);
    expect(numeroPris([f('202610-15')], '202610-15', '202610-15')).toBe(false);
  });
  it('import : ignore les factures invalides', () => {
    expect(normaliserFactures([{ numero: '1', lignes: [{ designation: 'a', qte: '2', puTTC: '10' }] }, { x: 1 }])).toHaveLength(1);
  });
});
