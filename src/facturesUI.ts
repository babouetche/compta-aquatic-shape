import { type Facture, type LigneFacture, type Prestation, PRESTATIONS_DEFAUT, totaux, htUnitaire, nouvelleFacture, numeroPris, trierFactures, ttcLigne } from './factures';
import { type Paiement, type Moyen, MOYENS, aujourdhui } from './paiements';
import type { Reglages } from './types';
import { telechargerFacture, partagerFacture, lignePaiement, nomLegal } from './pdfFacture';
import { e2, libMois } from './format';

export interface CtxFactures {
  factures: Facture[];
  reglages: Reglages;
  paiements: Paiement[];
  commit: (fs: Facture[]) => void;
  commitReglages: () => void;
  lierVersement: (paiementId: string, versementId: string, factureId: string | undefined) => void;
}

const esc = (s = '') => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const dfr = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '');
const optMoyens = (sel?: Moyen) => (Object.keys(MOYENS) as Moyen[]).map(m => `<option value="${m}"${m === sel ? ' selected' : ''}>${MOYENS[m]}</option>`).join('');
const n = (s: string) => Number(String(s).replace(',', '.')) || 0;

let mode: 'liste' | 'edit' | 'voir' = 'liste';
let brouillon: Facture | null = null;
let estNouvelle = false;
let vue: string | null = null;
let msg = '';

const AIDE = `<p><b>Créer une facture en 3 gestes</b> : « Nouvelle facture » → choisis la cliente (le nom se complète tout seul) → touche une prestation. Le numéro, la date et la TVA se remplissent seuls.</p>
  <p>Depuis l'onglet <b>Paiements</b>, le bouton <b>Facturer</b> d'un versement prépare la facture déjà remplie et « acquittée ».</p>
  <p><b>Prix TTC</b> : tu saisis le prix payé par la cliente ; l'app calcule le HT et la TVA 20 % (390 € TTC = 325 € HT + 65 € de TVA).</p>
  <p><b>Partager</b> ouvre la feuille de partage de l'iPhone (Mail, Messages, WhatsApp…) avec le PDF.</p>
  <p><b>Numérotation</b> : AAAAMM-N, chronologique et sans trou. Ne supprime pas une facture déjà envoyée : en cas d'erreur, fais une facture d'avoir (montant négatif) qui l'annule.</p>
  <p>Tes mentions légales (nom + « EI », adresse, SIRET, APE, n° de TVA) viennent des réglages : vérifie-les une fois.</p>`;

export function ouvrirBrouillon(f: Facture) { brouillon = structuredClone(f); estNouvelle = true; mode = 'edit'; msg = ''; }
export function ouvrirFacture(id: string) { vue = id; mode = 'voir'; msg = ''; }

export function renderFactures(root: HTMLElement, ctx: CtxFactures) {
  if (mode === 'edit' && brouillon) return editeur(root, ctx);
  if (mode === 'voir' && vue && ctx.factures.some(f => f.id === vue)) return apercu(root, ctx);
  mode = 'liste'; liste(root, ctx);
}

const prestations = (r: Reglages): Prestation[] => r.prestations?.length ? r.prestations : PRESTATIONS_DEFAUT;

function manques(r: Reglages) {
  return [!r.payeur && 'ton nom', !r.adresse && 'ton adresse', !r.siret && 'ton SIRET', !r.tvaIntra && 'ton n° de TVA'].filter(Boolean) as string[];
}

