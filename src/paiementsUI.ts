import { type Paiement, reste, solde, resume, verser, ajouterSeances, trier, seancesCouvertes, slug } from './paiements';
import { e0, dateFr } from './format';

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

const AIDE = `<p>Le suivi des clientes qui règlent leur forfait <b>en plusieurs fois</b>. Montants en € <b>TTC</b>.</p>
  <p><b>+ Versement</b> : tape le montant reçu et valide. Il s'ajoute au « payé », la date est notée dans l'historique. Pense aussi à l'inclure dans ton <b>encaissé TTC</b> du mois (onglet Compta) : un versement est une recette du mois où tu le reçois.</p>
  <p><b>Séances ajoutées</b> : ce que tu as déjà crédité sur son compte Deciplus. « Couvertes » = ce que son paiement finance au prorata : tu peux ajouter des séances jusqu'à ce nombre.</p>
  <p><b>Facture</b> : fais une facture par versement (montant TTC, TVA 20 % incluse), comme celle de 55 € de Hafida.</p>
  <p><b>Soldé</b> : quand le total est payé, la cliente passe dans « Tous ».</p>`;

let filtre: 'open' | 'all' = 'open';
let confirmId: string | null = null;
let ouvert: string | null = null;

export function renderPaiements(root: HTMLElement, rows: Paiement[], commit: (rows: Paiement[]) => void) {
  const r = resume(rows);
  const liste = trier(rows).filter(p => filtre === 'all' || !solde(p));
  root.innerHTML = `
  <section class="card">
    <div class="hd"><span class="n">€</span><h2>Paiements échelonnés</h2></div>
    <details class="aide"><summary aria-label="Comment ça marche ?">?</summary><div>${AIDE}</div></details>
    <div class="stats">
      <div class="stat due"><small>Reste à encaisser</small><strong>${e0(r.due)}</strong></div>
      <div class="stat"><small>Déjà encaissé</small><strong>${e0(r.paid)}</strong></div>
      <div class="stat"><small>Clientes à jour</small><strong>${r.ok} / ${r.n}</strong></div>
    </div>
    <div class="seg"><button data-f="open" aria-pressed="${filtre === 'open'}">En cours</button><button data-f="all" aria-pressed="${filtre === 'all'}">Toutes</button></div>
  </section>
  ${liste.map(p => {
    const rs = reste(p), pc = p.total ? Math.min(100, (p.paye / p.total) * 100) : 0, sc = p.seancesTotal ? Math.min(100, (p.seances / p.seancesTotal) * 100) : 0;
    const cov = seancesCouvertes(p);
    return `<article class="card cl" data-id="${p.id}">
      <div class="cl-top"><b class="nom">${esc(p.nom)}</b><span class="pill ${rs ? 'warn' : 'ok'}">${rs ? 'Reste ' + e0(rs) : 'Soldé ✓'}</span></div>
      <div class="g"><div class="gl"><span>Payé</span><span><b>${e0(p.paye)}</b> / ${e0(p.total)}</span></div><div class="gb money"><i style="width:${pc}%"></i></div></div>
      <div class="g"><div class="gl"><span>Séances ajoutées</span><span><b>${p.seances}</b> / ${p.seancesTotal}${p.seances < cov ? ` · <span class="ok">${cov} couvertes</span>` : ''}</span></div><div class="gb"><i style="width:${sc}%"></i></div></div>
      <div class="cl-act">
        ${rs ? `<div class="eur"><input data-v="${p.id}" inputmode="decimal" placeholder="Montant"></div><button class="pri" data-add="${p.id}">+ Versement</button>` : ''}
        <button data-s="${p.id}">+10 séances</button>
        <button class="ghost" data-h="${p.id}">${ouvert === p.id ? 'Masquer' : 'Détails'}</button>
      </div>
      ${ouvert === p.id ? `<div class="cl-det">
        ${(p.versements ?? []).length ? `<p class="mut">Versements notés dans l'app :</p>${p.versements!.map(v => `<div class="row"><span>${dateFr(v.date)}</span><b>${e0(v.montant)}</b></div>`).join('')}` : '<p class="mut">Aucun versement saisi dans l\'app (montant repris de l\'ancien suivi).</p>'}
        <div class="grid" style="margin-top:10px">
          <label class="f"><span>Payé (€)</span><div class="eur"><input data-e="paye" value="${p.paye}" inputmode="decimal"></div></label>
          <label class="f"><span>Total (€)</span><div class="eur"><input data-e="total" value="${p.total}" inputmode="decimal"></div></label>
          <label class="f"><span>Séances ajoutées</span><div><input data-e="seances" value="${p.seances}" inputmode="numeric"></div></label>
          <label class="f"><span>Séances prévues</span><div><input data-e="seancesTotal" value="${p.seancesTotal}" inputmode="numeric"></div></label>
        </div>
        <div class="actions"><button data-save="${p.id}">Enregistrer les corrections</button><button class="ghost warn" data-del="${p.id}">${confirmId === p.id ? 'Confirmer la suppression' : 'Retirer du suivi'}</button></div>
      </div>` : ''}
      ${p.maj ? `<p class="mut meta">Mis à jour le ${new Date(p.maj).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</p>` : ''}
    </article>`;
  }).join('') || `<div class="card empty">${rows.length ? 'Tous les forfaits sont soldés.' : 'Aucun paiement suivi. Ajoute une cliente ci-dessous, ou importe ton fichier de paiements (bas de l\'onglet Compta).'}</div>`}
  <section class="card">
    <div class="hd"><span class="n alt">+</span><h2>Ajouter une cliente</h2></div>
    <div class="grid">
      <label class="f full"><span>Nom</span><div><input id="a-nom" placeholder="Prénom Nom"></div></label>
      <label class="f"><span>Déjà payé (€)</span><div class="eur"><input id="a-paye" inputmode="decimal" placeholder="0"></div></label>
      <label class="f"><span>Total (€)</span><div class="eur"><input id="a-total" inputmode="decimal" value="390"></div></label>
      <label class="f"><span>Séances ajoutées</span><div><input id="a-s" inputmode="numeric" placeholder="0"></div></label>
      <label class="f"><span>Séances prévues</span><div><input id="a-st" inputmode="numeric" value="30"></div></label>
    </div>
    <div class="actions"><button class="pri" id="a-ok">Ajouter au suivi</button></div>
  </section>`;

  const n = (s: string) => Number(s.replace(',', '.')) || 0;
  const maj = (id: string, f: (p: Paiement) => Paiement) => commit(rows.map(p => (p.id === id ? f(p) : p)));
  const again = () => renderPaiements(root, rows, commit);

  root.querySelectorAll<HTMLElement>('[data-f]').forEach(b => (b.onclick = () => { filtre = b.dataset.f as any; again(); }));
  root.querySelectorAll<HTMLElement>('[data-add]').forEach(b => (b.onclick = () => {
    const inp = root.querySelector<HTMLInputElement>(`[data-v="${b.dataset.add}"]`)!; const v = n(inp.value);
    if (!(v > 0)) { inp.focus(); return; }
    maj(b.dataset.add!, p => verser(p, v));
  }));
  root.querySelectorAll<HTMLElement>('[data-s]').forEach(b => (b.onclick = () => maj(b.dataset.s!, p => ajouterSeances(p, 10))));
  root.querySelectorAll<HTMLElement>('[data-h]').forEach(b => (b.onclick = () => { ouvert = ouvert === b.dataset.h ? null : b.dataset.h!; confirmId = null; again(); }));
  root.querySelectorAll<HTMLElement>('[data-save]').forEach(b => (b.onclick = () => {
    const card = b.closest('article')!; const g = (k: string) => n(card.querySelector<HTMLInputElement>(`[data-e="${k}"]`)!.value);
    maj(b.dataset.save!, p => ({ ...p, paye: g('paye'), total: g('total'), seances: g('seances'), seancesTotal: g('seancesTotal'), maj: new Date().toISOString() }));
  }));
  root.querySelectorAll<HTMLElement>('[data-del]').forEach(b => (b.onclick = () => {
    if (confirmId === b.dataset.del) { confirmId = null; ouvert = null; commit(rows.filter(p => p.id !== b.dataset.del)); }
    else { confirmId = b.dataset.del!; again(); }
  }));
  root.querySelector<HTMLElement>('#a-ok')!.onclick = () => {
    const g = (id: string) => root.querySelector<HTMLInputElement>('#' + id)!.value;
    const nom = g('a-nom').trim(); if (!nom) { root.querySelector<HTMLInputElement>('#a-nom')!.focus(); return; }
    let id = slug(nom); while (rows.some(p => p.id === id)) id += '-2';
    commit([...rows, { id, nom, paye: n(g('a-paye')), total: n(g('a-total')), seances: n(g('a-s')), seancesTotal: n(g('a-st')) || 30, maj: new Date().toISOString() }]);
  };
}
