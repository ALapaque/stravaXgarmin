# stravaXgarmin — repères pour travailler dans ce dépôt

## En bref

- PWA **Nuxt 4** (dossier `app/`), Vue 3, TypeScript. Hébergée sur Vercel : https://strava-x-garmin.vercel.app
- **Pas de base de données.** Côté serveur (routes Nitro dans `server/`), les connexions vivent dans des cookies chiffrés httpOnly (`server/utils/sessions.ts` : `sxg-strava`, `sxg-garmin`, `sxg-garmin-mfa`, `sxg-ai`). Côté navigateur, l'état vit dans des `useState` gardés dans localStorage par `app/plugins/persist.client.ts` (clés préfixées `sxg:v2:`).
- **Sources de données** : Strava (API officielle v3, OAuth, portées `read`, `activity:read_all`, `activity:write`), Garmin Connect (API **non officielle** via `@flow-js/garmin-connect`, e-mail + mot de passe + code 2FA, jamais stockés), IA au choix de l'utilisateur avec sa propre clé (`server/utils/ai.ts`, format « chat completions » : Gemini, OpenAI, Mistral).
- Interface en **français**, qui **tutoie**. Les commentaires du code sont aussi en français.
- Utilisateur principal : un coureur qui suit des plans (Kiprun Pacer exporté vers Garmin), court surtout **sur tapis**, nomme ses séances `[SOURCE] - Titre` et publie ses analyses sur Strava. Les fonctions doivent marcher aussi bien sans GPS.

## Commandes

| But | Commande |
|---|---|
| Types (aucune erreur admise) | `npx nuxi typecheck` |
| Tests unitaires (logique pure) | `npm test` |
| Build de production | `npx nuxt build` (sortie `.output/`) |
| Serveur de test | `PORT=3133 NUXT_SESSION_PASSWORD=<32 caractères min> NUXT_STRAVA_CLIENT_ID=1 NUXT_STRAVA_CLIENT_SECRET=s node .output/server/index.mjs` |

Toujours **arrêter l'ancien serveur avant un nouveau build** (`pkill -f ".output/server/index.mjs"`) : un serveur resté ouvert sert des pages qui pointent vers des fichiers supprimés, et la page s'affiche sans style.

## Où est quoi

