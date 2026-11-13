import { jsPDF } from 'jspdf';
import { type Facture, totaux, htUnitaire, ttcLigne } from './factures';
import { MOYENS } from './paiements';
import type { Reglages } from './types';

// jsPDF (polices standard) ne connaît pas l'espace fine insécable de fr-FR : on la remplace.
export const pdfTxt = (s: string) => s.replace(/[  ]/g, ' ');
const eur = (n: number) => pdfTxt(new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n));
const dfr = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '');

let logoCache: Promise<string | null> | null = null;
const logo = () => (logoCache ??= fetch('./logo.png').then(r => (r.ok ? r.blob() : null)).then(b => b && new Promise<string>(ok => {
  const fr = new FileReader(); fr.onload = () => ok(fr.result as string); fr.readAsDataURL(b);
})).catch(() => null));

/** Nom légal de l'EI : nom + « EI » (mention obligatoire). */
export const nomLegal = (r: Reglages) => {
  const b = (r.payeur || '').replace(/\s*[—-]\s*Aquatic Shape( EI)?\s*$/i, '').replace(/\s+EI$/i, '').trim();
  return b ? b + ' EI' : 'Aquatic Shape EI';
};

const ACC: [number, number, number] = [10, 124, 255];
const INK: [number, number, number] = [13, 27, 42];
const MUT: [number, number, number] = [95, 113, 134];

/** Ligne « Facture acquittée… » ou conditions de paiement. */
export function lignePaiement(f: Facture) {
  if (!f.acquittee) return 'Paiement à réception de la facture. Pas d\'escompte pour paiement anticipé.';
  const a = f.acquittee;
  return `Facture acquittée le ${dfr(a.date)} par ${MOYENS[a.moyen].toLowerCase()}${a.ref ? ` n° ${a.ref}` : ''}.`;
}

