import './style.css';
import { ecartCA3, TAUX_2026, REEL_DEFAUT, retroDue, numAF, type Taux, type CalculReel } from './calc';
import { calculMois, estReel, regimeDe, REEL_DEPUIS_DEFAUT, infoUrssaf, retroDeductible, DEDUC_PAIEMENT_DEPUIS } from './regime';
import { GUIDE } from './guide';
import { renderPaiements } from './paiementsUI';
import { normaliserPaiements } from './paiements';
import { LocalRepository, normaliser, type Repository } from './repository';
import type { Donnees, Mois } from './types';
import { e0, e2, libCourt, dateFr } from './format';
import { justificatifLignes, telechargerPDF } from './pdf';

const repo: Repository = new LocalRepository();
let data: Donnees;
let cur = '';
const taux: Taux = { ...TAUX_2026 }; // modifiables dans l'UI (non persistés : à revérifier chaque 1er janvier)

const $ = <T extends HTMLElement>(s: string) => document.querySelector(s) as T;
const app = $('#app');
const vide = (): Mois => ({ caTTC: 0, retroTTC: 0, refFacture: '', cheques: [] });
const num = (s: string) => (s.trim() === '' ? 0 : Number(s.replace(',', '.')) || 0);
const moisCourant = () => new Date().toISOString().slice(0, 7);
const m = () => (data.mois[cur] ??= vide());
const save = () => { m().maj = new Date().toISOString(); repo.save(data); };

// ——— Petits composants HTML ———
const aide = (html: string) => `<details class="aide"><summary aria-label="Comment remplir ?">?</summary><div>${html}</div></details>`;
const hd = (n: string, titre: string, alt = false) => `<div class="hd"><span class="n ${alt ? 'alt' : ''}">${n}</span><h2>${titre}</h2></div>`;
const fld = (id: string, label: string, o: { eur?: boolean; full?: boolean; type?: string; mode?: string; ph?: string } = {}) =>
  `<label class="f ${o.full ? 'full' : ''}"><span>${label}</span><div class="${o.eur ? 'eur' : ''}"><input id="${id}" type="${o.type ?? 'text'}"${o.mode ? ` inputmode="${o.mode}"` : ''}${o.ph ? ` placeholder="${o.ph}"` : ''}></div></label>`;
const eur = (id: string, label: string, full = false) => fld(id, label, { eur: true, mode: 'decimal', ph: '0', full });

