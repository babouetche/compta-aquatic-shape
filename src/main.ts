import './style.css';
import { calcMois, ecartCA3, TAUX_2026, type Taux } from './calc';
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
  saisie: `<p><b>Mois de la redevance</b> : le mois <i>concerné</i> par la rétrocession, pas le mois où tu la paies. Redevance d'octobre payée en novembre → choisis octobre.</p>
    <p><b>Encaissé TTC</b> : tout ce que tes clients t'ont payé ce mois-ci, TTC : CB + chèques remis en banque + virements clients. <b>Jamais</b> tes virements perso vers le compte pro (ce sont des apports, pas des recettes).</p>
    <p><b>Rétro TTC</b> : le montant TTC <i>réel</i> de l'autofacture de la SCM pour ce mois. C'est lui qui donne ta TVA déductible (TTC ÷ 6).</p>
    <p><b>Référence</b> : le numéro de l'autofacture, AF-AAAA-MM, numérotée par <i>mois de règlement</i> (AF-2026-11 = redevance d'octobre payée en novembre).</p>`,
  urssaf: `<p>Où : <b>autoentrepreneur.urssaf.fr</b> → Déclarer et payer → déclaration mensuelle.</p>
    <p>Dans la case <b>« Prestations de services BNC »</b>, tape le grand montant ci-dessous (ton CA <b>HT</b> du mois, arrondi à l'euro). Laisse les autres cases à 0.</p>
    <p>L'URSSAF calcule seule : cotisations 25,6 % + versement libératoire de l'impôt 2,2 % + formation 0,2 %. Le total affiché ici doit correspondre à ce qu'elle te demande. Taux 2026 : à revérifier chaque 1<sup>er</sup> janvier.</p>`,
  ca3: `<p>Où : <b>impots.gouv.fr</b> → Espace professionnel → Déclarer la TVA → CA3 mensuelle (régime réel normal, TVA sur encaissements).</p>
    <p><b>A1</b> : ventes et prestations HT du mois. <b>Ligne 08</b> : la même base HT au taux de 20 %, avec la taxe calculée.</p>
    <p><b>Ligne 20</b> : TVA déductible « autres biens et services » → <b>uniquement</b> la TVA de la facture de la piscine (pas la ligne 21).</p>
    <p><b>TVA nette</b> : ce que tu paies. Si la TVA déductible dépasse la TVA collectée, c'est un crédit : rien à payer ce mois-ci.</p>`,
  retro: `<p>Ce que tu dois à la SCM pour la redevance du mois : le TTC de l'autofacture, ou le net à payer s'il y a une compensation.</p>
    <p>Ajoute chaque chèque plus bas (n°, montant, date du chèque). L'état passe à <b>Réglé ✓</b> quand le total des chèques couvre le montant.</p>`,
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
  reglages: `<p><b>Payeur</b>, <b>structure</b> et <b>adresse</b> apparaissent sur le justificatif.</p>
    <p><b>Taux</b> : modifiables pour tester, mais pas enregistrés. À revérifier chaque 1<sup>er</sup> janvier sur urssaf.fr.</p>
    <p><b>Exporter JSON</b> = sauvegarde de toutes tes données (fais-le après chaque mois). <b>Importer JSON</b> remplace tout par le fichier choisi.</p>`,
};

function shell() {
  app.innerHTML = `
  <header class="brand"><img src="./logo.png" alt="Aquatic Shape Chartrons" width="899" height="280"><h1>Comptabilité</h1><p class="tag">Mon mois en quelques chiffres</p></header>
  <section class="card">${hd('€', 'Mon mois')}${aide(AIDE.saisie)}
    <div class="grid">
      ${fld('mois', 'Mois de la redevance', { type: 'month', full: true })}
      ${eur('ca', 'Encaissé TTC')}
      ${eur('retro', 'Rétro TTC')}
      ${fld('ref', 'Référence autofacture', { full: true, ph: 'AF-2026-11' })}
    </div>
  </section>
  <div id="res"></div>
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
  <div id="hist"></div>
  <section class="card">${hd('⚙', 'Données & réglages', true)}${aide(AIDE.reglages)}
    <div class="grid">
      ${fld('r_payeur', 'Payeur', { full: true, ph: 'Prénom Nom — Aquatic Shape EI' })}
      ${fld('r_struct', 'Structure (bénéficiaire)', { full: true })}
      ${fld('r_adr', 'Adresse de l\'EI', { full: true })}
    </div>
    <div class="grid grid3" style="margin-top:12px">
      ${fld('t_c', 'Cotis. %', { mode: 'decimal' })}
      ${fld('t_l', 'Vers. lib. %', { mode: 'decimal' })}
      ${fld('t_f', 'Formation %', { mode: 'decimal' })}
    </div>
    <div class="actions"><button id="exp">Exporter JSON</button><button id="imp">Importer JSON</button>
    <input id="file" type="file" accept="application/json" hidden></div>
  </section>`;
  $('#mois').addEventListener('change', e => { cur = (e.target as HTMLInputElement).value || cur; charger(); });
  for (const id of ['ca', 'retro', 'ref', 'comp', 'compObj', 'compNet', 'c_a1', 'c_t08', 'c_ded', 'c_lig', 'c_net', 'r_payeur', 'r_struct', 'r_adr', 't_c', 't_l', 't_f'])
    $('#' + id).addEventListener('input', lire);
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
  set('t_c', +(taux.cotisations * 100).toFixed(2)); set('t_l', +(taux.liberatoire * 100).toFixed(2)); set('t_f', +(taux.formation * 100).toFixed(2));
  rendreCheques(); calculer();
}

