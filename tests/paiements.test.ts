import { describe, it, expect } from 'vitest';
import { reste, resume, verser, ajouterSeances, trier, seancesCouvertes, normaliserPaiements, slug } from '../src/paiements';

const p = (nom: string, paye: number, total: number, seances = 0, seancesTotal = 30) => ({ id: slug(nom), nom, paye, total, seances, seancesTotal });

describe('paiements échelonnés', () => {
  it('reste dû et résumé', () => {
    const ps = [p('A', 390, 390), p('B', 60, 150), p('C', 0, 290)];
    expect(reste(ps[1])).toBe(90);
    expect(resume(ps)).toEqual({ due: 380, paid: 450, ok: 1, n: 3 });
  });
  it('versement plafonné au total et historisé', () => {
    const r = verser(p('B', 60, 150), 200, '2026-11-13T10:00:00Z');
    expect(r.paye).toBe(150);
    expect(r.versements).toEqual([{ date: '2026-11-13', montant: 90 }]);
  });
  it('séances plafonnées', () => {
    expect(ajouterSeances(p('A', 0, 390, 25), 10).seances).toBe(30);
  });
  it('tri par reste dû', () => {
    expect(trier([p('A', 390, 390), p('B', 0, 150), p('C', 0, 390)]).map(x => x.nom)).toEqual(['C', 'B', 'A']);
  });
  it('séances couvertes par le paiement', () => {
    expect(seancesCouvertes(p('A', 130, 390))).toBe(10);
  });
  it('import : ignore les lignes invalides, crée un id', () => {
    const r = normaliserPaiements([{ nom: 'Éloïse Dupré', paye: '20', total: 150, seances: 10, seancesTotal: 10 }, { foo: 1 }]);
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe('eloise-dupre');
    expect(r[0].paye).toBe(20);
  });
});
