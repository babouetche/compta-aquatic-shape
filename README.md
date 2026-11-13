# Compta Aquatic Shape

PWA mobile-first (Vite + TypeScript, sans framework). Données en `localStorage` (interface `Repository`, adaptateur Google Sheets à ajouter), PDF généré côté client (jsPDF). Aucun secret ni IBAN dans le dépôt.

## Lancer
```bash
npm install
npm test          # 15 tests : les 10 mois du cahier §4 + règles (crédit de TVA, URSSAF, reste)
npm run dev       # http://localhost:5173 (--host : accessible depuis l'iPhone sur le même Wi-Fi)
npm run build && npm run preview
```
Dépôt public : aucune donnée perso. En local, un `src/seed.json` (ignoré par git) est importé au premier lancement ; sur l'iPhone, utilise **Importer JSON** une fois. Les tests du §4 sont ignorés si `src/seed.json` est absent.

## Installer sur iPhone
La PWA exige HTTPS : déploie `dist/` sur un hébergement statique (Netlify Drop, Cloudflare Pages, GitHub Pages), ouvre l'URL dans **Safari** → Partager → **Sur l'écran d'accueil**.
Attention : les données sont locales à l'appareil/navigateur. Exporte régulièrement le JSON.

## Onglets
- **Mois** : saisie du mois, URSSAF/impôt, CA3, rétrocession, justificatif, répartition.
- **Paiements** : forfaits en plusieurs fois, versements datés avec moyen de paiement (CB, chèque, espèces, virement) et n° de chèque, encaissé du mois par moyen.
- **Factures** : création en quelques taps (prestations prédéfinies, prix TTC → HT/TVA), facture acquittée depuis un versement, PDF et partage iOS, numérotation AAAAMM-N.
- **Année** : bilan au réel et historique. **Plus** : sauvegarde, guide, réglages.

## Régime
Depuis janvier 2026 : **EI au réel** (BNC, déclaration contrôlée, IR). URSSAF 2026 régularisée et soldée ; mensualisation à partir de 2027 (montant saisi dans les réglages). Les cotisations dépendent du bénéfice : l'app calcule des **provisions** (29 % du bénéfice par défaut), compare avec les prélèvements réels et fait le bilan de l'année (base de la 2035). Le régime et la date de passage se changent dans les réglages ; les mois d'avant sont calculés en micro. Guide complet dans l'app (carte « Guide : EI au réel »).

## Règles validées (12/11/2026)
- Rétrocession SCM = 40 % du CA HT encaissé + TVA = 40 % de l'encaissé TTC. Autofacture `AF-AAAA-MM` numérotée par mois de règlement ; paiement par virement à partir de 2027.
- TVA de la rétro : déduite une seule fois, ligne 20, sur la CA3 du mois de paiement (à partir de nov. 2026 ; nov. 2026 = 0 car AF-2026-11 a été déduite en octobre). CA3 avant le 16.
- Identité (SIRET, APE, n° TVA, adresse) : saisie dans les réglages / le JSON, jamais dans ce dépôt public.

## Structure
- `src/calc.ts` : formules micro (cahier §2) et réel (`calcReel`) · `src/regime.ts` : choix du régime par mois · `src/guide.ts` : guide · `tests/calc.test.ts`
- `src/repository.ts` : stockage + import/normalisation · `src/pdf.ts` : justificatif · `src/main.ts` : UI

## Reste à faire
- Adaptateur Google Sheets (OAuth) pour la synchro avec la conversation « compta » (§7).
- Rattacher chaque règlement à son autofacture (AF-AAAA-MM) ; pour l'instant la référence est un champ texte par mois.
- Points ouverts du cahier §5 (données à vérifier, pas des bugs d'app).
- Taux URSSAF modifiables dans l'UI mais non persistés : à revérifier chaque 1er janvier.