function lire() {
  const x = m();
  x.caTTC = num(v('ca').value); x.retroTTC = num(v('retro').value); x.refFacture = v('ref').value.trim();
  const cm = num(v('comp').value);
  if (cm > 0) x.compensation = { montant: cm, objet: v('compObj').value, netAPayer: num(v('compNet').value) || x.retroTTC - cm };
  else delete x.compensation;
  if (v('c_net').value.trim() !== '' || v('c_a1').value.trim() !== '')
    x.ca3 = { a1: num(v('c_a1').value), tva08: num(v('c_t08').value), deduc: num(v('c_ded').value), ligne: v('c_lig').value.trim() === '21' ? '21' : '20', net: num(v('c_net').value) };
  data.reglages.payeur = v('r_payeur').value; data.reglages.structure = v('r_struct').value; data.reglages.adresse = v('r_adr').value;
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
  const x = m(); const c = calcMois(x.caTTC, x.retroTTC, taux);
  const regle = x.cheques.reduce((s, q) => s + q.montant, 0);
  const aPayer = x.compensation?.netAPayer ?? x.retroTTC;
  const reste = aPayer - regle;
  const part = [['Rétro', x.retroTTC, 'var(--c1)'], ['TVA', c.tvaPay, 'var(--c2)'], ['URSSAF', c.urssaf, 'var(--c3)'], ['Reste', Math.max(0, c.reste), 'var(--c4)']] as const;
  const tot = part.reduce((s, p) => s + p[1], 0) || 1;
  const ec = ecartCA3(c, x.ca3);
  const msgEcart = ec === null ? '' : ec === 0 ? `<div class="msg ok">✓ CA3 déclarée conforme au calcul.</div>`
    : `<div class="msg warn"><b>Écart CA3 : ${ec > 0 ? `déclaré en moins de ${e0(ec)}` : `déclaré en plus de ${e0(-ec)}`}</b><br>TVA : ${e0(c.tvaPay)} calculée / ${e0(x.ca3!.net)} déclarée · Base : ${e0(c.a1)} / ${e0(x.ca3!.a1)} · Déduite : ${e0(c.l20)} / ${e0(x.ca3!.deduc)}</div>`;
  const pct = (taux.cotisations * 100).toLocaleString('fr-FR');
  $('#res').innerHTML = `
  <section class="card">${hd('1', 'URSSAF')}${aide(AIDE.urssaf)}
    ${kpi('À taper dans « Prestations de services BNC »', e0(c.a1), String(c.a1))}
    ${row(`Cotisations (${pct} %)`, e2(c.urssafDetail.cotisations))}
    ${row('Versement libératoire', e2(c.urssafDetail.liberatoire))}
    ${row('Formation', e2(c.urssafDetail.formation))}
    ${row('Total à payer', e2(c.urssaf), undefined, 'tot')}</section>
  <section class="card">${hd('2', 'Déclaration de TVA (CA3)')}${aide(AIDE.ca3)}
    ${kpi('TVA nette à payer', e0(c.tvaPay), String(c.tvaPay))}
    ${row(code('A1') + 'Base HT', e0(c.a1), String(c.a1))}
    ${row(code('08') + 'Base HT 20 %', e0(c.a1), String(c.a1))}
    ${row(code('08') + 'Taxe', e0(c.tax08), String(c.tax08))}
    ${row(code('20') + 'TVA déductible', e0(c.l20), String(c.l20))}
    ${c.credit ? `<div class="msg warn">⚠ Crédit de TVA de ${e0(-c.tvaNette)} : rien à payer ce mois-ci.</div>` : ''}
    ${msgEcart}</section>
  <section class="card">${hd('3', 'Rétrocession à la SCM')}${aide(AIDE.retro)}
    ${kpi('À payer à la SCM', e2(aPayer))}
    ${row('dont TVA récupérée', e0(c.l20))}
    ${x.compensation ? row('Compensation (matériel)', '− ' + e2(x.compensation.montant)) : ''}
    ${row('Référence', x.refFacture || '—')}
    ${x.cheques.map(q => row(`Chèque ${q.num || '?'} · ${dateFr(q.date) || 'sans date'}`, e2(q.montant))).join('')}
    ${row('État', reste <= 0.005 ? '<span class="pill ok">Réglé ✓</span>' : `<span class="pill warn">Reste ${e2(reste)}</span>`)}</section>
  <section class="card">${hd('4', 'Justificatif de paiement')}${aide(AIDE.justif)}
    <pre>${justificatifLignes(cur, x, c, data.reglages).join('\n')}</pre>
    <div class="actions"><button class="pri" id="pdf">Télécharger le PDF</button></div></section>
  <section class="card">${hd('5', 'Répartition du mois')}${aide(AIDE.repart)}
    ${kpi('Reste net virable', e0(c.reste), undefined, c.reste >= 0 ? 'ok' : '')}
    <div class="bar">${part.map(p => `<div style="flex:${p[1] / tot};background:${p[2]}"></div>`).join('')}</div>
    <div class="leg">${part.map(p => `<div><i style="background:${p[2]}"></i>${p[0]}<b>${e0(p[1])}</b></div>`).join('')}</div></section>`;
  $('#pdf').onclick = () => telechargerPDF(cur, x, c, data.reglages);
  historique();
}

