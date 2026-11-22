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
| `app/pages/` | Écrans. Un seul élément racine par page (les transitions de page l'exigent), en général `<div class="stack">`. Trois onglets : `index.vue` (**Aujourd'hui**), `journal.vue` (**Journal** : plan et courses sur une ligne de temps), `progression.vue` (**Progression** : régularité, forme, records, matériel). Puis `activites/[id]/index.vue` (une course) et `debrief.vue` (le Débrief, écran sans barre du bas : `definePageMeta({ focus: true })`), `bilan.vue`, `objectif.vue`, `reglages/*` (une page d'accueil et une sous-page par thème), `connexion/*`. Les anciennes adresses (`plan`, `stats`, `recap`, `activites/index`, `titre`, `analyse`) ne sont plus que des redirections. |
| `app/components/` | Composants. Navigation : `AppTabBar` (barre du bas à deux faces), `AppSidebar` (ordinateur), `AppHeader` (cloche, avatar vers les réglages). Course : `LapProfile` (profil des tours), `PlanDone` / `PlanVsDone` (prévu contre réalisé), `CardioPanel` (cardio par zones), `RunThumb` (vignette), `RouteMap` (MapLibre + OpenFreeMap), `DebriefSummary`, `RpeScale`, `OutcomePicker`, `RunPending`. Plan et suivi : `SessionCard`, `PlanUpcoming`, `WorkoutProfile`, `WeekStrip`, `AdherenceChart`, `LoadChart`. |
| `app/composables/` | État et logique côté navigateur : `useActivities` (toute écriture chez Strava/Garmin), `useSync`, `usePlan` (séances, lien avec les courses, prévu/réalisé, suivi), `useDebriefs`, `useConvention`, `useStreams`, `useHealth`, `useFitness`, `useSettings`, `useTheme`, `useNav`, `useSubnav`, `useTab`, `useRunPage`… |
| `app/utils/` | Fonctions du navigateur importées automatiquement (`route.ts`, `shareImage.ts` : image à partager, avec le tracé ou, sans GPS, le graphique de la séance ; `lapColors.ts` : teintes du profil des tours, communes à la page et à l'image ; `rpe.ts`). |
| `shared/utils/` | **Toutes les règles**, en fonctions pures partagées navigateur + serveur, testées : `titles` (convention `[SOURCE] - Titre`), `naming`, `classify`, `workout` (étapes d'une séance, lecture des titres de plans), `compliance` (prévu contre réalisé), `planmatch`, `planstate`, `debrief` (texte publié), `description` (fusion dans la description Strava), `runchart`, `zones`, `streams`, `today`, `journal`, `progress`, `bilan`, `health`, `nav`, `format`, `model` (types), `upgrade` (état gardé d'une ancienne version), `demo` (données de démo). |
| `app/assets/css/themes.css` | Les 6 thèmes : uniquement des variables CSS. |
| `app/assets/css/main.css` | Mise en page, utilitaires, animations, grilles tablette/ordinateur. |
| `server/api/` | Routes : `auth/strava/*`, `strava/*` (activités, détails, courbes, chaussures), `garmin/*` (activités, plan, forme, records), `ai/*`, `ia/*`, `me`, `changelog`. |
| `server/utils/` | `strava.ts` (`stravaFetch`, jeton rafraîchi), `garmin.ts` (connexion en deux temps, 2FA), `ai.ts`, `sessions.ts`. |
| `tests/` | Tests Vitest (un fichier par module de `shared/utils/`). |

## Règles à respecter

1. **Le mode démo doit montrer chaque fonction.** Cookie `sxg-demo=true` : données fictives produites par `buildDemo(aujourd'hui)` (`shared/utils/demo.ts`), toujours datées du jour. Toute nouvelle fonction a ses données de démo, parce que c'est le seul moyen de la voir ici (les API réelles ne sont pas joignables depuis l'environnement de développement). Changer les données de démo demande d'augmenter `DEMO_VERSION` (les démos gardées dans les navigateurs sont alors régénérées). En démo, le prénom est masqué (flou).
2. **Jamais de couleur, de police ni d'arrondi en dur dans un composant.** Tout passe par les variables des thèmes (`--bg`, `--ink`, `--surface`, `--primary`, `--accent-text`, `--ok`, `--ko`, `--info`, `--type-*`, `--r-card`, `--r-btn`, `--r-ctrl`, `--r-tab`, `--r-pill`, `--font-display`, `--font-body`, `--font-mono`…). Six thèmes (`neon` par défaut, `carbone`, `papier` qui est clair, `abysse`, `retro`, `trail`) plus des réglages sur mesure posés sur `<html>` (`useTheme`) : couleurs, arrondis, et **police choisie à part**, sur n'importe quel thème. Vérifier au moins Néon, Carbone (angles vifs) et Papier (clair), et toujours avec la police la plus large, **Unbounded**.
3. **Trois tailles d'écran.** Téléphone par défaut (390 px, et rien ne doit dépasser à **360 px**), tablette à partir de 720 px (grilles, barre du bas gardée), ordinateur à partir de 1080 px (barre latérale, `.app--nav`). Utilitaires : `.stack`, `.stack--wide`, `.cols`, `.col`, `.span-all`, `.panel`, `.panel--narrow`, `.list--grid`.
4. **Réutiliser les utilitaires existants** de `main.css` : `.card`, `.card--pad`, `.block--primary`, `.eyebrow`, `.h1`, `.h1--xl`, `.h2`, `.num`, `.label`, `.lead`, `.fine`, `.title`, `.row`, `.list`, `.btn`, `.btn--primary`, `.btn--secondary`, `.btn--sm`, `.chip`, `.tile`, `.segmented`, `.section-head`, `.link`. Animations : `rise`, `grow`, `pop`, avec `prefers-reduced-motion` respecté.
5. **Textes de l'interface** : français simple, tutoiement, phrases complètes, pas de jargon technique (pas de « API », « token », « cache » à l'écran). Les messages d'erreur disent quoi faire.
6. **Ce que l'appli écrit chez Strava ou Garmin** passe par `useActivities` (trace dans l'historique, annulation possible) et ne détruit jamais un texte de l'utilisateur : une description s'ajoute, elle ne remplace pas. Tout renommage automatique doit rester prudent et testé.
7. **API non vérifiables ici** (Garmin surtout) : lecture défensive, chaque donnée indépendante des autres, erreurs remontées dans l'état des connexions (`useHealth`) plutôt qu'avalées en silence.
8. **Vie privée** : aucune donnée réelle d'un utilisateur dans le dépôt (ni tests, ni démo, ni commentaires). Rien n'est stocké côté serveur ; si cela change, la phrase « Aucune donnée stockée sur nos serveurs » doit changer aussi.
9. **Logique pure testable** : les règles (nommage, classement, comparaison prévu/réalisé, fusion de description) vivent dans `shared/utils/` ou `app/utils/`, importent explicitement ce dont elles ont besoin (pas d'import automatique Nuxt) et ont leurs tests dans `tests/`.
10. **Logos** : seulement ceux fournis par le propriétaire dans `public/brands/`, via `BrandMark`. Ne jamais en télécharger ni en redessiner.
11. **L'appli est en service : l'état gardé dans les navigateurs doit rester lisible.** Ne jamais changer `VERSION` dans `persist.client.ts` (l'historique, les réglages et les débriefs seraient perdus). Un nouveau champ a une valeur par défaut posée par `shared/utils/upgrade.ts` (testé), et chaque écran a son état vide. Les réglages se fusionnent avec les valeurs par défaut.
12. **Jamais d'affirmation invérifiable à l'écran.** Les efforts d'une séance ne sont comptés que si elle a été suivie sur la montre (`comparePlan`) ; une étape dont `exact` est faux n'affiche pas de chiffres ; sans donnée, on le dit.

## Pièges déjà rencontrés

- **Écart serveur/navigateur** : l'état sauvegardé n'est chargé qu'après l'hydratation (`onNuxtReady`). Un composant du layout qui dépend d'un état posé par la page (ex. les rubriques dans `AppSidebar`) ne doit l'afficher qu'après `onMounted`.
- **iPhone (Safari)** : `backdrop-filter` casse dans une scène 3D (`transform-style: preserve-3d`) ; la barre pivotante donne donc sa propre `perspective()` à chaque face. Les animations pilotées par le défilement utilisent `clip-path` + `transform`, pas `mask`.
- **PWA iPhone** : la page de départ `/` ne doit jamais rediriger (sinon la barre du navigateur apparaît). Une navigation hors du site (Strava) ouvre un mini-navigateur qui reste ouvert.
- **Spécificité CSS** : `.card` est déclarée tard dans `main.css` ; pour la surcharger, utiliser un sélecteur plus précis (`.card.list--grid`). Dans un style `scoped`, viser la racine d'un composant enfant avec `:deep(...)`.
- **Bibliothèque Garmin** en CommonJS : import par défaut puis déstructuration.
- **Strava limite les appels** (environ 100 par quart d'heure) : ne demander que ce qui manque, garder le résultat dans le navigateur.
- **MapLibre** (1 Mo) est chargé à la demande, avec `setWorkerUrl` et l'import `?url` du worker.
- **Descriptions Strava** : Strava renvoie les fins de ligne en `\r\n`, même quand on a envoyé `\n`. Toute comparaison passe par `normalizeNewlines` / `locateBlock` (`shared/utils/description.ts`). On n'envoie jamais une description entière : seulement un bloc (`descriptionBlock`), que le serveur fusionne après avoir relu la description actuelle.
- **Heures en français** : en `fr-BE`, `Intl.DateTimeFormat` avec `hour: 'numeric'` rend « 11 h », pas un nombre. Pour lire l'heure, passer par `formatToParts`.
- **Adresse d'une course ouverte directement** (rechargement, notification) : en mode réel le serveur ne connaît pas les courses. Jamais d'erreur 404 au rendu serveur : `useRunPage` et `RunPending` attendent l'état gardé puis la synchro.
- **Vérifier les types pour de vrai** : `npx nuxi typecheck` doit sortir sans erreur ; un script qui n'affiche que la fin de sa sortie peut cacher un échec.
- **Polices absentes de l'atelier** : Google Fonts n'y est pas joignable. Sans précaution, les captures montrent des polices de remplacement, plus étroites, et un texte qui déborde sur un vrai téléphone passe inaperçu (c'est arrivé : « Progression » sous la cloche avec Unbounded). Pour juger une mise en page, servir les vraies polices au navigateur de test (paquets `@fontsource/*`, en réponse à la feuille de style Google Fonts) et regarder à 360 px avec Unbounded, environ 0,7 em par lettre.
- **Un texte qui ne tient pas** ne déborde pas et ne passe pas sous un bouton : un grand titre a sa propre ligne (`AppHeader` : sur-titre et boutons au-dessus, titre dessous, qui rétrécit si un mot est trop long) ; un titre de ligne tient sur deux lignes puis « … » (`.row__main .title`) ; une rangée de cartes ou de chiffres passe en lignes ou en 2 × 2 quand **sa carte** est étroite (`@container`, pas la largeur de l'écran : une carte peut être étroite sur tablette) ; espace insécable avant « ? » et avant un « · » qui ne doit pas commencer une ligne.
- **Composables appelés après un `await`** : cela marche dans le navigateur (une seule appli), jamais côté serveur. Les chargements (`useSync`, `usePlan.load`, `useFitness.load…`) ne tournent que dans le navigateur.

## Publication

- Chaque push sur `main` déclenche `semantic-release` (GitHub Actions) puis le déploiement Vercel. La version et `CHANGELOG.md` sont générés.
- **Commits conventionnels en français.** Les messages `feat:` et `fix:` sont affichés tels quels à l'utilisateur dans la fenêtre « Quoi de neuf » : une phrase claire, côté utilisateur, sans jargon (ex. `feat: écran « État des connexions »…`). `chore:`, `docs:`, `test:`, `ci:`, `refactor:` restent invisibles.
- Avant de pousser : `npx nuxi typecheck`, `npm test`, `npx nuxt build`, puis captures d'écran en démo aux trois tailles.
