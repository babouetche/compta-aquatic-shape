import { jsPDF } from 'jspdf';
import type { Calcul } from './calc';
import type { Mois, Reglages } from './types';
import { e2, libMois, dateFr } from './format';

// Texte du justificatif (utilisé pour l'aperçu et le PDF). Pas d'IBAN.
export function justificatifLignes(k: string, m: Mois, c: Calcul, r: Reglages): string[] {
  const tvaRetro = Math.round(m.retroTTC / 6); // TVA de la facture piscine = TTC/6
  const ht = m.retroTTC - tvaRetro;
  const regl = m.cheques.map(q => `  Règlement n° ${q.num} — ${e2(q.montant)} — ${dateFr(q.date)}`);
  const totalRegl = m.cheques.reduce((s, q) => s + q.montant, 0);
  return [
    'JUSTIFICATIF DE PAIEMENT DE RÉTROCESSION',
    'Document interne — ne remplace pas la facture',
    '',
    `Payeur : ${r.payeur || 'Aquatic Shape EI'}`,
    r.adresse ? `Adresse : ${r.adresse}` : '',
    r.siret ? `SIRET : ${r.siret}${r.ape ? ` · APE ${r.ape}` : ''}` : '',
    r.tvaIntra ? `N° TVA : ${r.tvaIntra}` : '',
    `Bénéficiaire : ${r.structure}`,
    `Période : redevance de ${libMois(k)}`,
    m.refFacture ? `Référence facture : ${m.refFacture}` : '',
    '',
    `Montant HT : ${e2(ht)}`,
    `TVA : ${e2(tvaRetro)}`,
    `Montant TTC : ${e2(m.retroTTC)}`,
    '',
    'Règlements :',
    ...(regl.length ? regl : ['  (aucun règlement saisi)']),
    ...(m.compensation ? [`  Compensation — ${e2(m.compensation.montant)} — ${m.compensation.objet}`] : []),
    `Total réglé : ${e2(totalRegl)}`,
    '',
    `TVA de cette rétro : ${e2(m.retroTTC - ht)}, déduite une seule fois (ligne 20) sur la CA3 du mois de paiement`,
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '');
}

export function telechargerPDF(k: string, m: Mois, c: Calcul, r: Reglages) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 22;
  justificatifLignes(k, m, c, r).forEach((l, i) => {
    doc.setFont('helvetica', i === 0 ? 'bold' : 'normal').setFontSize(i === 0 ? 15 : 11);
    doc.text(l, 20, y); y += i === 0 ? 8 : 6.5;
  });
  doc.save(`justificatif-retrocession-${k}.pdf`);
}