function historique() {
  const keys = Object.keys(data.mois).sort();
  const T = { ca: 0, a1: 0, tva: 0, urs: 0, ec: 0 };
  const lignes = keys.map(k => {
    const x = data.mois[k]; const c = calcMois(x.caTTC, x.retroTTC, taux);
    const tva = x.ca3 ? x.ca3.net : c.tvaPay; const ec = ecartCA3(c, x.ca3);
    T.ca += x.caTTC; T.a1 += c.a1; T.tva += tva; T.urs += c.urssaf; T.ec += ec ?? 0;
    return `<tr class="m ${k === cur ? 'sel' : ''}" data-m="${k}"><td>${libCourt(k)}</td><td>${e0(x.caTTC)}</td><td>${e0(c.a1)}</td><td>${e0(tva)}</td><td>${e0(c.urssaf)}</td><td class="${ec ? (ec > 0 ? 'warn' : 'ok') : ''}">${ec === null ? '—' : (ec > 0 ? '+' : '') + ec}</td></tr>`;
  }).join('');
  $('#hist').innerHTML = `<section class="card">${hd('∑', `Historique ${keys.length ? keys[0].slice(0, 4) : ''}`, true)}${aide(AIDE.hist)}<div class="scroll"><table>
    <thead><tr><th>Mois</th><th>CA TTC</th><th>A1</th><th>TVA</th><th>URSSAF</th><th>Écart</th></tr></thead>
    <tbody>${lignes}</tbody>
    <tfoot><tr><td>Total</td><td>${e0(T.ca)}</td><td>${e0(T.a1)}</td><td>${e0(T.tva)}</td><td>${e0(T.urs)}</td><td class="${T.ec > 0 ? 'warn' : ''}">${T.ec > 0 ? '+' : ''}${T.ec}</td></tr></tfoot></table></div></section>`;
}
function exporter() {
  const blob = new Blob([JSON.stringify({ _exporte_le: new Date().toISOString().slice(0, 10), ...data }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `compta-aquatic-shape-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(a.href);
}
async function importer(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return;
  try {
    const d = normaliser(JSON.parse(await f.text()));
    if (!confirm(`Remplacer toutes les données par ce fichier (${Object.keys(d.mois).length} mois) ?`)) return;
    data = d; await repo.save(d); cur = Object.keys(d.mois).sort().pop() ?? moisCourant(); charger();
  } catch (err) { alert('Import impossible : ' + (err as Error).message); }
  (e.target as HTMLInputElement).value = '';
}

(async () => {
  data = await repo.load();
  cur = Object.keys(data.mois).sort().pop() ?? moisCourant();
  shell(); charger();
})();