// ——— Textes d'aide ———
const AIDE = {
  reel1: `<p>Au réel, <b>il n'y a plus de montant à déclarer chaque mois à l'URSSAF</b> : elle prélève seule selon un échéancier calculé sur tes revenus passés, puis régularise quand elle connaît ton vrai bénéfice (déclaration de revenus de mai-juin).</p>
    <p>L'app t'indique donc ce qu'il est <b>prudent de mettre de côté</b> : une provision sur ton <b>bénéfice estimé</b> (recettes HT − rétro HT − autres charges HT).</p>
    <p><b>Provision sociale</b> : bénéfice × taux réglable (29 % par défaut, estimation validée le 12/11/2026). <b>Provision impôt</b> : (bénéfice − provision sociale) × ton taux de prélèvement à la source, à recopier depuis impots.gouv (Gérer mon prélèvement à la source) dans les réglages.</p>
    <p>Compare avec ce qui a été <b>réellement prélevé</b> (carte « Prélèvements du mois ») : la différence, c'est ce que tu devras probablement payer (ou récupérer) à la régularisation.</p>`,
  charges: `<p>Toutes tes <b>dépenses pro</b> du mois, hors rétrocession (déjà comptée) : matériel, assurance RC pro, formation, téléphone au prorata, frais bancaires, logiciel, comptable…</p>
    <p>Pour chaque facture : un <b>libellé</b>, le montant <b>HT</b> et la <b>TVA</b> indiquée sur la facture (0 si pas de TVA, ex. assurance).</p>
    <p>Effets : le HT réduit ton bénéfice (donc tes cotisations et ton impôt) ; la TVA s'ajoute à ta TVA déductible en <b>ligne 20</b> de la CA3. Garde chaque facture : elle justifie la déduction.</p>
    <p>Ne mets <b>pas</b> : tes cotisations URSSAF, ton impôt, tes dépenses perso, les virements vers ton compte perso.</p>`,
  prelev: `<p>Recopie ce qui est <b>réellement sorti</b> de ton compte ce mois-ci :</p>
    <p><b>URSSAF</b> : le prélèvement de cotisations (relevé bancaire ou espace urssaf.fr → Mes échéances).</p>
    <p><b>Impôt</b> : l'acompte de prélèvement à la source sur tes bénéfices (impots.gouv → Gérer mon prélèvement à la source), prélevé vers le 15.</p>
    <p>Ces montants servent à comparer avec tes provisions et à remplir le bilan de l'année. Les cotisations payées sont aussi une charge déductible dans ta 2035.</p>`,
  bilan: `<p>Le cumul de l'année pour les mois au réel : c'est la base de ta <b>2035</b> (déposée début mai de l'année suivante).</p>
    <p><b>À prévoir</b> = provisions − prélevés. Positif : garde cette somme de côté, une régularisation est probable. Négatif : tu as sans doute trop payé, tu pourrais récupérer de l'argent (ou moduler tes acomptes).</p>
    <p>Estimation : seule la 2035 et le calcul de l'URSSAF font foi.</p>`,
  saisie: `<p><b>Mois de la redevance</b> : le mois <i>concerné</i> par la rétrocession, pas le mois où tu la paies. Redevance d'octobre payée en novembre → choisis octobre.</p>
    <p><b>Encaissé TTC</b> : tout ce que tes clients t'ont payé ce mois-ci, TTC : CB + chèques remis en banque + virements clients. <b>Jamais</b> tes virements perso vers le compte pro (ce sont des apports, pas des recettes).</p>
    <p><b>Rétro TTC</b> : le montant TTC <i>réel</i> de l'autofacture de la SCM pour ce mois = 40 % du CA HT encaissé + TVA, soit <b>40 % de l'encaissé TTC</b>. Sa TVA (TTC ÷ 6) se déduit sur la CA3 du mois où tu la <b>paies</b>, une seule fois.</p>
    <p><b>Référence</b> : le numéro de l'autofacture, AF-AAAA-MM, numérotée par <i>mois de règlement</i> (AF-2026-11 = redevance d'octobre payée en novembre).</p>`,
  urssaf: `<p>Où : <b>autoentrepreneur.urssaf.fr</b> → Déclarer et payer → déclaration mensuelle.</p>
    <p>Dans la case <b>« Prestations de services BNC »</b>, tape le grand montant ci-dessous (ton CA <b>HT</b> du mois, arrondi à l'euro). Laisse les autres cases à 0.</p>
    <p>L'URSSAF calcule seule : cotisations 25,6 % + versement libératoire de l'impôt 2,2 % + formation 0,2 %. Le total affiché ici doit correspondre à ce qu'elle te demande. Taux 2026 : à revérifier chaque 1<sup>er</sup> janvier.</p>`,
  ca3: `<p>Où : <b>impots.gouv.fr</b> → Espace professionnel → Déclarer la TVA → CA3 mensuelle (régime réel normal, TVA sur encaissements).</p>
    <p><b>A1</b> : ventes et prestations HT du mois. <b>Ligne 08</b> : la même base HT au taux de 20 %, avec la taxe calculée.</p>
    <p><b>Ligne 20</b> : TVA déductible « autres biens et services » → la TVA de la rétro <b>payée ce mois-ci</b> (depuis nov. 2026 : la redevance du mois précédent), <b>une seule fois</b>. Novembre 2026 : 0 €, car la TVA de AF-2026-11 (254,96 €) a déjà été déduite en octobre.</p>
    <p>À déposer et payer <b>avant le 16</b> du mois suivant.</p>
    <p><b>TVA nette</b> : ce que tu paies. Si la TVA déductible dépasse la TVA collectée, c'est un crédit : rien à payer ce mois-ci.</p>`,
  retro: `<p>Ce que tu dois à la SCM pour la redevance du mois : le TTC de l'autofacture, ou le net à payer s'il y a une compensation.</p>
    <p>Montant dû = <b>40 % de l'encaissé TTC</b> du mois (40 % du CA HT + TVA). L'autofacture est numérotée par <b>mois de règlement</b>.</p>
    <p>Ajoute chaque règlement plus bas. À partir de 2027 : <b>virement</b> (plus de chèques). L'état passe à <b>Réglé ✓</b> quand le total couvre le montant.</p>`,
  justif: `<p>Document <b>interne</b> qui prouve que tu as payé la rétrocession et quelle TVA tu as déduite. Ce n'est pas une facture.</p>
    <p>Télécharge le PDF et range-le avec l'autofacture du mois, au cas où l'administration te demande de justifier la ligne 20.</p>`,
  repart: `<p>Ce que devient l'argent encaissé ce mois-ci : la part de la SCM, la TVA à reverser, l'URSSAF (impôt compris grâce au versement libératoire), et ce qui reste.</p>
    <p><b>Reste net virable</b> : ce que tu peux virer vers ton compte perso une fois tout mis de côté.</p>`,
  cheques: `<p>Un bloc par chèque donné à la SCM : <b>numéro</b>, <b>montant</b> et <b>date inscrite sur l'autofacture</b>.</p>
    <p><b>Compensation</b> : seulement si tu as acheté du matériel pour la SCM et que tu le déduis de ton paiement. Elle réduit ce que tu verses, <b>pas</b> la facture (donc pas ta TVA déductible). Laisse vide sinon.</p>`,
  ca3decl: `<p>Recopie ici ce que tu as <b>vraiment</b> déclaré sur impots.gouv (accusé de réception ou historique des déclarations). L'app compare avec son calcul.</p>
    <p><b>Écart positif</b> = tu as déclaré moins que le calcul. <b>Négatif</b> = plus. Laisse vide tant que la CA3 du mois n'est pas déposée.</p>`,
  hist: `<p>Un mois par ligne. <b>TVA payée</b> = celle de la CA3 si tu l'as saisie, sinon la TVA calculée.</p>
    <p><b>Écart CA3</b> = TVA calculée − TVA déclarée. Touche une ligne pour ouvrir ce mois.</p>`,
  reglages: `<p><b>Payeur</b>, <b>structure</b>, <b>adresse</b>, <b>SIRET</b> et <b>n° de TVA</b> apparaissent sur le justificatif.</p>
    <p><b>Mensualité URSSAF</b> : à partir de janvier 2027, le montant prélevé chaque mois (après la modulation de janvier).</p>
    <p><b>Taux</b> : modifiables pour tester, mais pas enregistrés. À revérifier chaque 1<sup>er</sup> janvier sur urssaf.fr.</p>
    <p><b>Exporter JSON</b> = sauvegarde de toutes tes données (fais-le après chaque mois). <b>Importer JSON</b> remplace tout par le fichier choisi.</p>`,
};

