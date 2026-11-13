import {
  type Paiement, type Moyen, MOYENS, MOYENS_COURTS, reste, solde, resume, payeTotal, ajouterVersement, supprimerVersement,
  ajouterSeances, trier, seancesCouvertes, encaisseDuMois, nouveauPaiement, slug, aujourdhui, rangVersement,
} from './paiements';
import { e0, e2, libMois } from './format';

export interface CtxPaiements {
  rows: Paiement[];
  commit: (rows: Paiement[]) => void;
  facturer: (paiementId: string, versementId: string) => void;
  voirFacture: (factureId: string) => void;
  numeroFacture: (factureId: string) => string | undefined;
}

const esc = (s = '') => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const dCourte = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: iso.slice(0, 4) === aujourdhui().slice(0, 4) ? undefined : '2-digit' });
const initiales = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]!.toUpperCase()).join('');
const optMoyens = (sel?: Moyen) => (Object.keys(MOYENS) as Moyen[]).map(m => `<option value="${m}"${m === sel ? ' selected' : ''}>${MOYENS[m]}</option>`).join('');

const AIDE = `<p>Le suivi des forfaits réglés <b>en plusieurs fois</b>, en € <b>TTC</b>.</p>
  <p><b>Ajouter un versement</b> : date, montant, <b>moyen de paiement</b> (CB, chèque, espèces, virement) et, pour un chèque, son numéro. Le versement compte comme une recette du <b>mois où tu le reçois</b> : l'encart « Encaissé ce mois-ci » t'aide à remplir l'encaissé TTC de l'onglet Mois.</p>
  <p><b>Montant non daté</b> : ce qui avait été noté avant le suivi détaillé. Touche « Dater » pour le répartir en versements datés : le total payé ne change pas.</p>
  <p><b>Facturer</b> : crée en un tap la facture de ce versement (montant TTC, TVA 20 % incluse, « acquittée » avec la date et le moyen).</p>
  <p><b>Séances</b> : « couvertes » = ce que son paiement finance au prorata ; tu peux créditer jusque-là sur Deciplus.</p>`;

let filtre: 'open' | 'all' = 'open';
let recherche = '';
let ouvert: string | null = null;
let dater = false;
let nouvelleOuverte = false;

