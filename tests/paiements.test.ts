import { describe, it, expect } from 'vitest';
import {
  reste, resume, ajouterVersement, supprimerVersement, ajouterSeances, trier, seancesCouvertes,
  normaliserPaiements, slug, payeTotal, encaisseDuMois, rangVersement, nouveauPaiement,
} from '../src/paiements';

const p = (nom: string, payeAvant: number, total: number, seances = 0, seancesTotal = 30) =>
  nouveauPaiement(nom, { payeAvant, total, seances, seancesTotal });

describe('paiements échelonnés', () => {
  it('reste dû et résumé', () => {
    const ps = [p('A', 390, 390), p('B', 60, 150), p('C', 0, 290)];
    expect(reste(ps[1])).toBe(90);
    expect(resume(ps)).toEqual({ due: 380, paid: 450, ok: 1, n: 3 });
  });
  it('versement daté avec moyen, plafonné au reste', () => {
    const r = ajouterVersement(p('B', 60, 150), { date: '2026-11-13', montant: 200, moyen: 'cheque', ref: '0000123' });
    expect(payeTotal(r)).toBe(150);
    expect(r.paye).toBe(150);
    expect(r.versements[0]).toMatchObject({ date: '2026-11-13', montant: 90, moyen: 'cheque', ref: '0000123' });
  });
  it('dater un ancien montant ne change pas le total payé', () => {
    const r = ajouterVersement(p('B', 60, 150), { date: '2026-10-08', montant: 60, moyen: 'cb', ancien: true });
    expect(r.payeAvant).toBe(0);
    expect(payeTotal(r)).toBe(60);
    const s = supprimerVersement(r, r.versements[0].id);
    expect(s.payeAvant).toBe(60);
    expect(payeTotal(s)).toBe(60);
  });
  it('supprimer un nouveau versement le retire du payé', () => {
    const r = ajouterVersement(p('B', 0, 150), { date: '2026-11-01', montant: 50, moyen: 'especes' });
    expect(payeTotal(supprimerVersement(r, r.versements[0].id))).toBe(0);
  });
  it('versements triés par date et rang', () => {
    let r = p('A', 0, 390);
    r = ajouterVersement(r, { date: '2026-11-10', montant: 130, moyen: 'cb' });
    r = ajouterVersement(r, { date: '2026-10-10', montant: 130, moyen: 'cb' });
    expect(r.versements.map(v => v.date)).toEqual(['2026-10-10', '2026-11-10']);
    expect(rangVersement(r, r.versements[1].id)).toBe(2);
  });
  it('encaissé du mois par moyen (hors anciens montants datés)', () => {
    let a = ajouterVersement(p('A', 0, 390), { date: '2026-11-02', montant: 130, moyen: 'cb' });
    a = ajouterVersement(a, { date: '2026-10-02', montant: 100, moyen: 'cb' });
    let b = ajouterVersement(p('B', 50, 150), { date: '2026-11-05', montant: 50, moyen: 'cheque' });
    b = ajouterVersement(b, { date: '2026-11-01', montant: 50, moyen: 'cb', ancien: true });
    const e = encaisseDuMois([a, b], '2026-11');
    expect(e.total).toBe(180);
    expect(e.parMoyen).toEqual({ cb: 130, cheque: 50 });
  });
  it('séances plafonnées et couvertes', () => {
    expect(ajouterSeances(p('A', 0, 390, 25), 10).seances).toBe(30);
    expect(seancesCouvertes(p('A', 130, 390))).toBe(10);
  });
  it('tri par reste dû', () => {
    expect(trier([p('A', 390, 390), p('B', 0, 150), p('C', 0, 390)]).map(x => x.nom)).toEqual(['C', 'B', 'A']);
  });
  it('migration de l\'ancien format : paye → payeAvant', () => {
    const r = normaliserPaiements([{ nom: 'Éloïse Dupré', paye: '20', total: 150, seances: 10, seancesTotal: 10 }, { foo: 1 }]);
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe('eloise-dupre');
    expect(r[0].payeAvant).toBe(20);
    expect(r[0].versements).toEqual([]);
    expect(payeTotal(r[0])).toBe(20);
    expect(slug('Ça va')).toBe('ca-va');
  });
  it('migration des versements sans moyen', () => {
    const r = normaliserPaiements([{ nom: 'X', paye: 100, total: 390, seances: 0, seancesTotal: 30, versements: [{ date: '2026-11-13', montant: 40 }] }]);
    expect(r[0].payeAvant).toBe(60);
    expect(r[0].versements[0].moyen).toBe('autre');
    expect(payeTotal(r[0])).toBe(100);
  });
});