function shell() {
  app.innerHTML = `
  <header class="brand"><img src="./logo.png" alt="Aquatic Shape Chartrons" width="899" height="280"><h1>Comptabilité</h1><p class="tag">Mon mois en quelques chiffres</p><p><span class="chip" id="chip"></span></p></header>
  <nav class="tabs" role="tablist"><button role="tab" data-tab="compta" aria-selected="true">Compta du mois</button><button role="tab" data-tab="paie" aria-selected="false">Paiements <span id="tabdue"></span></button></nav>
  <div id="v-compta">
  <section class="card guide">${hd('i', 'Guide : EI au réel')}<p class="mut" style="margin:-4px 0 12px">Ce qui change, ce que tu fais chaque mois, ton calendrier, tes options. Touche une ligne pour la déplier.</p>${GUIDE}</section>
  <section class="card">${hd('€', 'Mon mois')}${aide(AIDE.saisie)}
    <div class="grid">
      ${fld('mois', 'Mois de la redevance', { type: 'month', full: true })}
      ${eur('ca', 'Encaissé TTC')}
      ${eur('retro', 'Rétro TTC')}
      ${fld('ref', 'Référence autofacture', { full: true, ph: 'AF-2026-11' })}
    </div>
  </section>
  <div id="res"></div>
  <div id="reel"></div>
  <section class="card">${hd('✓', 'Chèques de rétrocession', true)}${aide(AIDE.cheques)}
    <div id="chq"></div>
    <button id="addchq" style="width:100%">+ Ajouter un chèque</button>
    <div class="grid" style="margin-top:16px">
      ${eur('comp', 'Compensation')}
      ${eur('compNet', 'Net à payer')}
      ${fld('compObj', 'Objet de la compensation', { full: true, ph: 'Matériel acheté pour la SCM' })}
    </div>
  </section>
  <section class="card">${hd('≈', 'CA3 réellement déclarée', true)}${aide(AIDE.ca3decl)}
    <div class="grid">
      ${eur('c_a1', 'A1 — base')}
      ${eur('c_t08', 'Taxe ligne 08')}
      ${eur('c_ded', 'TVA déductible')}
      <label class="f"><span>Ligne utilisée</span><div><select id="c_lig"><option value="20">Ligne 20</option><option value="21">Ligne 21</option></select></div></label>
      ${eur('c_net', 'TVA nette payée (ligne 28)', true)}
    </div>
    <div class="actions"><button class="ghost" id="c_clear">Effacer la CA3 de ce mois</button></div>
  </section>
  <div id="bilan"></div>
  <div id="hist"></div>
  <section class="card">${hd('⚙', 'Données & réglages', true)}${aide(AIDE.reglages)}
    <div class="grid">
      ${fld('r_payeur', 'Payeur', { full: true, ph: 'Prénom Nom — Aquatic Shape EI' })}
      ${fld('r_struct', 'Structure (bénéficiaire)', { full: true })}
      ${fld('r_adr', 'Adresse de l\'EI', { full: true })}
      ${fld('r_siret', 'SIRET', { ph: '924 244 049 00046' })}
      ${fld('r_ape', 'Code APE', { ph: '8551Z' })}
      ${fld('r_tva', 'N° TVA intracom', { full: true, ph: 'FR…' })}
      ${eur('r_urs', 'Mensualité URSSAF (dès 2027)', true)}
    </div>
    <h3 class="sub">Régime</h3>
    <div class="grid">
      <label class="f"><span>Régime fiscal</span><div><select id="r_regime"><option value="reel">EI au réel (2035)</option><option value="micro">Micro-entreprise</option></select></div></label>
      ${fld('r_depuis', 'Au réel depuis', { type: 'month' })}
      ${fld('r_social', 'Provision sociale %', { mode: 'decimal', ph: '43' })}
      ${fld('r_pas', 'Taux PAS %', { mode: 'decimal', ph: '0' })}
    </div>
    <h3 class="sub">Taux micro (mois avant le réel)</h3>
    <div class="grid grid3">
      ${fld('t_c', 'Cotis. %', { mode: 'decimal' })}
      ${fld('t_l', 'Vers. lib. %', { mode: 'decimal' })}
      ${fld('t_f', 'Formation %', { mode: 'decimal' })}
    </div>
    <div class="actions"><button id="exp">Exporter JSON</button><button id="imp">Importer JSON</button>
    <input id="file" type="file" accept="application/json" hidden></div>
  </section>
  </div>
  <div id="v-paie" hidden></div>`;
  app.querySelectorAll<HTMLElement>('[data-tab]').forEach(b => (b.onclick = () => onglet(b.dataset.tab!)));
  $('#mois').addEventListener('change', e => { cur = (e.target as HTMLInputElement).value || cur; charger(); });
  for (const id of ['ca', 'retro', 'ref', 'comp', 'compObj', 'compNet', 'c_a1', 'c_t08', 'c_ded', 'c_lig', 'c_net', 'r_payeur', 'r_struct', 'r_adr', 'r_siret', 'r_ape', 'r_tva', 'r_urs', 't_c', 't_l', 't_f', 'r_social', 'r_pas'])
    $('#' + id).addEventListener('input', lire);
  for (const id of ['r_regime', 'r_depuis']) $('#' + id).addEventListener('change', () => { lire(); charger(); });
  $('#addchq').onclick = () => { m().cheques.push({ num: '', montant: 0, date: '' }); save(); rendreCheques(); calculer(); };
  $('#c_clear').onclick = () => { delete m().ca3; save(); charger(); };
  $('#exp').onclick = exporter;
  $('#imp').onclick = () => $('#file').click();
  $('#file').addEventListener('change', importer);
  app.addEventListener('click', e => {
    const t = e.target as HTMLElement;
    const c = t.closest<HTMLElement>('[data-copy]');
    if (c) { navigator.clipboard?.writeText(c.dataset.copy!); c.textContent = 'Copié ✓'; setTimeout(() => (c.textContent = 'Copier'), 1200); }
    const tr = t.closest<HTMLElement>('tr[data-m]');
    if (tr) { cur = tr.dataset.m!; charger(); scrollTo({ top: 0, behavior: 'smooth' }); }
  });
}

