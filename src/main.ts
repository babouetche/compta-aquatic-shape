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

function shell() {
  app.innerHTML = `
  <header class="brand"><img src="./logo.png" alt="Aquatic Shape Chartrons" width="899" height="280"><h1>Comptabilité</h1><p class="tag">Ton mois en quelques chiffres</p></header>
  <div class="card">
    <label>Mois de la redevance</label><input id="mois" type="month">
    <div class="grid2">
      <div><label>Encaissé TTC du mois (€)</label><input id="ca" inputmode="decimal"></div>
      <div><label>TTC autofacture rétrocession (€)</label><input id="retro" inputmode="decimal"></div>
    </div>
    <label>Référence de la facture (ex. AF-2026-11, numérotée par mois de règlement)</label><input id="ref">
  </div>
  <div id="res"></div>
  <div class="card"><h2>Chèques de rétrocession</h2><div id="chq"></div>
    <div class="actions"><button id="addchq">+ Chèque</button></div>
    <label>Compensation (€) — matériel acheté pour la SCM</label><input id="comp" inputmode="decimal">
    <label>Objet de la compensation</label><input id="compObj">
    <label>Net à payer après compensation (€)</label><input id="compNet" inputmode="decimal">
  </div>
  <div class="card"><h2>CA3 réellement déclarée</h2>
    <div class="grid2">
      <div><label>A1 (base)</label><input id="c_a1" inputmode="decimal"></div>
      <div><label>Taxe ligne 08</label><input id="c_t08" inputmode="decimal"></div>
      <div><label>TVA déductible</label><input id="c_ded" inputmode="decimal"></div>
      <div><label>Ligne (20 ou 21)</label><input id="c_lig" inputmode="numeric"></div>
    </div>
    <label>TVA nette payée (ligne 28)</label><input id="c_net" inputmode="decimal">
    <p class="mut">Laisse vide si la CA3 n'est pas encore déposée. <button class="sm" id="c_clear">Effacer la CA3</button></p>
  </div>
  <div id="hist"></div>
  <div class="card"><h2>Données &amp; réglages</h2>
    <div class="grid2">
      <div><label>Payeur (nom + EI)</label><input id="r_payeur"></div>
      <div><label>Structure (bénéficiaire)</label><input id="r_struct"></div>
      <div><label>Adresse de l'EI</label><input id="r_adr"></div>
      <div><label>Cotisations %</label><input id="t_c" inputmode="decimal"></div>
      <div><label>Vers. libératoire %</label><input id="t_l" inputmode="decimal"></div>
      <div><label>Formation %</label><input id="t_f" inputmode="decimal"></div>
    </div>
    <p class="mut">Taux 2026 : à revérifier chaque 1er janvier sur urssaf.fr. Convention : « mois » = mois de la redevance ; l'autofacture est numérotée par mois de règlement (AF-AAAA-MM).</p>
    <div class="actions"><button id="exp">Exporter JSON</button><button id="imp">Importer JSON</button>
    <input id="file" type="file" accept="application/json" hidden></div>
  </div>`;
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
  set('c_a1', c?.a1 ?? 0); set('c_t08', c?.tva08 ?? 0); set('c_ded', c?.deduc ?? 0); v('c_lig').value = c?.ligne ?? ''; v('c_net').value = c ? String(c.net) : '';
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
    <input data-i="${i}" data-f="num" placeholder="n°" value="${q.num}">
    <input data-i="${i}" data-f="montant" inputmode="decimal" placeholder="€" value="${q.montant || ''}">
    <input data-i="${i}" data-f="date" type="date" value="${q.date}">
    <button class="sm" data-del="${i}">✕</button></div>`).join('') || '<p class="mut">Aucun chèque.</p>';
  $('#chq').querySelectorAll<HTMLInputElement>('input').forEach(el => el.addEventListener('input', () => {
    const q = m().cheques[+el.dataset.i!]; const f = el.dataset.f!;
    if (f === 'montant') q.montant = num(el.value); else (q as any)[f] = el.value;
    save(); calculer();
  }));
  $('#chq').querySelectorAll<HTMLElement>('[data-del]').forEach(b => (b.onclick = () => { m().cheques.splice(+b.dataset.del!, 1); save(); rendreCheques(); calculer(); }));
}

const cp = (t: string) => `<button class="sm" data-copy="${t}">Copier</button>`;
const row = (l: string, val: string, copy?: string) => `<div class="row"><span>${l}</span><span><b>${val}</b> ${copy ? cp(copy) : ''}</span></div>`;

function calculer() {
  const x = m(); const c = calcMois(x.caTTC, x.retroTTC, taux);
  const regle = x.cheques.reduce((s, q) => s + q.montant, 0);
  const aPayer = x.compensation?.netAPayer ?? x.retroTTC;
  const reste = aPayer - regle;
  const part = [['Rétro', x.retroTTC, 'var(--c1)'], ['TVA', c.tvaPay, 'var(--c2)'], ['URSSAF', c.urssaf, 'var(--c3)'], ['Reste', Math.max(0, c.reste), 'var(--c4)']] as const;
  const tot = part.reduce((s, p) => s + p[1], 0) || 1;
  const ec = ecartCA3(c, x.ca3);
  const msgEcart = ec === null ? '' : ec === 0 ? `<p class="ok">CA3 conforme au calcul.</p>`
    : `<p class="warn">Écart CA3 : calculé ${e0(c.tvaPay)} vs déclaré ${e0(x.ca3!.net)} → ${ec > 0 ? `déclaré en moins de ${e0(ec)}` : `déclaré en plus de ${e0(-ec)}`}.<br>Base : ${e0(c.a1)} calculée vs ${e0(x.ca3!.a1)} déclarée · TVA déduite : ${e0(c.l20)} vs ${e0(x.ca3!.deduc)}.</p>`;
  $('#res').innerHTML = `
  <div class="card"><h2>1 · URSSAF</h2>
    ${row('Prestations de services BNC', e0(c.a1), String(c.a1))}
    ${row('Cotisations (' + (taux.cotisations * 100).toFixed(1) + ' %)', e2(c.urssafDetail.cotisations))}
    ${row('Versement libératoire', e2(c.urssafDetail.liberatoire))}
    ${row('Formation', e2(c.urssafDetail.formation))}
    ${row('Total URSSAF', e2(c.urssaf))}</div>
  <div class="card"><h2>2 · CA3</h2>
    ${row('A1 — base', e0(c.a1), String(c.a1))}
    ${row('Ligne 08 — base', e0(c.a1), String(c.a1))}
    ${row('Ligne 08 — taxe', e0(c.tax08), String(c.tax08))}
    ${row('Ligne 20 — TVA déductible', e0(c.l20), String(c.l20))}
    ${row('TVA nette à payer', e0(c.tvaPay), String(c.tvaPay))}
    ${c.credit ? `<p class="warn">⚠ Crédit de TVA de ${e0(-c.tvaNette)} : rien à payer ce mois-ci.</p>` : ''}
    ${msgEcart}</div>
  <div class="card"><h2>3 · Rétrocession</h2>
    ${row('À payer à la SCM', e2(aPayer))}
    ${row('dont TVA récupérée', e0(c.l20))}
    ${x.compensation ? row('Compensation (matériel)', e2(x.compensation.montant)) : ''}
    ${row('Référence facture', x.refFacture || '—')}
    ${x.cheques.map(q => row(`Chèque ${q.num || '?'} · ${dateFr(q.date)}`, e2(q.montant))).join('')}
    ${row('État', reste <= 0.005 ? '<span class="ok">Réglé ✓</span>' : `<span class="warn">Reste ${e2(reste)}</span>`)}</div>
  <div class="card"><h2>4 · Justificatif</h2>
    <pre>${justificatifLignes(cur, x, c, data.reglages).join('\n')}</pre>
    <div class="actions"><button class="pri" id="pdf">Télécharger le PDF</button></div></div>
  <div class="card"><h2>5 · Répartition du mois</h2>
    <div class="bar">${part.map(p => `<div style="width:${(p[1] / tot) * 100}%;background:${p[2]}"></div>`).join('')}</div>
    <div class="leg">${part.map(p => `<div class="row"><span><i style="background:${p[2]}"></i>${p[0]}</span><b>${e0(p[1])}</b></div>`).join('')}</div>
    <p class="big">Reste net virable : ${e0(c.reste)}</p></div>`;
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
    return `<tr class="m ${k === cur ? 'sel' : ''}" data-m="${k}"><td>${libCourt(k)}</td><td>${e0(x.caTTC)}</td><td>${e0(c.a1)}</td><td>${e0(tva)}</td><td>${e0(c.urssaf)}</td><td class="${ec ? 'warn' : ''}">${ec === null ? '—' : (ec > 0 ? '+' : '') + ec}</td></tr>`;
  }).join('');
  $('#hist').innerHTML = `<div class="card"><h2>Historique ${keys.length ? keys[0].slice(0, 4) : ''}</h2><div class="scroll"><table>
    <thead><tr><th>Mois</th><th>CA TTC</th><th>A1</th><th>TVA payée</th><th>URSSAF</th><th>Écart CA3</th></tr></thead>
    <tbody>${lignes}</tbody>
    <tfoot><tr><td>Total</td><td>${e0(T.ca)}</td><td>${e0(T.a1)}</td><td>${e0(T.tva)}</td><td>${e0(T.urs)}</td><td>${T.ec > 0 ? '+' : ''}${T.ec}</td></tr></tfoot></table></div>
    <p class="mut">Écart = TVA calculée − TVA déclarée (positif = déclaré en moins). Touche un mois pour le recharger.</p></div>`;
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