// ——— Liste ———
function liste(root: HTMLElement, ctx: CtxFactures) {
  const fs = trierFactures(ctx.factures);
  const mois = aujourdhui().slice(0, 7);
  const duMois = fs.filter(f => f.date.startsWith(mois));
  const groupes = new Map<string, Facture[]>();
  for (const f of fs) { const k = f.date.slice(0, 7); groupes.set(k, [...(groupes.get(k) ?? []), f]); }
  const R = ctx.reglages; const mq = manques(R);

  root.innerHTML = `
  <header class="vt"><h1>Factures</h1><p>Crée, envoie et retrouve tes factures</p></header>
  <button class="cta" id="f-new"><span>+</span> Nouvelle facture</button>
  ${!ctx.factures.length && !R.factureProchain ? '<div class="msg warn">Première facture dans l’app : indique le numéro qui suit ta dernière facture faite ailleurs (ex. 16 si c’était la 202610-15) dans <b>Réglages des factures</b>, en bas de cet onglet. Sinon la numérotation repartira à 1.</div>' : ''}
  ${mq.length ? `<div class="msg warn">Il manque ${mq.join(', ')} pour des factures conformes : complète-les dans <b>Plus › Réglages</b>.</div>` : ''}
  <section class="card">
    <div class="hd"><span class="n">#</span><h2>Ce mois-ci</h2></div>
    <details class="aide"><summary aria-label="Comment ça marche ?">?</summary><div>${AIDE}</div></details>
    <div class="stats stats2">
      <div class="stat"><small>Factures</small><strong>${duMois.length}</strong></div>
      <div class="stat"><small>Total TTC</small><strong>${e2(duMois.reduce((s, f) => s + totaux(f).ttc, 0))}</strong></div>
    </div>
  </section>
  ${fs.length ? [...groupes].map(([k, l]) => `<section class="card flist"><h3 class="sub" style="margin-top:0">${libMois(k)}</h3>
    ${l.map(f => { const t = totaux(f); return `<button class="fi" data-voir="${f.id}">
      <span class="fi-n">${esc(f.numero)}</span>
      <span class="fi-c"><b>${esc(f.client.nom || '—')}</b><small>${dfr(f.date)} · ${esc(f.lignes[0]?.designation ?? '')}${f.lignes.length > 1 ? ` +${f.lignes.length - 1}` : ''}</small></span>
      <span class="fi-m"><b>${e2(t.ttc)}</b><span class="pill ${f.acquittee ? 'ok' : 'warn'}">${f.acquittee ? 'Payée' : 'À payer'}</span></span></button>`; }).join('')}
  </section>`).join('') : '<div class="card empty">Aucune facture pour l\'instant. Touche « Nouvelle facture », ou « Facturer » sur un versement dans l\'onglet Paiements.</div>'}
  <section class="card">
    <details class="infos"><summary>Réglages des factures</summary>
      <div class="ident"><b>${esc(nomLegal(R))}</b><br>${esc(R.nomCommercial || 'Aquatic Shape')} · ${esc(R.adresse || 'adresse ?')}<br>SIRET ${esc(R.siret || '?')} · APE ${esc(R.ape || '?')} · TVA ${esc(R.tvaIntra || '?')}<br><span class="mut">Nom, adresse, SIRET, APE et TVA : à modifier dans Plus › Réglages.</span></div>
      <div class="grid">
        <label class="f full"><span>Nom commercial</span><div><input id="fr-nc" value="${esc(R.nomCommercial ?? 'Aquatic Shape')}"></div></label>
        <label class="f"><span>E-mail pro</span><div><input id="fr-mail" type="email" value="${esc(R.emailPro)}"></div></label>
        <label class="f"><span>Téléphone</span><div><input id="fr-tel" type="tel" value="${esc(R.telPro)}"></div></label>
        <label class="f full"><span>Prochain n° (après AAAAMM-)</span><div><input id="fr-num" inputmode="numeric" value="${R.factureProchain ?? ''}" placeholder="ex. 16 si ta dernière était 202610-15"></div></label>
      </div>
      <h3 class="sub">Prestations proposées en un tap</h3>
      <div id="fr-pr">${prestations(R).map((p, i) => `<div class="pr"><input data-pd="${i}" value="${esc(p.designation)}"><div class="eur"><input data-pp="${i}" inputmode="decimal" value="${p.puTTC}"></div><button class="sm ghost x" data-pdel="${i}" aria-label="Supprimer">✕</button></div>`).join('')}</div>
      <div class="actions"><button id="fr-padd">+ Prestation</button><button class="pri" id="fr-save">Enregistrer</button></div>
    </details>
  </section>`;

  const $ = <T extends HTMLElement>(s: string) => root.querySelector(s) as T;
  $('#f-new').onclick = () => { ouvrirBrouillon(nouvelleFacture(ctx.factures, {}, R.factureProchain)); renderFactures(root, ctx); scrollTo(0, 0); };
  root.querySelectorAll<HTMLElement>('[data-voir]').forEach(b => (b.onclick = () => { ouvrirFacture(b.dataset.voir!); renderFactures(root, ctx); scrollTo(0, 0); }));
  let pr = prestations(R).map(p => ({ ...p }));
  const lirePr = () => { pr = pr.map((p, i) => ({ designation: (root.querySelector<HTMLInputElement>(`[data-pd="${i}"]`)?.value ?? p.designation).trim(), puTTC: n(root.querySelector<HTMLInputElement>(`[data-pp="${i}"]`)?.value ?? String(p.puTTC)) })); };
  const enregistrer = () => {
    lirePr();
    R.nomCommercial = $<HTMLInputElement>('#fr-nc').value.trim() || undefined;
    R.emailPro = $<HTMLInputElement>('#fr-mail').value.trim() || undefined;
    R.telPro = $<HTMLInputElement>('#fr-tel').value.trim() || undefined;
    R.factureProchain = n($<HTMLInputElement>('#fr-num').value) || undefined;
    R.prestations = pr.filter(p => p.designation);
    ctx.commitReglages();
  };
  $('#fr-padd').onclick = () => { enregistrer(); R.prestations = [...(R.prestations ?? []), { designation: '', puTTC: 0 }]; ctx.commitReglages(); liste(root, ctx); root.querySelector<HTMLDetailsElement>('details.infos')!.open = true; };
  root.querySelectorAll<HTMLElement>('[data-pdel]').forEach(b => (b.onclick = () => { enregistrer(); R.prestations = (R.prestations ?? []).filter((_, i) => i !== +b.dataset.pdel!); ctx.commitReglages(); liste(root, ctx); root.querySelector<HTMLDetailsElement>('details.infos')!.open = true; }));
  $('#fr-save').onclick = () => { enregistrer(); liste(root, ctx); };
}