const v = (id: string) => ($('#' + id) as HTMLInputElement);
const set = (id: string, x: string | number) => (v(id).value = x === 0 ? '' : String(x));

function charger() {
  const x = m();
  v('mois').value = cur;
  set('ca', x.caTTC); set('retro', x.retroTTC); v('ref').value = x.refFacture;
  set('comp', x.compensation?.montant ?? 0); v('compObj').value = x.compensation?.objet ?? ''; set('compNet', x.compensation?.netAPayer ?? 0);
  const c = x.ca3;
  set('c_a1', c?.a1 ?? 0); set('c_t08', c?.tva08 ?? 0); set('c_ded', c?.deduc ?? 0); v('c_lig').value = c?.ligne ?? '20'; v('c_net').value = c ? String(c.net) : '';
  v('r_payeur').value = data.reglages.payeur ?? ''; v('r_struct').value = data.reglages.structure; v('r_adr').value = data.reglages.adresse;
  const R = data.reglages;
  v('r_siret').value = R.siret ?? ''; v('r_ape').value = R.ape ?? ''; v('r_tva').value = R.tvaIntra ?? ''; set('r_urs', R.urssafMensuel ?? 0);
  v('r_regime').value = R.regime ?? 'reel'; v('r_depuis').value = R.reelDepuis || REEL_DEPUIS_DEFAUT;
  v('r_social').value = R.tauxSocial === undefined ? '' : String(+(R.tauxSocial * 100).toFixed(2));
  v('r_pas').value = R.tauxPAS === undefined ? '' : String(+(R.tauxPAS * 100).toFixed(2));
  set('t_c', +(taux.cotisations * 100).toFixed(2)); set('t_l', +(taux.liberatoire * 100).toFixed(2)); set('t_f', +(taux.formation * 100).toFixed(2));
  rendreCheques(); rendreReel(); calculer();
}

function lire() {
  const x = m();
  x.caTTC = num(v('ca').value); x.retroTTC = num(v('retro').value); x.refFacture = v('ref').value.trim();
  const cm = num(v('comp').value);
  if (cm > 0) x.compensation = { montant: cm, objet: v('compObj').value, netAPayer: num(v('compNet').value) || x.retroTTC - cm };
  else delete x.compensation;
  if (v('c_net').value.trim() !== '' || v('c_a1').value.trim() !== '')
    x.ca3 = { a1: num(v('c_a1').value), tva08: num(v('c_t08').value), deduc: num(v('c_ded').value), ligne: v('c_lig').value.trim() === '21' ? '21' : '20', net: num(v('c_net').value) };
  const R = data.reglages;
  data.reglages.payeur = v('r_payeur').value; data.reglages.structure = v('r_struct').value; data.reglages.adresse = v('r_adr').value;
  R.siret = v('r_siret').value.trim() || undefined; R.ape = v('r_ape').value.trim() || undefined; R.tvaIntra = v('r_tva').value.trim() || undefined; R.urssafMensuel = num(v('r_urs').value) || undefined;
  R.regime = v('r_regime').value as 'micro' | 'reel'; R.reelDepuis = v('r_depuis').value || REEL_DEPUIS_DEFAUT;
  if (v('r_social').value.trim()) R.tauxSocial = num(v('r_social').value) / 100; else delete R.tauxSocial;
  if (v('r_pas').value.trim()) R.tauxPAS = num(v('r_pas').value) / 100; else delete R.tauxPAS;
  taux.cotisations = num(v('t_c').value) / 100; taux.liberatoire = num(v('t_l').value) / 100; taux.formation = num(v('t_f').value) / 100;
  save(); calculer();
}