export async function facturePDF(f: Facture, r: Reglages): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 16;
  const t = totaux(f);
  const txt = (s: string, x: number, y: number, o: any = {}) => doc.text(pdfTxt(s), x, y, o);

  // Bandeau
  doc.setFillColor(...ACC); doc.rect(0, 0, W, 4, 'F');
  const img = await logo();
  if (img) doc.addImage(img, 'PNG', M, 12, 58, 58 * 280 / 899);
  else { doc.setFont('helvetica', 'bold').setFontSize(18).setTextColor(...INK); txt(r.nomCommercial || 'Aquatic Shape', M, 24); }
  doc.setFont('helvetica', 'bold').setFontSize(24).setTextColor(...ACC); txt('FACTURE', W - M, 22, { align: 'right' });
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...INK);
  txt(`N° ${f.numero}`, W - M, 29, { align: 'right' });
  txt(`Date : ${dfr(f.date)}`, W - M, 34.5, { align: 'right' });

  // Émetteur
  let y = 44;
  doc.setFont('helvetica', 'bold').setFontSize(10.5).setTextColor(...INK);
  txt(nomLegal(r), M, y);
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...MUT);
  const em = [
    `${r.nomCommercial || 'Aquatic Shape'} — Entrepreneur individuel`,
    r.adresse, r.siret && `SIRET ${r.siret}${r.ape ? ` · APE ${r.ape}` : ''}`, r.tvaIntra && `N° TVA intracommunautaire ${r.tvaIntra}`,
    [r.emailPro, r.telPro].filter(Boolean).join(' · '),
  ].filter(Boolean) as string[];
  em.forEach(l => { y += 4.6; txt(l, M, y); });

  // Client
  const cx = 118, cw = W - M - cx;
  const cl = [f.client.adresse, f.client.email].filter(Boolean) as string[];
  const ch = 14 + cl.length * 4.6;
  doc.setFillColor(242, 246, 251); doc.roundedRect(cx, 40, cw, ch, 3, 3, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(7.5).setTextColor(...MUT); txt('FACTURÉ À', cx + 5, 46);
  doc.setFont('helvetica', 'bold').setFontSize(10.5).setTextColor(...INK); txt(f.client.nom || '—', cx + 5, 51.5);
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...MUT);
  cl.forEach((l, i) => txt(l, cx + 5, 56 + i * 4.6));

  // Tableau
  y = Math.max(y, 40 + ch) + 12;
  const cols = [M, 118, 136, 160, W - M]; // désignation | qté | PU HT | total HT (droite)
  doc.setFillColor(...ACC); doc.roundedRect(M, y - 5.5, W - 2 * M, 9, 2, 2, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(255, 255, 255);
  txt('DÉSIGNATION', cols[0] + 4, y); txt('QTÉ', cols[1] + 6, y, { align: 'center' });
  txt('PU HT', cols[2] + 14, y, { align: 'right' }); txt('TVA', cols[3] + 2, y, { align: 'center' }); txt('TOTAL HT', cols[4] - 4, y, { align: 'right' });
  y += 9;
  doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(...INK);
  for (const l of f.lignes) {
    const lines = doc.splitTextToSize(pdfTxt(l.designation || '—'), 96) as string[];
    doc.text(lines, cols[0] + 4, y);
    txt(String(l.qte), cols[1] + 6, y, { align: 'center' });
    txt(eur(htUnitaire(l, f.tauxTVA)), cols[2] + 14, y, { align: 'right' });
    txt(`${Math.round(f.tauxTVA * 100)} %`, cols[3] + 2, y, { align: 'center' });
    txt(eur(Math.round((ttcLigne(l) / (1 + f.tauxTVA)) * 100) / 100), cols[4] - 4, y, { align: 'right' });
    y += Math.max(1, lines.length) * 4.6 + 3;
    doc.setDrawColor(225, 232, 240); doc.line(M, y - 3.5, W - M, y - 3.5);
  }

  // Totaux
  y += 4;
  const tx = 128;
  const ligneTot = (l: string, v: string) => { doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(...MUT); txt(l, tx, y); doc.setTextColor(...INK); txt(v, W - M - 4, y, { align: 'right' }); y += 6; };
  ligneTot('Total HT', eur(t.ht));
  ligneTot(`TVA ${Math.round(f.tauxTVA * 100)} %`, eur(t.tva));
  doc.setFillColor(...ACC); doc.roundedRect(tx - 4, y - 5, W - M - tx + 4, 10, 2, 2, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(255, 255, 255);
  txt('Total TTC', tx, y + 1.5); txt(eur(t.ttc), W - M - 4, y + 1.5, { align: 'right' });
  y += 18;

  // Paiement
  const paye = !!f.acquittee;
  doc.setFillColor(...(paye ? [225, 245, 234] as [number, number, number] : [242, 246, 251] as [number, number, number]));
  doc.roundedRect(M, y - 5.5, W - 2 * M, 10, 2, 2, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(9.5).setTextColor(...(paye ? [18, 120, 72] as [number, number, number] : INK));
  txt(lignePaiement(f), M + 4, y + 0.8);
  y += 12;
  if (f.notes) { doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...MUT); const n = doc.splitTextToSize(pdfTxt(f.notes), W - 2 * M) as string[]; doc.text(n, M, y); y += n.length * 4.6; }

  // Pied de page
  doc.setDrawColor(225, 232, 240); doc.line(M, 280, W - M, 280);
  doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...MUT);
  const pied = [`${r.nomCommercial || 'Aquatic Shape'} — ${nomLegal(r)}`, r.siret && `SIRET ${r.siret}`, r.tvaIntra && `TVA ${r.tvaIntra}`].filter(Boolean).join(' · ');
  txt(pied, W / 2, 285, { align: 'center' });
  return doc;
}

export const nomFichier = (f: Facture) => `Facture-${f.numero}${f.client.nom ? '-' + f.client.nom.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-') : ''}.pdf`;

export async function telechargerFacture(f: Facture, r: Reglages) {
  (await facturePDF(f, r)).save(nomFichier(f));
}

/** Partage (feuille de partage iOS : Mail, Messages, WhatsApp…) ; sinon téléchargement. */
export async function partagerFacture(f: Facture, r: Reglages) {
  const doc = await facturePDF(f, r);
  const file = new File([doc.output('blob')], nomFichier(f), { type: 'application/pdf' });
  const nav = navigator as Navigator & { canShare?: (d: any) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file], title: `Facture ${f.numero}` }); return true; }
    catch (e) { if ((e as Error).name === 'AbortError') return true; }
  }
  doc.save(nomFichier(f));
  return false;
}