// ——— Éditeur ———
function editeur(root: HTMLElement, ctx: CtxFactures) {
  const f = brouillon!; const R = ctx.reglages;
  const clients = [...new Set([...ctx.paiements.map(p => p.nom), ...ctx.factures.map(x => x.client.nom)].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
  const dup = numeroPris(ctx.factures, f.numero, f.id);
  root.innerHTML = `
  <header class="vt vt-row"><button class="back" id="fe-back" aria-label="Retour">‹</button><div><h1>${estNouvelle ? 'Nouvelle facture' : 'Modifier'}</h1><p>N° ${esc(f.numero)}</p></div></header>
  ${msg ? `<div class="msg warn">${msg}</div>` : ''}
  <section class="card">
    <div class="hd"><span class="n">1</span><h2>Cliente</h2></div>
    <div class="grid">
      <label class="f full"><span>Nom</span><div><input id="fe-nom" list="fe-cl" value="${esc(f.client.nom)}" placeholder="Prénom Nom" autocomplete="off"></div></label>
      <datalist id="fe-cl">${clients.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
      <label class="f full"><span>E-mail (facultatif)</span><div><input id="fe-mail" type="email" inputmode="email" value="${esc(f.client.email)}"></div></label>
      <label class="f full"><span>Adresse (facultatif)</span><div><input id="fe-adr" value="${esc(f.client.adresse)}"></div></label>
    </div>
  </section>
  <section class="card">
    <div class="hd"><span class="n">2</span><h2>Prestations</h2></div>
    <div class="chips pick">${prestations(R).map((p, i) => `<button data-pick="${i}"><b>${esc(p.designation)}</b><span>${e2(p.puTTC)}</span></button>`).join('')}<button data-pick="libre"><b>Ligne libre</b><span>+</span></button></div>
    <div id="fe-l">${f.lignes.map((l, i) => ligne(l, i, f.tauxTVA)).join('') || '<p class="mut" style="margin:10px 0 0">Touche une prestation ci-dessus pour l\'ajouter.</p>'}</div>
    <div class="tots" id="fe-tot">${totHTML(f)}</div>
  </section>
  <section class="card">
    <div class="hd"><span class="n">3</span><h2>Date & paiement</h2></div>
    <div class="grid">
      <label class="f"><span>Date</span><div><input id="fe-date" type="date" value="${f.date}"></div></label>
      <label class="f"><span>N° de facture</span><div><input id="fe-num" value="${esc(f.numero)}"></div></label>
    </div>
    ${dup ? '<div class="msg warn">Ce numéro existe déjà.</div>' : ''}
    ${!ctx.factures.length && !R.factureProchain ? '<div class="msg warn">Vérifie le numéro : il doit suivre ta dernière facture faite hors de l’app.</div>' : ''}
    <label class="switch"><input type="checkbox" id="fe-paye"${f.acquittee ? ' checked' : ''}><span></span>Déjà payée (facture acquittée)</label>
    <div class="grid" id="fe-pz"${f.acquittee ? '' : ' hidden'}>
      <label class="f"><span>Payée le</span><div><input id="fe-pd" type="date" value="${f.acquittee?.date ?? f.date}"></div></label>
      <label class="f"><span>Moyen</span><div><select id="fe-pm">${optMoyens(f.acquittee?.moyen ?? 'cheque')}</select></div></label>
      <label class="f full"><span>N° de chèque / réf. (facultatif)</span><div><input id="fe-pr" value="${esc(f.acquittee?.ref)}"></div></label>
    </div>
    <label class="f full" style="margin-top:12px"><span>Note sur la facture (facultatif)</span><div><input id="fe-note" value="${esc(f.notes)}" placeholder="ex. Paiement en 3 fois : 2e versement"></div></label>
  </section>
  <div class="bar-save"><button class="ghost" id="fe-cancel">Annuler</button><button class="pri" id="fe-ok">${estNouvelle ? 'Créer la facture' : 'Enregistrer'}</button></div>`;

  const $ = <T extends HTMLElement>(s: string) => root.querySelector(s) as T;
  const val = (id: string) => $<HTMLInputElement>('#' + id).value;
  const lire = () => {
    f.client = { nom: val('fe-nom').trim(), email: val('fe-mail').trim() || undefined, adresse: val('fe-adr').trim() || undefined };
    f.date = val('fe-date') || aujourdhui(); f.numero = val('fe-num').trim();
    f.notes = val('fe-note').trim() || undefined;
    f.acquittee = $<HTMLInputElement>('#fe-paye').checked ? { date: val('fe-pd') || f.date, moyen: val('fe-pm') as Moyen, ref: val('fe-pr').trim() || undefined } : undefined;
    root.querySelectorAll<HTMLInputElement>('[data-li]').forEach(el => {
      const l = f.lignes[+el.dataset.li!]; const k = el.dataset.k as keyof LigneFacture;
      if (k === 'designation') l.designation = el.value; else (l as any)[k] = n(el.value);
    });
  };
  const again = () => { lire(); editeur(root, ctx); };
  const majTot = () => { lire(); $('#fe-tot').innerHTML = totHTML(f); root.querySelectorAll<HTMLElement>('[data-ttc]').forEach(e => { e.textContent = e2(ttcLigne(f.lignes[+e.dataset.ttc!])); }); };

  $('#fe-nom').addEventListener('change', () => {
    const p = ctx.paiements.find(x => x.nom === val('fe-nom').trim());
    const prev = trierFactures(ctx.factures).find(x => x.client.nom === val('fe-nom').trim());
    if (!val('fe-mail')) $<HTMLInputElement>('#fe-mail').value = p?.email ?? prev?.client.email ?? '';
    if (!val('fe-adr')) $<HTMLInputElement>('#fe-adr').value = prev?.client.adresse ?? '';
  });
  root.querySelectorAll<HTMLElement>('[data-pick]').forEach(b => (b.onclick = () => {
    lire();
    const k = b.dataset.pick!;
    f.lignes.push(k === 'libre' ? { designation: '', qte: 1, puTTC: 0 } : { ...prestations(R)[+k], qte: 1 });
    editeur(root, ctx);
    if (k === 'libre') root.querySelector<HTMLInputElement>('#fe-l .lf:last-child [data-k="designation"]')?.focus();
  }));
  root.querySelectorAll<HTMLInputElement>('[data-li]').forEach(el => (el.oninput = majTot));
  root.querySelectorAll<HTMLElement>('[data-ldel]').forEach(b => (b.onclick = () => { lire(); f.lignes.splice(+b.dataset.ldel!, 1); editeur(root, ctx); }));
  $('#fe-paye').onchange = () => { $('#fe-pz').hidden = !$<HTMLInputElement>('#fe-paye').checked; };
  $('#fe-date').onchange = () => {
    if (estNouvelle && /^\d{6}-\d+$/.test(val('fe-num'))) $<HTMLInputElement>('#fe-num').value = val('fe-date').slice(0, 4) + val('fe-date').slice(5, 7) + val('fe-num').slice(6);
  };
  $('#fe-num').onchange = again;
  const fermer = () => { mode = vue && !estNouvelle ? 'voir' : 'liste'; brouillon = null; msg = ''; renderFactures(root, ctx); scrollTo(0, 0); };
  $('#fe-back').onclick = fermer; $('#fe-cancel').onclick = fermer;
  $('#fe-ok').onclick = () => {
    lire();
    const lignes = f.lignes.filter(l => l.designation.trim() || l.puTTC);
    const pb = !f.client.nom ? 'Indique le nom de la cliente.' : !lignes.length ? 'Ajoute au moins une prestation.' : !f.numero ? 'Indique un numéro de facture.' : numeroPris(ctx.factures, f.numero, f.id) ? `Le numéro ${esc(f.numero)} est déjà utilisé.` : '';
    if (pb) { msg = pb; editeur(root, ctx); scrollTo(0, 0); return; }
    f.lignes = lignes;
    const existe = ctx.factures.some(x => x.id === f.id);
    const fs = existe ? ctx.factures.map(x => (x.id === f.id ? f : x)) : [...ctx.factures, f];
    if (!existe) { const m = /-(\d+)$/.exec(f.numero); if (m && (R.factureProchain ?? 0) <= +m[1]) { R.factureProchain = +m[1] + 1; ctx.commitReglages(); } }
    if (f.lien) ctx.lierVersement(f.lien.paiementId, f.lien.versementId, f.id);
    ctx.commit(fs);
    vue = f.id; mode = 'voir'; brouillon = null; estNouvelle = false; msg = '';
    renderFactures(root, ctx); scrollTo(0, 0);
  };
}

const ligne = (l: LigneFacture, i: number, taux: number) => `<div class="lf">
  <input data-li="${i}" data-k="designation" value="${esc(l.designation)}" placeholder="Désignation" aria-label="Désignation">
  <div class="lf-n"><label><span>Qté</span><input data-li="${i}" data-k="qte" inputmode="decimal" value="${l.qte}"></label>
  <label><span>Prix TTC</span><div class="eur"><input data-li="${i}" data-k="puTTC" inputmode="decimal" value="${l.puTTC || ''}" placeholder="0"></div></label>
  <span class="lf-t"><small>Total</small><b data-ttc="${i}">${e2(ttcLigne(l))}</b><small>${e2(htUnitaire(l, taux))} HT/u</small></span>
  <button class="sm ghost x" data-ldel="${i}" aria-label="Retirer la ligne">✕</button></div></div>`;

const totHTML = (f: Facture) => { const t = totaux(f); return `<div><span>Total HT</span><b>${e2(t.ht)}</b></div><div><span>TVA ${Math.round(f.tauxTVA * 100)} %</span><b>${e2(t.tva)}</b></div><div class="ttc"><span>Total TTC</span><b>${e2(t.ttc)}</b></div>`; };

// ——— Aperçu ———
function apercu(root: HTMLElement, ctx: CtxFactures) {
  const f = ctx.factures.find(x => x.id === vue)!; const R = ctx.reglages; const t = totaux(f);
  root.innerHTML = `
  <header class="vt vt-row"><button class="back" id="fv-back" aria-label="Retour">‹</button><div><h1>Facture ${esc(f.numero)}</h1><p>${esc(f.client.nom)} · ${e2(t.ttc)}</p></div></header>
  <div class="fact-actions"><button class="pri" id="fv-share">Partager</button><button id="fv-pdf">PDF</button><button id="fv-edit">Modifier</button></div>
  <article class="paper" aria-label="Aperçu de la facture">
    <div class="pp-top"><img src="./logo.png" alt="" width="899" height="280"><div class="pp-ttl"><b>FACTURE</b><span>N° ${esc(f.numero)}</span><span>Date : ${dfr(f.date)}</span></div></div>
    <div class="pp-parties">
      <div><b>${esc(nomLegal(R))}</b><span>${esc(R.nomCommercial || 'Aquatic Shape')} — Entrepreneur individuel</span>${R.adresse ? `<span>${esc(R.adresse)}</span>` : ''}${R.siret ? `<span>SIRET ${esc(R.siret)}${R.ape ? ` · APE ${esc(R.ape)}` : ''}</span>` : ''}${R.tvaIntra ? `<span>TVA ${esc(R.tvaIntra)}</span>` : ''}</div>
      <div class="pp-cl"><small>FACTURÉ À</small><b>${esc(f.client.nom)}</b>${f.client.adresse ? `<span>${esc(f.client.adresse)}</span>` : ''}${f.client.email ? `<span>${esc(f.client.email)}</span>` : ''}</div>
    </div>
    <table class="pp-t"><thead><tr><th>Désignation</th><th>Qté</th><th>PU HT</th><th>Total HT</th></tr></thead>
      <tbody>${f.lignes.map(l => `<tr><td>${esc(l.designation)}</td><td>${l.qte}</td><td>${e2(htUnitaire(l, f.tauxTVA))}</td><td>${e2(Math.round((ttcLigne(l) / (1 + f.tauxTVA)) * 100) / 100)}</td></tr>`).join('')}</tbody></table>
    <div class="pp-tot"><div><span>Total HT</span><b>${e2(t.ht)}</b></div><div><span>TVA ${Math.round(f.tauxTVA * 100)} %</span><b>${e2(t.tva)}</b></div><div class="ttc"><span>Total TTC</span><b>${e2(t.ttc)}</b></div></div>
    <p class="pp-pay ${f.acquittee ? 'ok' : ''}">${esc(lignePaiement(f))}</p>
    ${f.notes ? `<p class="pp-note">${esc(f.notes)}</p>` : ''}
  </article>
  <section class="card">
    ${f.acquittee ? '' : `<div class="grid"><label class="f"><span>Payée le</span><div><input id="fv-pd" type="date" value="${aujourdhui()}"></div></label><label class="f"><span>Moyen</span><div><select id="fv-pm">${optMoyens('cheque')}</select></div></label></div><div class="actions"><button id="fv-paid">Marquer comme payée</button></div>`}
    <div class="actions"><button id="fv-dup">Dupliquer</button><button class="ghost warn" id="fv-del">Supprimer</button></div>
  </section>`;

  const $ = <T extends HTMLElement>(s: string) => root.querySelector(s) as T;
  $('#fv-back').onclick = () => { mode = 'liste'; vue = null; renderFactures(root, ctx); scrollTo(0, 0); };
  $('#fv-share').onclick = async () => { $('#fv-share').textContent = 'Préparation…'; await partagerFacture(f, R); $('#fv-share').textContent = 'Partager'; };
  $('#fv-pdf').onclick = () => telechargerFacture(f, R);
  $('#fv-edit').onclick = () => { brouillon = structuredClone(f); estNouvelle = false; mode = 'edit'; renderFactures(root, ctx); scrollTo(0, 0); };
  $('#fv-dup').onclick = () => {
    const d = nouvelleFacture(ctx.factures, { client: { ...f.client }, lignes: f.lignes.map(l => ({ ...l })), notes: f.notes }, R.factureProchain);
    ouvrirBrouillon(d); renderFactures(root, ctx); scrollTo(0, 0);
  };
  $('#fv-paid')?.addEventListener('click', () => {
    ctx.commit(ctx.factures.map(x => (x.id === f.id ? { ...x, acquittee: { date: $<HTMLInputElement>('#fv-pd').value || aujourdhui(), moyen: $<HTMLSelectElement>('#fv-pm').value as Moyen } } : x)));
    renderFactures(root, ctx);
  });
  $('#fv-del').onclick = () => {
    if (!confirm(`Supprimer la facture ${f.numero} ?\n\nÀ ne faire que pour une erreur jamais envoyée : une facture émise se corrige par une facture d'avoir, pour garder une numérotation sans trou.`)) return;
    if (f.lien) ctx.lierVersement(f.lien.paiementId, f.lien.versementId, undefined);
    ctx.commit(ctx.factures.filter(x => x.id !== f.id)); mode = 'liste'; vue = null; renderFactures(root, ctx);
  };
}