function rendreCheques() {
  $('#chq').innerHTML = m().cheques.map((q, i) => `<div class="chq">
    <input class="num" data-i="${i}" data-f="num" placeholder="N° chèque" inputmode="numeric" value="${q.num}">
    <div class="mt eur"><input data-i="${i}" data-f="montant" inputmode="decimal" placeholder="Montant" value="${q.montant || ''}"></div>
    <input class="date" data-i="${i}" data-f="date" type="date" value="${q.date}">
    <button data-del="${i}" aria-label="Supprimer">✕</button></div>`).join('') || '<p class="mut" style="margin:0 0 10px">Aucun chèque pour ce mois.</p>';
  $('#chq').querySelectorAll<HTMLInputElement>('input').forEach(el => el.addEventListener('input', () => {
    const q = m().cheques[+el.dataset.i!]; const f = el.dataset.f!;
    if (f === 'montant') q.montant = num(el.value); else (q as any)[f] = el.value;
    save(); calculer();
  }));
  $('#chq').querySelectorAll<HTMLElement>('[data-del]').forEach(b => (b.onclick = () => { m().cheques.splice(+b.dataset.del!, 1); save(); rendreCheques(); calculer(); }));
}

const cp = (t: string) => `<button class="sm" data-copy="${t}">Copier</button>`;
const row = (l: string, val: string, copy?: string, cls = '') => `<div class="row ${cls}"><span>${l}</span><span class="v"><b>${val}</b>${copy ? cp(copy) : ''}</span></div>`;
const code = (c: string) => `<span class="code">${c}</span>`;
const kpi = (label: string, val: string, copy?: string, cls = '') => `<div class="kpi ${cls}"><div><small>${label}</small><strong>${val}</strong></div>${copy ? cp(copy) : ''}</div>`;

