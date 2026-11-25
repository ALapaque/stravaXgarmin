# stravaXgarmin

PWA Nuxt 4 pour les coureurs Garmin sur Strava, pensée pour qui suit un plan (Kiprun Pacer exporté vers Garmin) et court souvent **sur tapis** :

- le nom de chaque séance arrive sur Strava (`[KIPRUN] - Footing 40’` si tu utilises cette convention) ;
- après chaque course, un **Débrief** : séance faite, écourtée ou ratée face au plan, ressenti sur 10, quelques mots, analyse par l'IA, le tout ajouté **sous** ta description Strava (ton texte n'est jamais remplacé) ;
- trois onglets qui répondent chacun à une question : **Aujourd'hui**, **Journal**, **Progression**.

En ligne : https://strava-x-garmin.vercel.app. Interface en français, qui tutoie.

> Sans compte connecté, la page d'accueil présente l'appli ; le bouton « Démo » active des données fictives (cookie `sxg-demo`), signalées par un bandeau rayé en haut de chaque écran avec un bouton « Quitter ».

## Démarrer

```bash
npm install
npm run dev               # http://localhost:3000
npx nuxi typecheck        # types : aucune erreur admise
npm test                  # tests unitaires de la logique pure (Vitest)
npx nuxt build            # build de production (.output/)
```

