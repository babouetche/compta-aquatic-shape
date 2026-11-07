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

## Structure
- `src/calc.ts` : formules du cahier §2 (ne pas modifier sans validation) · `tests/calc.test.ts`
- `src/repository.ts` : stockage + import/normalisation · `src/pdf.ts` : justificatif · `src/main.ts` : UI

## Reste à faire
- Adaptateur Google Sheets (OAuth) pour la synchro avec la conversation « compta » (§7).
- Rattacher chaque règlement à son autofacture (AF-AAAA-MM) ; pour l'instant la référence est un champ texte par mois.
- Icônes PNG sommaires (générées par `scripts/make-icons.mjs`) : à remplacer par un vrai logo.
- Points ouverts du cahier §5 (données à vérifier, pas des bugs d'app).
- Taux URSSAF modifiables dans l'UI mais non persistés : à revérifier chaque 1er janvier.