function calculer() {
  const x = m(); const c = calculMois(cur, x, data.reglages, taux, data.mois);
  const reel = estReel(c);
  $('#chip').textContent = reel ? 'EI au réel · BNC · ' + libCourt(cur) : 'Micro-entreprise · ' + libCourt(cur);
  const regle = x.cheques.reduce((s, q) => s + q.montant, 0);
  const aPayer = x.compensation?.netAPayer ?? x.retroTTC;
  const reste = aPayer - regle;
  const autresTTC = (x.charges ?? []).reduce((s, q) => s + (q.ht || 0) + (q.tva || 0), 0);
  const part: [string, number, string][] = reel
    ? [['Rétro', x.retroTTC, 'var(--c1)'], ['Charges', autresTTC, 'var(--c5)'], ['TVA', c.tvaPay, 'var(--c2)'], ['Social', c.provSocial, 'var(--c3)'], ['Impôt', c.provImpot, 'var(--c6)'], ['Reste', Math.max(0, c.reste), 'var(--c4)']]
    : [['Rétro', x.retroTTC, 'var(--c1)'], ['TVA', c.tvaPay, 'var(--c2)'], ['URSSAF', c.urssaf, 'var(--c3)'], ['Reste', Math.max(0, c.reste), 'var(--c4)']];
  const tot = part.reduce((s, p) => s + p[1], 0) || 1;
  const ec = ecartCA3(c, x.ca3);
  const msgEcart = ec === null ? '' : ec === 0 ? `<div class="msg ok">✓ CA3 déclarée conforme au calcul.</div>`
    : `<div class="msg warn"><b>Écart CA3 : ${ec > 0 ? `déclaré en moins de ${e0(ec)}` : `déclaré en plus de ${e0(-ec)}`}</b><br>TVA : ${e0(c.tvaPay)} calculée / ${e0(x.ca3!.net)} déclarée · Base : ${e0(c.a1)} / ${e0(x.ca3!.a1)} · Déduite : ${e0(c.l20)} / ${e0(x.ca3!.deduc)}</div>`;
  const pct = (taux.cotisations * 100).toLocaleString('fr-FR');
  $('#res').innerHTML = `
  ${reel ? carteReel(c, x) : `<section class="card">${hd('1', 'URSSAF')}${aide(AIDE.urssaf)}
    ${kpi('À taper dans « Prestations de services BNC »', e0(c.a1), String(c.a1))}
    ${row(`Cotisations (${pct} %)`, e2(c.urssafDetail.cotisations))}
    ${row('Versement libératoire', e2(c.urssafDetail.liberatoire))}
    ${row('Formation', e2(c.urssafDetail.formation))}
    ${row('Total à payer', e2(c.urssaf), undefined, 'tot')}</section>`}
  <section class="card">${hd('2', 'Déclaration de TVA (CA3)')}${aide(AIDE.ca3)}
    ${kpi('TVA nette à payer', e0(c.tvaPay), String(c.tvaPay))}
    ${row(code('A1') + 'Base HT', e0(c.a1), String(c.a1))}
    ${row(code('08') + 'Base HT 20 %', e0(c.a1), String(c.a1))}
    ${row(code('08') + 'Taxe', e0(c.tax08), String(c.tax08))}
    ${reel && c.l20Autres ? row(code('20') + 'dont piscine', e0(c.l20Retro)) + row(code('20') + 'dont autres achats', e0(c.l20Autres)) : ''}
    ${row(code('20') + 'TVA déductible', e0(c.l20), String(c.l20))}
    ${reel && cur >= (data.reglages.deducPaiementDepuis || DEDUC_PAIEMENT_DEPUIS) ? `<div class="msg">Ligne 20 = TVA de la rétro <b>payée ce mois-ci</b>${cur === (data.reglages.deducPaiementDepuis || DEDUC_PAIEMENT_DEPUIS) ? ' : 0 € ce mois, la TVA de AF-2026-11 (254,96 €) a déjà été déduite en octobre' : ` (redevance du mois précédent, ${e2(retroDeductible(cur, x, data.mois, data.reglages))} TTC)`}. À déclarer avant le 16 du mois suivant.</div>` : ''}
    ${c.credit ? `<div class="msg warn">⚠ Crédit de TVA de ${e0(-c.tvaNette)} : rien à payer ce mois-ci.</div>` : ''}
    ${msgEcart}</section>
  <section class="card">${hd('3', 'Rétrocession à la SCM')}${aide(AIDE.retro)}
    ${kpi('À payer à la SCM', e2(aPayer))}
    ${row('dont TVA (déduite au mois du paiement)', e0(Math.round(x.retroTTC / 6)))}
    ${x.compensation ? row('Compensation (matériel)', '− ' + e2(x.compensation.montant)) : ''}
    ${row('Référence', x.refFacture || '—')}
    ${row(`Montant dû (40 % de l'encaissé TTC) · ${numAF(cur)}`, e2(retroDue(x.caTTC)))}
    ${x.retroTTC && Math.abs(x.retroTTC - retroDue(x.caTTC)) > 0.05 ? `<div class="msg warn">La rétro saisie (${e2(x.retroTTC)}) diffère de 40 % de l'encaissé TTC (${e2(retroDue(x.caTTC))}).</div>` : ''}
    ${x.cheques.map(q => row(`Chèque ${q.num || '?'} · ${dateFr(q.date) || 'sans date'}`, e2(q.montant))).join('')}
    ${row('État', reste <= 0.005 ? '<span class="pill ok">Réglé ✓</span>' : `<span class="pill warn">Reste ${e2(reste)}</span>`)}</section>
  <section class="card">${hd('4', 'Justificatif de paiement')}${aide(AIDE.justif)}
    <pre>${justificatifLignes(cur, x, c, data.reglages).join('\n')}</pre>
    <div class="actions"><button class="pri" id="pdf">Télécharger le PDF</button></div></section>
  <section class="card">${hd('5', 'Répartition du mois')}${aide(AIDE.repart)}
    ${kpi(reel ? 'Reste net virable (après provisions)' : 'Reste net virable', e0(c.reste), undefined, c.reste >= 0 ? 'ok' : '')}
    <div class="bar">${part.map(p => `<div style="flex:${p[1] / tot};background:${p[2]}"></div>`).join('')}</div>
    <div class="leg">${part.map(p => `<div><i style="background:${p[2]}"></i>${p[0]}<b>${e0(p[1])}</b></div>`).join('')}</div></section>`;
  $('#pdf').onclick = () => telechargerPDF(cur, x, c, data.reglages);
  historique(); bilan();
}

function carteReel(c: CalculReel, x: Mois) {
  const R = data.reglages; const pctS = ((R.tauxSocial ?? REEL_DEFAUT.tauxSocial) * 100).toLocaleString('fr-FR');
  const pctP = ((R.tauxPAS ?? 0) * 100).toLocaleString('fr-FR');
  const prov = c.provSocial + c.provImpot;
  const preleve = (x.urssafPreleve ?? 0) + (x.pasPreleve ?? 0);
  const diff = prov - preleve;
  const iu = infoUrssaf(cur, R);
  return `<section class="card">${hd('1', 'URSSAF & impôt')}${aide(AIDE.reel1)}
    <div class="msg ${cur.startsWith('2026') ? 'ok' : ''}">${iu.texte}</div>
    ${iu.mensuel ? row('Mensualité URSSAF', e2(iu.mensuel)) : ''}
    ${kpi('À mettre de côté ce mois (estimation)', e0(prov))}
    ${row('Recettes HT', e0(c.a1))}
    ${row('− Rétrocession HT', e0(c.retroHT))}
    ${row('− Autres charges HT', e0(c.chargesHT - c.retroHT))}
    ${row('Bénéfice estimé', e0(c.benefice), undefined, 'tot')}
    ${row(`Provision sociale (${pctS} %)`, e2(c.provSocial))}
    ${row('Prélevé par l’URSSAF', x.urssafPreleve ? e2(x.urssafPreleve) : '—')}
    ${row(`Provision impôt (PAS ${pctP} %)`, e2(c.provImpot))}
    ${row('Prélevé (acompte impôt)', x.pasPreleve ? e2(x.pasPreleve) : '—')}
    ${R.tauxPAS === undefined ? '<div class="msg warn">Renseigne ton <b>taux de prélèvement à la source</b> dans les réglages (bas de page) pour estimer l’impôt.</div>' : ''}
    ${c.benefice < 0 ? '<div class="msg warn">Bénéfice négatif ce mois-ci : pas de provision. Ce sera compensé sur l’année.</div>' : ''}
    ${preleve > 0 ? (diff > 0 ? `<div class="msg warn">Tu as provisionné <b>${e0(diff)}</b> de plus que ce qui a été prélevé : garde-les de côté pour la régularisation.</div>` : `<div class="msg ok">Les prélèvements couvrent tes provisions ce mois-ci (${e0(-diff)} de marge).</div>`) : ''}
  </section>`;
}

function rendreReel() {
  const box = $('#reel');
  if (regimeDe(cur, data.reglages) !== 'reel') { box.innerHTML = ''; return; }
  const x = m(); const ch = (x.charges ??= []);
  box.innerHTML = `<section class="card">${hd('+', 'Autres charges du mois', true)}${aide(AIDE.charges)}
    <div id="chg">${ch.map((q, i) => `<div class="chg">
      <input class="lib" data-i="${i}" data-f="libelle" placeholder="Libellé (ex. Palmes, RC pro…)" value="${q.libelle.replace(/"/g, '&quot;')}">
      <div class="ht eur"><input data-i="${i}" data-f="ht" inputmode="decimal" placeholder="HT" value="${q.ht || ''}"></div>
      <div class="tv eur"><input data-i="${i}" data-f="tva" inputmode="decimal" placeholder="TVA" value="${q.tva || ''}"></div>
      <button data-delc="${i}" aria-label="Supprimer">✕</button></div>`).join('') || '<p class="mut" style="margin:0 0 10px">Aucune autre dépense pro saisie pour ce mois.</p>'}</div>
    <button id="addchg" style="width:100%">+ Ajouter une dépense</button>
    ${ch.length ? `<div class="row tot" style="margin-top:8px"><span>Total</span><span class="v"><b>${e2(ch.reduce((s, q) => s + q.ht, 0))} HT · ${e2(ch.reduce((s, q) => s + q.tva, 0))} TVA</b></span></div>` : ''}
  </section>
  <section class="card">${hd('↓', 'Prélèvements du mois', true)}${aide(AIDE.prelev)}
    <div class="grid">${eur('p_urssaf', 'Prélevé URSSAF')}${eur('p_pas', 'Acompte impôt')}</div>
  </section>`;
  set('p_urssaf', x.urssafPreleve ?? 0); set('p_pas', x.pasPreleve ?? 0);
  for (const id of ['p_urssaf', 'p_pas']) $('#' + id).addEventListener('input', () => {
    x.urssafPreleve = num(v('p_urssaf').value) || undefined; x.pasPreleve = num(v('p_pas').value) || undefined; save(); calculer();
  });
  box.querySelectorAll<HTMLInputElement>('#chg input').forEach(el => el.addEventListener('input', () => {
    const q = ch[+el.dataset.i!]; const fl = el.dataset.f as 'libelle' | 'ht' | 'tva';
    if (fl === 'libelle') q.libelle = el.value; else q[fl] = num(el.value);
    save(); calculer();
  }));
  box.querySelectorAll<HTMLElement>('[data-delc]').forEach(b => (b.onclick = () => { ch.splice(+b.dataset.delc!, 1); save(); rendreReel(); calculer(); }));
  $('#addchg').onclick = () => { ch.push({ libelle: '', ht: 0, tva: 0 }); save(); rendreReel(); calculer(); (box.querySelector('#chg .chg:last-child input') as HTMLInputElement)?.focus(); };
}

function bilan() {
  const an = cur.slice(0, 4);
  const ks = Object.keys(data.mois).filter(k => k.startsWith(an) && regimeDe(k, data.reglages) === 'reel').sort();
  if (!ks.length) { $('#bilan').innerHTML = ''; return; }
  const T = { rec: 0, retro: 0, autres: 0, ben: 0, ps: 0, pu: 0, pi: 0, pp: 0, tva: 0 };
  for (const k of ks) {
    const x = data.mois[k]; const c = calculMois(k, x, data.reglages, taux, data.mois) as CalculReel;
    T.rec += c.a1; T.retro += c.retroHT; T.autres += c.chargesHT - c.retroHT; T.ben += c.benefice;
    T.ps += c.provSocial; T.pi += c.provImpot; T.pu += x.urssafPreleve ?? 0; T.pp += x.pasPreleve ?? 0; T.tva += x.ca3 ? x.ca3.net : c.tvaPay;
  }
  const aprevoir = T.ps + T.pi - T.pu - T.pp;
  $('#bilan').innerHTML = `<section class="card">${hd('Σ', `Bilan ${an} au réel`, true)}${aide(AIDE.bilan)}
    ${kpi('Bénéfice estimé de l’année', e0(T.ben), undefined, T.ben >= 0 ? 'ok' : '')}
    ${row('Recettes HT', e0(T.rec))}
    ${row('− Rétrocession HT', e0(T.retro))}
    ${row('− Autres charges HT', e0(T.autres))}
    ${row('TVA payée (CA3)', e0(T.tva))}
    ${row('Provision sociale / prélevé URSSAF', `${e0(T.ps)} / ${e0(T.pu)}`)}
    ${row('Provision impôt / prélevé', `${e0(T.pi)} / ${e0(T.pp)}`)}
    ${row('À prévoir (provisions − prélevés)', e0(aprevoir), undefined, 'tot')}
    <p class="mut" style="margin:10px 0 0">${ks.length} mois au réel en ${an}. Base de ta 2035, à déposer début mai ${+an + 1}.</p>
  </section>`;
}

function historique() {
  const keys = Object.keys(data.mois).sort();
  const T = { ca: 0, a1: 0, tva: 0, urs: 0, ec: 0 };
  const lignes = keys.map(k => {
    const x = data.mois[k]; const c = calculMois(k, x, data.reglages, taux, data.mois);
    const tva = x.ca3 ? x.ca3.net : c.tvaPay; const ec = ecartCA3(c, x.ca3);
    T.ca += x.caTTC; T.a1 += c.a1; T.tva += tva; T.urs += c.urssaf; T.ec += ec ?? 0;
    return `<tr class="m ${k === cur ? 'sel' : ''}" data-m="${k}"><td>${libCourt(k)}${regimeDe(k, data.reglages) === 'micro' ? ' <span class="mut">µ</span>' : ''}</td><td>${e0(x.caTTC)}</td><td>${e0(c.a1)}</td><td>${e0(tva)}</td><td>${e0(c.urssaf)}</td><td class="${ec ? (ec > 0 ? 'warn' : 'ok') : ''}">${ec === null ? '—' : (ec > 0 ? '+' : '') + ec}</td></tr>`;
  }).join('');
  $('#hist').innerHTML = `<section class="card">${hd('∑', `Historique ${keys.length ? keys[0].slice(0, 4) : ''}`, true)}${aide(AIDE.hist)}<div class="scroll"><table>
    <thead><tr><th>Mois</th><th>CA TTC</th><th>A1</th><th>TVA</th><th>Social*</th><th>Écart</th></tr></thead>
    <tbody>${lignes}</tbody>
    <tfoot><tr><td>Total</td><td>${e0(T.ca)}</td><td>${e0(T.a1)}</td><td>${e0(T.tva)}</td><td>${e0(T.urs)}</td><td class="${T.ec > 0 ? 'warn' : ''}">${T.ec > 0 ? '+' : ''}${T.ec}</td></tr></tfoot></table></div><p class="mut" style="margin:10px 0 0">* Social : URSSAF micro (µ) ou provision sociale estimée au réel.</p></section>`;
}
function exporter() {
  const blob = new Blob([JSON.stringify({ _exporte_le: new Date().toISOString().slice(0, 10), ...data }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `compta-aquatic-shape-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(a.href);
}
async function importer(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return;
  try {
    const j = JSON.parse(await f.text());
    if (Array.isArray(j)) {
      const ps = normaliserPaiements(j);
      if (!confirm(`Remplacer le suivi des paiements par ce fichier (${ps.length} clientes) ? La compta n'est pas touchée.`)) return;
      data.paiements = ps; await repo.save(data); paiements(); onglet('paie');
      (e.target as HTMLInputElement).value = ''; return;
    }
    const d = normaliser(j);
    if (!confirm(`Remplacer toutes les données par ce fichier (${Object.keys(d.mois).length} mois) ?`)) return;
    data = d; await repo.save(d); cur = Object.keys(d.mois).sort().pop() ?? moisCourant(); charger(); paiements();
  } catch (err) { alert('Import impossible : ' + (err as Error).message); }
  (e.target as HTMLInputElement).value = '';
}

(async () => {
  data = await repo.load();
  cur = Object.keys(data.mois).sort().pop() ?? moisCourant();
  shell(); charger(); paiements();
  if (location.hash === '#paiements') onglet('paie');
})();

function onglet(t: string) {
  app.querySelectorAll<HTMLElement>('[data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
  $('#v-compta').hidden = t !== 'compta'; $('#v-paie').hidden = t !== 'paie';
  history.replaceState(null, '', t === 'paie' ? '#paiements' : '#');
}

function paiements() {
  const rows = data.paiements ?? [];
  const due = rows.reduce((s, p) => s + Math.max(0, p.total - p.paye), 0);
  $('#tabdue').textContent = due ? '· ' + e0(due) : '';
  renderPaiements($('#v-paie'), rows, nv => { data.paiements = nv; repo.save(data); paiements(); });
}
