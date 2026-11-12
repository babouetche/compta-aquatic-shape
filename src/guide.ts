// Guide « EI au réel » affiché dans l'app. Informations générales, à faire valider
// par un expert-comptable ou le SIE : ce n'est pas un conseil personnalisé.

const bloc = (titre: string, html: string, ouvert = false) =>
  `<details class="gd"${ouvert ? ' open' : ''}><summary>${titre}</summary><div>${html}</div></details>`;

export const GUIDE = [
  bloc('Ce qui change en passant au réel', `
    <p>Tu restes une <b>Entreprise Individuelle</b> (même SIRET, même TVA), mais tu quittes le régime <b>micro</b> pour le régime <b>réel</b> : en BNC, c'est la <b>déclaration contrôlée</b>, à l'impôt sur le revenu.</p>
    <table class="cmp"><thead><tr><th></th><th>Micro (avant)</th><th>Réel (maintenant)</th></tr></thead><tbody>
      <tr><td>Base de calcul</td><td>Ton chiffre d'affaires</td><td>Ton <b>bénéfice</b> = recettes − charges</td></tr>
      <tr><td>URSSAF</td><td>Déclaration mensuelle « Prestations BNC », % fixe du CA</td><td>Échéancier fixé par l'URSSAF (provisionnel), régularisé l'année suivante</td></tr>
      <tr><td>Impôt</td><td>Versement libératoire 2,2 % du CA</td><td>Barème de l'IR, payé via le <b>prélèvement à la source</b></td></tr>
      <tr><td>Charges</td><td>Ignorées (abattement forfaitaire)</td><td><b>Toutes</b> tes vraies dépenses pro sont déduites</td></tr>
      <tr><td>TVA (CA3)</td><td colspan="2">Inchangée : CA3 mensuelle sur impots.gouv</td></tr>
      <tr><td>Paperasse</td><td>Livre des recettes</td><td>Livre recettes + dépenses, liasse <b>2035</b> chaque année</td></tr>
    </tbody></table>
    <p>Intérêt : la rétrocession (~40 % de ton CA HT) et tes autres frais sont <b>vraiment</b> déduits, au lieu d'un abattement forfaitaire.</p>`),

  bloc('Ce que tu fais chaque mois', `
    <ol>
      <li><b>Saisis ton mois</b> ici : encaissé TTC, autofacture de rétro, chèques, et tes autres dépenses pro (carte « Autres charges »).</li>
      <li><b>Déclare et paie la CA3</b> sur impots.gouv (Espace professionnel → Déclarer la TVA) avec les montants de la carte 2. Échéance : vers le 15-24 du mois suivant selon ton SIREN.</li>
      <li><b>Note les prélèvements</b> : ce que l'URSSAF et les impôts ont réellement prélevé ce mois (carte « Prélèvements du mois »).</li>
      <li><b>Mets de côté</b> la provision affichée (carte 1) sur un compte épargne pro : c'est ce qui te protège de la régularisation de l'an prochain.</li>
      <li><b>Range tes justificatifs</b> (factures d'achat, autofactures, relevés) et <b>exporte le JSON</b> en sauvegarde.</li>
    </ol>
    <p>Il n'y a plus de déclaration URSSAF mensuelle à faire : l'URSSAF prélève seule selon son échéancier.</p>`),

  bloc('Ton calendrier de l\'année', `
    <ul class="cal">
      <li><b>Chaque mois</b> · CA3 + paiement de la TVA <b>avant le 16</b> · rétrocession SCM (40 % de l'encaissé TTC, par virement) · mensualité URSSAF (dès janvier 2027) · acompte d'impôt (le 15).</li>
      <li><b>Janvier 2027</b> · demander la <b>modulation</b> de ta mensualité URSSAF sur urssaf.fr selon ton revenu estimé.</li>
      <li><b>Début mai</b> · <b>liasse 2035</b> (bénéfice de l'année passée), déposée en ligne depuis ton espace pro, souvent via un logiciel ou un expert-comptable.</li>
      <li><b>Mai-juin</b> · <b>déclaration de revenus</b> (2042 + 2042-C-PRO) : tu reportes ton bénéfice BNC ; le volet social remplace l'ancienne DSI et sert à l'URSSAF.</li>
      <li><b>Été-automne</b> · l'URSSAF <b>régularise</b> l'année passée (remboursement ou rappel) et ajuste ton échéancier.</li>
      <li><b>Septembre</b> · nouveau taux de prélèvement à la source et acomptes recalculés.</li>
      <li><b>CFE</b> · 2026 : 648 € prélevés le 16/12/2026. À partir de 2027 : <b>mensualisée</b> (prélèvement chaque mois dès le 15/01).</li>
    </ul>
    <p>Dates indicatives : vérifie chaque année le calendrier fiscal sur impots.gouv.fr et ton espace urssaf.fr.</p>`),

  bloc('Ce que tu peux déduire (charges)', `
    <p>Une dépense est déductible si elle est <b>engagée pour ton activité</b>, <b>payée</b> dans l'année (comptabilité de caisse en BNC) et <b>justifiée</b> par une facture.</p>
    <ul>
      <li><b>Rétrocession</b> à la SCM (montant HT = 40 % du CA HT encaissé) — déjà prise en compte automatiquement.</li>
      <li><b>Matériel</b> : frites, planches, palmes, enceinte, maillots techniques… Au-delà de 500 € HT par objet durable, il s'amortit sur plusieurs années.</li>
      <li><b>Assurance RC pro</b>, cotisations à des syndicats ou fédérations, carte pro.</li>
      <li><b>Formations</b> et recyclages obligatoires (BNSSA, PSE1, révision du diplôme…).</li>
      <li><b>Téléphone / internet</b> au prorata de l'usage pro.</li>
      <li><b>Déplacements</b> : frais réels ou <b>barème kilométrique</b> (option annuelle) pour le trajet vers les piscines.</li>
      <li><b>Frais bancaires</b> du compte pro, <b>logiciel</b> de compta, <b>expert-comptable</b>.</li>
      <li><b>Cotisations sociales obligatoires</b> payées dans l'année (elles se déduisent du bénéfice dans la 2035).</li>
      <li><b>Repas</b> pris sur place pour raisons pro : seulement la part au-delà d'un seuil fixé chaque année.</li>
    </ul>
    <p>Pour chaque achat, saisis le <b>HT</b> et la <b>TVA</b> dans « Autres charges » : la TVA s'ajoute à ta TVA déductible (ligne 20) et le HT réduit ton bénéfice.</p>`),

  bloc('Tes options (ce que tu peux choisir)', `
    <ul class="opt">
      <li><b>Moduler tes acomptes URSSAF</b> · si ton revenu baisse ou monte, tu peux demander sur urssaf.fr un calcul sur ton revenu estimé de l'année. Attention aux majorations si tu sous-estimes trop.</li>
      <li><b>Moduler ton prélèvement à la source</b> · sur impots.gouv, « Gérer mon prélèvement à la source », pour coller à ton revenu réel.</li>
      <li><b>Barème kilométrique</b> · au lieu des frais réels de voiture, souvent plus simple et avantageux.</li>
      <li><b>PER individuel</b> (retraite) · les versements sont déductibles de ton revenu imposable, dans certaines limites.</li>
      <li><b>Expert-comptable ou logiciel</b> · fortement conseillé la 1<sup>re</sup> année au réel pour la 2035. Adhérer à un organisme de gestion agréé (OGA) est devenu facultatif.</li>
      <li><b>Compte bancaire dédié</b> · indispensable en pratique pour séparer recettes, dépenses et apports perso.</li>
      <li><b>Option pour l'IS</b> (EI assimilée EURL) · tu te verses une rémunération et l'entreprise paie l'impôt sur les sociétés. Intéressant surtout si tu laisses beaucoup d'argent dans l'entreprise. Option révocable pendant 5 ans.</li>
      <li><b>Revenir en micro</b> · possible si tu restes sous les seuils, sur option pour l'année suivante. À comparer : avec ~40 % de rétro, le réel est souvent plus favorable que l'abattement micro de 34 %.</li>
    </ul>`),

  bloc('Où en est 2026 (mis à jour le 12/11/2026)', `
    <p>Tu es en <b>EI au réel</b> (BNC, déclaration contrôlée) depuis le <b>1<sup>er</sup> janvier 2026</b>.</p>
    <ul>
      <li><b>URSSAF 2026</b> : régularisée et <b>soldée</b>, 8 723 € au total (dernier prélèvement de 237 € le 03/12/2026). Plus de taux micro, plus rien à déclarer chaque mois. Le trop-payé éventuel sera régularisé en 2027 avec ta déclaration de revenus.</li>
      <li><b>À partir du 01/01/2027</b> : mensualisation URSSAF. Modulation à faire en janvier, puis saisis la mensualité dans les réglages.</li>
      <li><b>TVA de la rétro</b> : déduite <b>une seule fois</b>, en ligne 20, sur la CA3 du mois où tu paies la rétro. Celle de AF-2026-11 (254,96 €) a déjà été déduite en octobre : rien pour la rétro sur la CA3 de novembre.</li>
      <li><b>Charges 2026</b> : index des charges déductibles (v2) dans le Drive, ≈ 23 514 € hors rétro de novembre.</li>
      <li><b>Ta 2035 pour 2026</b> : au printemps 2027, via Indy.</li>
      <li><b>Indy</b> : aucune modification sans ton accord explicite.</li>
    </ul>`),

  bloc('Ce que l\'app calcule (et ses limites)', `
    <ul>
      <li><b>Bénéfice estimé</b> = recettes HT − rétro HT − autres charges HT. C'est une estimation mensuelle : le vrai bénéfice est celui de ta 2035.</li>
      <li><b>Provision sociale</b> = bénéfice × taux réglable (29 % par défaut, estimation validée le 12/11/2026). Ce n'est <b>pas</b> le montant que l'URSSAF prélève : compare avec « Prélevé par l'URSSAF ».</li>
      <li><b>Provision impôt</b> = (bénéfice − provision sociale) × ton taux de prélèvement à la source, à recopier depuis impots.gouv dans les réglages.</li>
      <li>Les mois avant ta date de passage au réel restent calculés en micro (URSSAF « Prestations BNC »).</li>
    </ul>
    <p>Informations générales : elles ne remplacent pas l'avis d'un expert-comptable ou de ton SIE.</p>`),
].join('');
