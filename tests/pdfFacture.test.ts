import { describe, it, expect } from 'vitest';
import { facturePDF, lignePaiement, nomLegal, nomFichier, pdfTxt } from '../src/pdfFacture';
import type { Facture } from '../src/factures';

const f: Facture = {
  id: 'x', numero: '202611-16', date: '2026-11-13', client: { nom: 'Cliente Test', email: 'c@test.fr' },
  lignes: [{ designation: 'Forfait 30 séances d\'aqua — 2e versement', qte: 1, puTTC: 100 }], tauxTVA: 0.2,
  acquittee: { date: '2026-11-10', moyen: 'cheque', ref: '0001234' }, creeLe: '',
};
const r = { structure: '', adresse: '1 rue Test, 33000 Bordeaux', payeur: 'Prénom Nom', siret: '000 000 000 00000', tvaIntra: 'FR00000000000' };

describe('PDF de facture', () => {
  it('mentions : nom + EI, acquittée avec moyen et n°', () => {
    expect(nomLegal(r)).toBe('Prénom Nom EI');
    expect(nomLegal({ ...r, payeur: 'Prénom Nom — Aquatic Shape EI' })).toBe('Prénom Nom EI');
    expect(nomLegal({ ...r, payeur: '' })).toBe('Aquatic Shape EI');
    expect(lignePaiement(f)).toBe('Facture acquittée le 10/11/2026 par chèque n° 0001234.');
    expect(lignePaiement({ ...f, acquittee: undefined })).toMatch(/^Paiement à réception/);
  });
  it('génère un PDF avec numéro, totaux et SIRET', async () => {
    const doc = await facturePDF(f, r);
    const out = doc.output();
    expect(out.startsWith('%PDF')).toBe(true);
    for (const s of ['FACTURE', '202611-16', 'Total TTC', '100,00', '83,33', '16,67', 'SIRET 000 000 000 00000']) expect(out).toContain(s);
  });
  it('nom de fichier et espaces fines', () => {
    expect(nomFichier(f)).toBe('Facture-202611-16-Cliente-Test.pdf');
    expect(pdfTxt('1 234,00 €')).toBe('1 234,00 €');
  });
});