| Dossier | Contenu |
|---|---|
| `app/pages/` | Écrans. Un seul élément racine par page (les transitions de page l'exigent), en général `<div class="stack">`. |
| `app/components/` | Composants. `AppTabBar` (barre du bas à deux faces), `AppSidebar` (ordinateur), `RouteMap` (MapLibre + OpenFreeMap), `RouteTrace`, `WorkoutProfile`… |
| `app/composables/` | État et logique côté navigateur (`useActivities`, `useSync`, `usePlan`, `useFitness`, `useSettings`, `useTheme`, `useNav`, `useSubnav`, `useTab`…). |
| `app/utils/` | Fonctions pures importées automatiquement (`format.ts`, `route.ts`, `shareImage.ts`). |
| `shared/utils/` | Logique pure partagée navigateur + serveur, **testée**. |
| `app/assets/css/themes.css` | Les 6 thèmes : uniquement des variables CSS. |
| `app/assets/css/main.css` | Mise en page, utilitaires, animations, grilles tablette/ordinateur. |
| `server/api/` | Routes : `auth/strava/*`, `strava/*`, `garmin/*`, `ai/*`, `ia/*`, `me`, `changelog`. |
| `server/utils/` | `strava.ts` (`stravaFetch`, jeton rafraîchi), `garmin.ts` (connexion en deux temps, 2FA), `ai.ts`, `sessions.ts`. |
| `tests/` | Tests Vitest. |

## Règles à respecter

1. **Le mode démo doit montrer chaque fonction.** Cookie `sxg-demo=true` : données fictives produites par `demoActivities()`, `demoPlan()`, etc. Toute nouvelle fonction a ses données de démo, parce que c'est le seul moyen de la voir ici (les API réelles ne sont pas joignables depuis l'environnement de développement). En démo, le prénom est masqué (flou).
2. **Jamais de couleur, de police ni d'arrondi en dur dans un composant.** Tout passe par les variables des thèmes (`--bg`, `--ink`, `--surface`, `--primary`, `--accent-text`, `--ok`, `--ko`, `--info`, `--type-*`, `--r-card`, `--r-btn`, `--r-ctrl`, `--r-tab`, `--r-pill`, `--font-display`, `--font-body`, `--font-mono`…). Six thèmes (`neon` par défaut, `carbone`, `papier` qui est clair, `abysse`, `retro`, `trail`) plus des réglages sur mesure posés sur `<html>` (`useTheme`). Vérifier au moins Néon, Carbone (angles vifs) et Papier (clair).
3. **Trois tailles d'écran.** Téléphone par défaut (390 px), tablette à partir de 720 px (grilles, barre du bas gardée), ordinateur à partir de 1080 px (barre latérale, `.app--nav`). Utilitaires : `.stack`, `.stack--wide`, `.cols`, `.col`, `.span-all`, `.panel`, `.panel--narrow`, `.list--grid`.
4. **Réutiliser les utilitaires existants** de `main.css` : `.card`, `.card--pad`, `.block--primary`, `.eyebrow`, `.h1`, `.h1--xl`, `.h2`, `.num`, `.label`, `.lead`, `.fine`, `.title`, `.row`, `.list`, `.btn`, `.btn--primary`, `.btn--secondary`, `.btn--sm`, `.chip`, `.tile`, `.segmented`, `.section-head`, `.link`. Animations : `rise`, `grow`, `pop`, avec `prefers-reduced-motion` respecté.
5. **Textes de l'interface** : français simple, tutoiement, phrases complètes, pas de jargon technique (pas de « API », « token », « cache » à l'écran). Les messages d'erreur disent quoi faire.
6. **Ce que l'appli écrit chez Strava ou Garmin** passe par `useActivities` (trace dans l'historique, annulation possible) et ne détruit jamais un texte de l'utilisateur : une description s'ajoute, elle ne remplace pas. Tout renommage automatique doit rester prudent et testé.
7. **API non vérifiables ici** (Garmin surtout) : lecture défensive, chaque donnée indépendante des autres, erreurs remontées dans l'état des connexions (`useHealth`) plutôt qu'avalées en silence.
8. **Vie privée** : aucune donnée réelle d'un utilisateur dans le dépôt (ni tests, ni démo, ni commentaires). Rien n'est stocké côté serveur ; si cela change, la phrase « Aucune donnée stockée sur nos serveurs » doit changer aussi.
9. **Logique pure testable** : les règles (nommage, classement, comparaison prévu/réalisé, fusion de description) vivent dans `shared/utils/` ou `app/utils/`, importent explicitement ce dont elles ont besoin (pas d'import automatique Nuxt) et ont leurs tests dans `tests/`.
10. **Logos** : seulement ceux fournis par le propriétaire dans `public/brands/`, via `BrandMark`. Ne jamais en télécharger ni en redessiner.

## Pièges déjà rencontrés

- **Écart serveur/navigateur** : l'état sauvegardé n'est chargé qu'après l'hydratation (`onNuxtReady`). Un composant du layout qui dépend d'un état posé par la page (ex. les rubriques dans `AppSidebar`) ne doit l'afficher qu'après `onMounted`.
- **iPhone (Safari)** : `backdrop-filter` casse dans une scène 3D (`transform-style: preserve-3d`) ; la barre pivotante donne donc sa propre `perspective()` à chaque face. Les animations pilotées par le défilement utilisent `clip-path` + `transform`, pas `mask`.
- **PWA iPhone** : la page de départ `/` ne doit jamais rediriger (sinon la barre du navigateur apparaît). Une navigation hors du site (Strava) ouvre un mini-navigateur qui reste ouvert.
- **Spécificité CSS** : `.card` est déclarée tard dans `main.css` ; pour la surcharger, utiliser un sélecteur plus précis (`.card.list--grid`). Dans un style `scoped`, viser la racine d'un composant enfant avec `:deep(...)`.
- **Bibliothèque Garmin** en CommonJS : import par défaut puis déstructuration.
- **Strava limite les appels** (environ 100 par quart d'heure) : ne demander que ce qui manque, garder le résultat dans le navigateur.
- **MapLibre** (1 Mo) est chargé à la demande, avec `setWorkerUrl` et l'import `?url` du worker.

## Publication

- Chaque push sur `main` déclenche `semantic-release` (GitHub Actions) puis le déploiement Vercel. La version et `CHANGELOG.md` sont générés.
- **Commits conventionnels en français.** Les messages `feat:` et `fix:` sont affichés tels quels à l'utilisateur dans la fenêtre « Quoi de neuf » : une phrase claire, côté utilisateur, sans jargon (ex. `feat: écran « État des connexions »…`). `chore:`, `docs:`, `test:`, `ci:`, `refactor:` restent invisibles.
- Avant de pousser : `npx nuxi typecheck`, `npm test`, `npx nuxt build`, puis captures d'écran en démo aux trois tailles.