Serveur de test du build : `PORT=3133 NUXT_SESSION_PASSWORD=<32 caractères min> NUXT_STRAVA_CLIENT_ID=1 NUXT_STRAVA_CLIENT_SECRET=s node .output/server/index.mjs` (arrête l'ancien serveur avant chaque build).

Node 20 ou plus récent. Les règles de travail du dépôt (thèmes, tailles d'écran, mode démo, vie privée, pièges connus) sont dans **[`CLAUDE.md`](CLAUDE.md)** : à lire avant de toucher au code.

## Mise en ligne sur Vercel

Pas de base de données : les connexions Strava, Garmin et IA sont chiffrées dans des cookies `httpOnly`, et les routes `server/api/*` deviennent des fonctions Vercel. Tout le reste (courses, débriefs, réglages, historique) est gardé dans le navigateur.

1. Crée une appli sur [strava.com/settings/api](https://www.strava.com/settings/api), avec **Authorization Callback Domain** = `strava-x-garmin.vercel.app` (ou `localhost` pour tester en local).
2. Sur Vercel → Settings → Environment Variables :

| Variable | Valeur |
|---|---|
| `NUXT_SESSION_PASSWORD` | Une chaîne aléatoire d'au moins 32 caractères (`openssl rand -base64 32`) |
| `NUXT_STRAVA_CLIENT_ID` | Client ID de l'appli Strava |
| `NUXT_STRAVA_CLIENT_SECRET` | Client Secret de l'appli Strava |

3. Redéploie. En local, mets les mêmes valeurs dans un fichier `.env`.

**Limites assumées sans stockage serveur** : la synchro et les renommages se font quand l'appli est ouverte ; les notifications « appli fermée » ne sont pas possibles.

### Sources de données

- **Strava** : API officielle v3, OAuth (`read`, `activity:read_all`, `activity:write`). Strava limite les appels (environ 100 par quart d'heure) : l'appli ne demande que ce qui manque et garde le résultat dans le navigateur.
- **Garmin Connect** : API **non officielle** (`@flow-js/garmin-connect`). E-mail + mot de passe, puis code 2FA ; le mot de passe n'est jamais stocké. Sert au plan (calendrier Garmin, où arrivent les séances Kiprun), aux noms de la montre, à la forme (VO2max, statut, préparation, récupération, temps prédits) et aux records. Le renommage côté Garmin est une option, désactivée par défaut. Garmin peut changer son API sans prévenir : chaque lecture est indépendante et son échec apparaît dans « État des connexions ».
- **IA** : la clé de l'utilisateur, chez le fournisseur de son choix (Gemini gratuit, Mistral, OpenAI), au format « chat completions » (`server/utils/ai.ts`). La clé vit dans un cookie chiffré.

## Écrans

| Adresse | Écran |
|---|---|
| `/` | **Aujourd'hui** : alertes, une carte principale (course à débriefer, séance du jour, prochaine séance ou dernière course), « Ta semaine » face au plan, objectif. Sans compte ni démo : la page de présentation (sans redirection, pour l'appli installée sur iPhone). |
| `/journal` | **Journal** : rubriques Tout (plan et courses sur une ligne de temps, séances sautées comprises), À venir (le plan détaillé : profil, étapes, source, aide pour exporter depuis Kiprun), À débriefer. |
| `/progression` | **Progression** : rubriques Régularité (plan suivi sur 8 semaines, semaine par semaine, série en cours, charge et risque de blessure, accès au bilan), Forme (Garmin et objectif ; sans Garmin, estimation du niveau par l'IA), Records (meilleurs temps et compétitions), Matériel (chaussures et usure). |
| `/bilan` | **Bilan** de la semaine choisie (`?semaine=AAAA-MM-JJ`) ou du mois (`?p=mois`) : chiffres comparés, plan suivi, records, lecture par l'IA, image à partager en story. |
| `/objectif` | Objectif course : compte à rebours et temps prédit. |
| `/activites/:id` | Une course : tours (pensée pour le tapis), cardio par zones (celles de la montre Garmin, sinon du compte Strava, avec le temps par zone compté à la source ; une course d'avant un changement de réglage de la montre est relue avec les zones d'aujourd'hui, un bouton ramène à celles du jour), prévu contre réalisé, carte si GPS, débrief. |
| `/activites/:id/debrief` | **Débrief** (écran de concentration, sans barre du bas) : issue, ressenti, note, titre, analyse, publication sur Strava. |
| `/notifications` | Centre de notifications (la cloche). |
| `/reglages` | Réglages, par l'avatar : Comptes, Titres et publication, Coureur, Notifications, Apparence, À propos (quoi de neuf, version, quitter la démo). |
| `/reglages/comptes` | Strava, Garmin (et « Renommer aussi sur Garmin »), IA, synchro à la demande, accès à l'état des connexions. |
| `/reglages/etat` | État des connexions : ce que l'appli a réussi à lire, et quand. |
| `/reglages/synchro` | Synchro automatique, « Écraser un nom Strava », convention de titres (automatique, toujours, jamais ; sources ; étiquette d'échec ; exemple en direct), ce que le Débrief publie, accès aux règles de nommage et à l'historique. |
| `/reglages/nommage` | Modèles de nom par type de séance, pour les noms génériques. |
| `/reglages/coureur` | Les cinq zones cardio (celles de la montre Garmin, du compte Strava, ou calculées sur la FC max), FC max (estimée ou saisie), objectif, seuil d'usure des chaussures. |
| `/reglages/notifications` | Notifications sur le téléphone et par sorte. |
| `/reglages/apparence` | Les six thèmes et la personnalisation (couleur, arrondis, police, fond animé). |
| `/historique` | Tout ce qui a été modifié sur Strava, avec annulation. |
| `/connexion`, `/connexion/garmin`, `/connexion/ia` | Connexions. |

Anciennes adresses (redirigées, côté serveur et navigateur, règles dans `shared/utils/nav.ts`) : `/activites` → `/journal`, `/plan` → `/journal?onglet=a-venir`, `/stats` → `/progression`, `/recap` → `/bilan`, `/reglages?onglet=…` → la sous-page correspondante, `/activites/:id/titre` et `/analyse` → le Débrief.

## Navigation

- **Téléphone et tablette** : barre du bas à deux faces qui pivote. Face avant : les trois onglets. En arrivant sur un écran à rubriques (Journal, Progression), elle pivote vers ses rubriques ; à gauche, les deux autres onglets en petit. Les réglages n'ont pas de rubriques dans la barre.
- **Ordinateur** (dès 1080 px) : barre latérale, rubriques dépliées sous l'onglet ouvert ; en bas Notifications, Réglages, version.

## Où sont les règles

La logique pure vit dans `shared/utils/` (partagée navigateur et serveur) et a ses tests dans `tests/` :

| Fichier | Règles |
|---|---|
| `titles.ts` | Convention « [SOURCE] - Titre », titre affiché, source proposée |
| `naming.ts`, `classify.ts` | Noms génériques, modèles de nom, type de séance |
| `planmatch.ts`, `compliance.ts`, `workout.ts` | Course reliée à sa séance, prévu contre réalisé, plan suivi par semaine |
| `debrief.ts`, `description.ts` | Débrief, texte ajouté sous la description Strava (jamais de remplacement) |
| `today.ts`, `journal.ts` | Carte principale d'Aujourd'hui, « Ta semaine », alertes ; semaines du Journal |
| `progress.ts` | Plan suivi sur 8 semaines, série en cours, courses par semaine, compétitions |
| `bilan.ts` | Semaine du bilan, plan suivi de la semaine, ce qui part chez l'IA (chiffres, plan suivi, ressentis sur 10, jamais les notes écrites) |
| `zones.ts` | Zones cardio : lecture de celles de la montre Garmin et du compte Strava, calcul sur la FC max, choix entre les trois, relecture d'une ancienne course avec les zones d'aujourd'hui, FC max estimée |
| `nav.ts` | Anciennes adresses, retour depuis une course |
| `health.ts` | État des connexions |
| `demo.ts` | Données de démo, datées par rapport au jour (aucune donnée réelle) |

## Thèmes

Six thèmes, au choix dans Réglages → Apparence (gardé dans un cookie) : **Néon** (par défaut), **Carbone** (angles vifs), **Papier** (clair), **Abysse**, **Rétro 84**, **Trail**, plus des réglages sur mesure (couleur, arrondis, police, fond animé).

Les composants n'utilisent aucune couleur, police ni arrondi en dur : tout passe par les variables de `app/assets/css/themes.css`. Pour ajouter un thème, copie un bloc `[data-theme='…']`, change ses variables et ajoute-le dans `THEMES` (`app/composables/useTheme.ts`).

## Structure

```
app/
  assets/css/     themes.css (variables) · main.css (mise en page, utilitaires, animations)
  components/     barre du bas, barre latérale, en-tête, vignettes, graphiques, débrief…
  composables/    état et logique côté navigateur (useActivities, usePlan, useDebriefs, useFitness…)
  layouts/        default (avec navigation) · bare (présentation, connexion)
  pages/          un fichier par écran
  plugins/        persist.client.ts : état gardé dans le navigateur (clés sxg:v2:…)
  utils/          fonctions importées automatiquement (route, image à partager, ressenti…)
server/
  api/            auth/strava, strava, garmin, ai, ia, me, changelog
  utils/          strava.ts, garmin.ts, ai.ts, sessions.ts
shared/utils/     logique pure testée (voir plus haut)
tests/            Vitest
public/           icônes PWA, favicon, logos des marques (public/brands/)
```

## Logos des marques

Les logos sont dans `public/brands/` (`strava`, `garmin`, `chatgpt`), fournis par le propriétaire du projet et affichés via `BrandMark.vue` (qui montre une pastille aux couleurs de la marque sans fichier). Ne jamais en télécharger ni en redessiner.

## Versions et notes de version

[semantic-release](https://semantic-release.gitbook.io/) tourne à chaque push sur `main` (`.github/workflows/release.yml`) : il lit les messages de commit, choisit la version, écrit `CHANGELOG.md` (sections en français) et crée la release GitHub. Le commit `chore(release): x.y.z` qu'il pousse est ensuite déployé par Vercel.

Les messages de commit suivent [Conventional Commits](https://www.conventionalcommits.org/fr/), en français :

| Préfixe | Effet |
|---|---|
| `feat: …` | version mineure (1.**2**.0), rubrique « Nouveautés » |
| `fix: …` | correctif (1.2.**1**), rubrique « Corrections » |
| `perf: …` | correctif, rubrique « Performances » |
| `feat!: …` ou `BREAKING CHANGE:` | version majeure (**2**.0.0) |
| `chore:`, `docs:`, `refactor:`, `style:`, `test:`, `ci:` | pas de version, n'apparaît pas |

Le titre d'un `feat:` ou `fix:` est affiché tel quel dans la fenêtre « Quoi de neuf » : écris-le pour les coureurs, sans jargon.

Avant de pousser : `npx nuxi typecheck`, `npm test`, `npx nuxt build`, puis des captures en démo aux trois tailles (390, 820 et 1440 px), au moins en Néon, Carbone et Papier.