export function renderPaiements(root: HTMLElement, ctx: CtxPaiements) {
  const { rows, commit } = ctx;
  const r = resume(rows);
  const mois = aujourdhui().slice(0, 7);
  const enc = encaisseDuMois(rows, mois);
  const q = recherche.trim().toLowerCase();
  const liste = trier(rows).filter(p => (filtre === 'all' || !solde(p)) && (!q || p.nom.toLowerCase().includes(q)));

  root.innerHTML = `
  <header class="vt"><h1>Paiements</h1><p>Forfaits réglés en plusieurs fois</p></header>
  <section class="card">
    <div class="hd"><span class="n">€</span><h2>Vue d'ensemble</h2></div>
    <details class="aide"><summary aria-label="Comment ça marche ?">?</summary><div>${AIDE}</div></details>
    <div class="stats">
      <div class="stat due"><small>Reste à encaisser</small><strong>${e0(r.due)}</strong></div>
      <div class="stat"><small>Déjà encaissé</small><strong>${e0(r.paid)}</strong></div>
      <div class="stat"><small>À jour</small><strong>${r.ok}<span class="mut"> / ${r.n}</span></strong></div>
    </div>
    <div class="enc">
      <div class="enc-h"><span>Encaissé en ${libMois(mois)}</span><b>${e2(enc.total)}</b></div>
      ${enc.total ? `<div class="chips">${(Object.keys(enc.parMoyen) as Moyen[]).map(m => `<span class="chip2">${MOYENS_COURTS[m]} · ${e2(enc.parMoyen[m]!)}</span>`).join('')}</div>
        <p class="mut">${enc.lignes.length} versement${enc.lignes.length > 1 ? 's' : ''} saisi${enc.lignes.length > 1 ? 's' : ''} ici : pense à les inclure dans l'encaissé TTC du mois.</p>`
        : '<p class="mut">Aucun versement daté ce mois-ci pour l\'instant.</p>'}
    </div>
  </section>
  <div class="toolbar">
    <div class="seg"><button data-f="open" aria-pressed="${filtre === 'open'}">En cours</button><button data-f="all" aria-pressed="${filtre === 'all'}">Toutes</button></div>
    <input id="p-q" type="search" placeholder="Rechercher…" value="${esc(recherche)}" aria-label="Rechercher une cliente">
  </div>
  ${liste.map(p => carte(p, ctx)).join('') || `<div class="card empty">${rows.length ? (q ? 'Aucune cliente ne correspond.' : 'Tous les forfaits sont soldés 🎉') : 'Aucun paiement suivi. Ajoute une cliente ci-dessous.'}</div>`}
  <section class="card">
    <button class="row-btn" id="nv-t"><span class="n alt">+</span><b>Nouvelle cliente</b><span class="chev ${nouvelleOuverte ? 'up' : ''}"></span></button>
    ${nouvelleOuverte ? `<div class="grid" style="margin-top:14px">
      <label class="f full"><span>Nom</span><div><input id="a-nom" placeholder="Prénom Nom" autocomplete="off"></div></label>
      <label class="f full"><span>Formule</span><div><input id="a-form" placeholder="Forfait 30 séances" value="Forfait 30 séances"></div></label>
      <label class="f"><span>Prix total</span><div class="eur"><input id="a-total" inputmode="decimal" value="390"></div></label>
      <label class="f"><span>Séances prévues</span><div><input id="a-st" inputmode="numeric" value="30"></div></label>
      <label class="f full"><span>Plan de paiement</span><div><input id="a-plan" placeholder="ex. 3 fois par chèque"></div></label>
      <label class="f"><span>Moyen habituel</span><div><select id="a-moy">${optMoyens('cheque')}</select></div></label>
      <label class="f"><span>E-mail (factures)</span><div><input id="a-mail" type="email" inputmode="email" placeholder="facultatif"></div></label>
    </div>
    <div class="actions"><button class="pri" id="a-ok">Ajouter la cliente</button></div>` : ''}
  </section>`;

  // ——— Événements
  const n = (s: string) => Number(String(s).replace(',', '.')) || 0;
  const maj = (id: string, f: (p: Paiement) => Paiement) => commit(rows.map(p => (p.id === id ? f(p) : p)));
  const again = () => renderPaiements(root, ctx);
  const $ = <T extends HTMLElement>(s: string) => root.querySelector(s) as T;

  root.querySelectorAll<HTMLElement>('[data-f]').forEach(b => (b.onclick = () => { filtre = b.dataset.f as any; again(); }));
  $('#p-q').oninput = e => { recherche = (e.target as HTMLInputElement).value; const pos = (e.target as HTMLInputElement).selectionStart; again(); const i = $('#p-q') as HTMLInputElement; i.focus(); i.setSelectionRange(pos, pos); };
  $('#nv-t').onclick = () => { nouvelleOuverte = !nouvelleOuverte; again(); if (nouvelleOuverte) $('#a-nom')?.focus(); };
  root.querySelectorAll<HTMLElement>('[data-open]').forEach(b => (b.onclick = () => { ouvert = ouvert === b.dataset.open ? null : b.dataset.open!; dater = false; again(); }));

  const c = root.querySelector<HTMLElement>('.cl.open');
  if (c) {
    const id = c.dataset.id!; const p = rows.find(x => x.id === id)!;
    const g = (k: string) => c.querySelector<HTMLInputElement>(`[data-k="${k}"]`)!;
    const moyen = g('v-moyen') as unknown as HTMLSelectElement;
    const majRef = () => { c.querySelector<HTMLElement>('.f-ref')!.hidden = !['cheque', 'virement'].includes(moyen.value); };
    moyen.onchange = majRef; majRef();
    c.querySelector<HTMLElement>('[data-solde]')?.addEventListener('click', () => { g('v-montant').value = String(dater ? p.payeAvant : reste(p)).replace('.', ','); });
    c.querySelector<HTMLElement>('[data-dater]')?.addEventListener('click', () => { dater = !dater; again(); });
    c.querySelector<HTMLElement>('[data-addv]')!.onclick = () => {
      const montant = n(g('v-montant').value);
      if (!(montant > 0)) { g('v-montant').focus(); return; }
      const date = g('v-date').value || aujourdhui();
      maj(id, x => ajouterVersement(x, { date, montant, moyen: moyen.value as Moyen, ref: g('v-ref').value.trim() || undefined, note: g('v-note').value.trim() || undefined, ancien: dater || undefined }));
      dater = false;
    };
    c.querySelectorAll<HTMLElement>('[data-delv]').forEach(b => (b.onclick = () => {
      const v = p.versements.find(x => x.id === b.dataset.delv)!;
      if (confirm(`Supprimer le versement de ${e2(v.montant)} du ${dCourte(v.date)} ?${v.factureId ? '\nLa facture déjà émise reste dans l\'onglet Factures.' : ''}`)) maj(id, x => supprimerVersement(x, v.id));
    }));
    c.querySelectorAll<HTMLElement>('[data-fact]').forEach(b => (b.onclick = () => ctx.facturer(id, b.dataset.fact!)));
    c.querySelectorAll<HTMLElement>('[data-voirf]').forEach(b => (b.onclick = () => ctx.voirFacture(b.dataset.voirf!)));
    c.querySelector<HTMLElement>('[data-s10]')!.onclick = () => maj(id, x => ajouterSeances(x, 10));
    c.querySelector<HTMLElement>('[data-saveinfo]')!.onclick = () => maj(id, x => ({
      ...x, nom: g('i-nom').value.trim() || x.nom, formule: g('i-form').value.trim() || undefined, plan: g('i-plan').value.trim() || undefined,
      moyenHabituel: (g('i-moy') as unknown as HTMLSelectElement).value as Moyen, total: n(g('i-total').value), seancesTotal: n(g('i-st').value),
      seances: n(g('i-s').value), email: g('i-mail').value.trim() || undefined, tel: g('i-tel').value.trim() || undefined,
      notes: g('i-notes').value.trim() || undefined, maj: new Date().toISOString(),
    }));
    c.querySelector<HTMLElement>('[data-del]')!.onclick = () => {
      if (confirm(`Retirer ${p.nom} du suivi ? Ses versements disparaissent de cet onglet (les factures restent).`)) { ouvert = null; commit(rows.filter(x => x.id !== id)); }
    };
  }

  $('#a-ok')?.addEventListener('click', () => {
    const g = (id: string) => ($('#' + id) as HTMLInputElement).value;
    const nom = g('a-nom').trim(); if (!nom) { $('#a-nom').focus(); return; }
    let id = slug(nom); while (rows.some(p => p.id === id)) id += '-2';
    const p = nouveauPaiement(nom, { id, formule: g('a-form').trim() || undefined, total: n(g('a-total')), seancesTotal: n(g('a-st')) || 30, plan: g('a-plan').trim() || undefined, moyenHabituel: g('a-moy') as Moyen, email: g('a-mail').trim() || undefined });
    nouvelleOuverte = false; ouvert = id; commit([...rows, p]);
  });
}

function carte(p: Paiement, ctx: CtxPaiements) {
  const rs = reste(p), paye = payeTotal(p), pc = p.total ? Math.min(100, (paye / p.total) * 100) : 0;
  const open = ouvert === p.id;
  const dernier = p.versements[p.versements.length - 1];
  const sous = [p.formule, p.plan].filter(Boolean).join(' · ') || `Forfait ${p.seancesTotal} séances`;
  return `<article class="card cl${open ? ' open' : ''}" data-id="${p.id}">
    <button class="cl-head" data-open="${p.id}" aria-expanded="${open}">
      <span class="av" aria-hidden="true">${esc(initiales(p.nom))}</span>
      <span class="cl-t"><b>${esc(p.nom)}</b><small>${esc(sous)}</small></span>
      <span class="pill ${rs ? 'warn' : 'ok'}">${rs ? 'Reste ' + e0(rs) : 'Soldé ✓'}</span>
    </button>
    <div class="gb money" aria-label="Payé ${e0(paye)} sur ${e0(p.total)}"><i style="width:${pc}%"></i></div>
    <div class="cl-meta"><span><b>${e0(paye)}</b> / ${e0(p.total)}</span><span>${p.versements.length ? `${p.versements.length} versement${p.versements.length > 1 ? 's' : ''} · dernier ${dCourte(dernier.date)} · ${MOYENS_COURTS[dernier.moyen]}` : p.payeAvant ? 'Versements non datés' : 'Aucun versement'}</span></div>
    ${open ? detail(p, ctx) : ''}
  </article>`;
}

function detail(p: Paiement, ctx: CtxPaiements) {
  const rs = reste(p), cov = seancesCouvertes(p), sc = p.seancesTotal ? Math.min(100, (p.seances / p.seancesTotal) * 100) : 0;
  const peutAjouter = dater ? p.payeAvant > 0 : rs > 0;
  return `<div class="cl-det">
    <h3 class="sub">Versements</h3>
    <ol class="tl">
      ${p.payeAvant > 0 ? `<li class="tl-i ancien"><span class="tl-d">—</span><span class="tl-b"><b>${e2(p.payeAvant)}</b><small>Payé avant le suivi détaillé (non daté)</small></span><button class="sm" data-dater>${dater ? 'Annuler' : 'Dater'}</button></li>` : ''}
      ${p.versements.map(v => {
        const nf = v.factureId ? ctx.numeroFacture(v.factureId) : undefined;
        return `<li class="tl-i"><span class="tl-d">${dCourte(v.date)}</span>
        <span class="tl-b"><b>${e2(v.montant)}</b><small><span class="mo mo-${v.moyen}">${MOYENS[v.moyen]}</span>${v.ref ? ` n° ${esc(v.ref)}` : ''}${v.note ? ` · ${esc(v.note)}` : ''}${v.ancien ? ' · daté après coup' : ''} · ${rangVersement(p, v.id)}<sup>e</sup> versement</small></span>
        <span class="tl-a">${nf ? `<button class="sm ok" data-voirf="${v.factureId}">Facture ${esc(nf)}</button>` : `<button class="sm" data-fact="${v.id}">Facturer</button>`}<button class="sm ghost x" data-delv="${v.id}" aria-label="Supprimer ce versement">✕</button></span></li>`;
      }).join('')}
      ${!p.payeAvant && !p.versements.length ? '<li class="mut">Aucun versement pour l\'instant.</li>' : ''}
    </ol>
    ${peutAjouter ? `<div class="addv${dater ? ' dater' : ''}">
      <p class="addv-t">${dater ? `Dater une partie des ${e2(p.payeAvant)} non datés` : 'Nouveau versement'}</p>
      <div class="grid">
        <label class="f"><span>Date</span><div><input data-k="v-date" type="date" value="${aujourdhui()}"></div></label>
        <label class="f"><span>Montant</span><div class="eur"><input data-k="v-montant" inputmode="decimal" placeholder="0"></div></label>
        <label class="f"><span>Moyen de paiement</span><div><select data-k="v-moyen">${optMoyens(p.moyenHabituel ?? 'cheque')}</select></div></label>
        <label class="f f-ref"><span>N° de chèque / réf.</span><div><input data-k="v-ref" inputmode="numeric" placeholder="facultatif"></div></label>
        <label class="f full"><span>Note</span><div><input data-k="v-note" placeholder="facultatif (ex. 2e chèque sur 3)"></div></label>
      </div>
      <div class="actions"><button class="ghost" data-solde>${dater ? 'Tout' : 'Solde'} : ${e2(dater ? p.payeAvant : rs)}</button><button class="pri" data-addv>Enregistrer</button></div>
    </div>` : (p.payeAvant > 0 ? '' : '<p class="msg ok">Forfait soldé.</p>')}

    <h3 class="sub">Séances</h3>
    <div class="g"><div class="gl"><span>Créditées sur Deciplus</span><span><b>${p.seances}</b> / ${p.seancesTotal}${p.seances < cov ? ` · <span class="ok">${cov} couvertes</span>` : ''}</span></div><div class="gb"><i style="width:${sc}%"></i></div></div>
    <div class="actions"><button data-s10>+10 séances</button></div>

    <details class="infos"><summary>Infos de la cliente</summary>
      <div class="grid">
        <label class="f full"><span>Nom</span><div><input data-k="i-nom" value="${esc(p.nom)}"></div></label>
        <label class="f full"><span>Formule</span><div><input data-k="i-form" value="${esc(p.formule)}" placeholder="Forfait 30 séances"></div></label>
        <label class="f"><span>Prix total</span><div class="eur"><input data-k="i-total" inputmode="decimal" value="${p.total}"></div></label>
        <label class="f"><span>Moyen habituel</span><div><select data-k="i-moy">${optMoyens(p.moyenHabituel)}</select></div></label>
        <label class="f full"><span>Plan de paiement</span><div><input data-k="i-plan" value="${esc(p.plan)}" placeholder="ex. 3 fois par chèque"></div></label>
        <label class="f"><span>Séances créditées</span><div><input data-k="i-s" inputmode="numeric" value="${p.seances}"></div></label>
        <label class="f"><span>Séances prévues</span><div><input data-k="i-st" inputmode="numeric" value="${p.seancesTotal}"></div></label>
        <label class="f"><span>E-mail</span><div><input data-k="i-mail" type="email" value="${esc(p.email)}"></div></label>
        <label class="f"><span>Téléphone</span><div><input data-k="i-tel" type="tel" value="${esc(p.tel)}"></div></label>
        <label class="f full"><span>Notes</span><div><input data-k="i-notes" value="${esc(p.notes)}"></div></label>
      </div>
      <div class="actions"><button data-saveinfo>Enregistrer</button><button class="ghost warn" data-del>Retirer du suivi</button></div>
    </details>
  </div>`;
}
