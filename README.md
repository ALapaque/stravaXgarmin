# stravaXgarmin

PWA Nuxt qui copie le nom de tes courses Garmin Connect vers Strava, avec titres et analyses générés par IA (ChatGPT).

> Sans compte connecté, l'appli tourne en **mode démo** avec des données fictives. Une fois Strava connecté, elle charge tes vraies courses (et les noms Garmin si Garmin est connecté). Les titres et analyses IA restent simulés.

## Démarrer

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # build de production (.output/)
npm run preview
```

Node 20 ou plus récent.

## Mise en ligne sur Vercel

Pas de base de données : les jetons Strava et Garmin sont chiffrés dans des cookies `httpOnly`, et les routes `server/api/*` deviennent des fonctions Vercel.

1. Crée une appli sur [strava.com/settings/api](https://www.strava.com/settings/api), avec **Authorization Callback Domain** = `strava-x-garmin.vercel.app` (ou `localhost` pour tester en local).
2. Sur Vercel → Settings → Environment Variables :

| Variable | Valeur |
|---|---|
| `NUXT_SESSION_PASSWORD` | Une chaîne aléatoire d'au moins 32 caractères (`openssl rand -base64 32`) |
| `NUXT_STRAVA_CLIENT_ID` | Client ID de l'appli Strava |
| `NUXT_STRAVA_CLIENT_SECRET` | Client Secret de l'appli Strava |

3. Redéploie. En local, mets les mêmes valeurs dans un fichier `.env`.

**Limites assumées sans stockage serveur** : la synchro et les renommages se font quand l'appli est ouverte ; les notifications « appli fermée » ne sont pas possibles.

### Garmin (API non officielle)

Garmin n'a pas d'API publique pour modifier une activité. La connexion passe par l'API interne de Garmin Connect (bibliothèque `@flow-js/garmin-connect`) :
- e-mail + mot de passe, puis code 2FA sur un second écran ; le mot de passe n'est jamais stocké, seul un jeton OAuth1 chiffré reste dans un cookie ;
- le renommage côté Garmin est une option des réglages, désactivée par défaut ;
- Garmin peut changer son API ou refuser des connexions venant des serveurs Vercel sans prévenir.

## Écrans

| Route | Écran |
|---|---|
| `/connexion` | Connexion Strava et Garmin |
| `/` | Accueil : 7 derniers jours, titres à revoir, récap, notifications |
| `/activites` | Toutes les activités, filtre « À revoir » |
| `/activites/:id` | Détail : records battus, cœur et allure animés, noms Garmin / Strava, description enrichie |
| `/activites/:id/titre` | Titre : record, règle de nommage, idées IA (sobre, drôle, épique) ou saisie libre |
| `/activites/:id/analyse` | Analyse de la séance |
| `/stats` | Niveau estimé, records, accès aux récaps |
| `/recap` | Récap semaine ou mois, comparaison, image à partager en story |
| `/notifications` | Centre de notifications |
| `/historique` | Tout ce qui a été modifié sur Strava, avec annulation |
| `/reglages` | Synchro, description, notifications, comptes, thème |
| `/reglages/nommage` | Modèles de nom par type de séance |

## Fonctionnalités

- **Règles de nommage** : un modèle par type de séance (`{distance}`, `{allure}`, `{lieu}`, `{moment}`, `{météo}`…), appliqué aux noms génériques comme « Morning Run ».
- **Historique et annulation** : chaque modification Strava est journalisée ; « Annuler » remet l'ancienne valeur (aussi depuis le toast juste après l'action).
- **Description enrichie** : météo, temps au kilomètre, chaussures et signature, au choix.
- **Records** : détectés à partir des meilleurs efforts (5 km, 10 km, semi), avec titre spécial proposé.
- **Récaps** : semaine (lundi → dimanche) et mois, comparés à la période précédente, exportables en image 1080×1920.
- **Notifications** : centre dans l'appli + notifications système une fois autorisées. Pour les recevoir appli fermée, il faudra du Web Push (clés VAPID + route serveur).

L'état (réglages, historique, notifications, données fictives) est gardé dans le navigateur en attendant une vraie base de données.

## Thèmes

Quatre thèmes, au choix dans Réglages (gardé dans un cookie) :

| id | Nom | Origine |
|---|---|---|
| `vibe` | Vibe (par défaut) | V4 : mise en page V3, couleurs V1 |
| `neon` | Néon | V1 : verre dépoli, grosses typos |
| `oled` | OLED | V3 : noir profond, accent orange |
| `calme` | Calme | V2 : sobre, accent bleu ciel |

**Ajouter un thème**
1. Copie un bloc `[data-theme='…']` dans `app/assets/css/themes.css` et change ses variables.
2. Ajoute une entrée dans `THEMES` (`app/composables/useTheme.ts`) avec la même `id`.

Les composants n'utilisent aucune couleur en dur : tout passe par ces variables.

## Structure

```
app/
  assets/css/     themes.css (variables) · main.css (briques communes)
  components/     barre d'onglets, lignes d'activité, logos, interrupteur, toast…
  composables/    useActivities (données), useAi (IA simulée), useTheme, useSettings
  layouts/        default (avec onglets) · bare (connexion)
  pages/          un fichier par écran
  utils/format.ts formats km, durées, allures, dates
public/           icônes PWA et favicon
```

## Logos des marques

Dépose les fichiers officiels dans `public/brands/` sous les noms `strava.svg`, `garmin.svg` et `chatgpt.svg` (depuis les kits presse / guides de marque, en respectant leurs règles ; Strava impose ses boutons « Connect with Strava » et le logo « Powered by Strava »). Ils sont détectés au build et remplacent les pastilles de couleur. Sans fichier, `BrandMark.vue` affiche une pastille aux couleurs de la marque.

## Démo et page d'accueil

Sans Strava connecté, toutes les pages mènent à `/connexion`, qui présente l'appli. Le bouton « Démo » active des données fictives (cookie `sxg-demo`), signalées par un bandeau jaune en haut de chaque écran avec un bouton « Quitter ».

## Prochaines étapes

1. **Strava** : créer l'appli API, OAuth (`activity:read_all`, `activity:write`), webhook sur les nouvelles activités, `PUT /activities/{id}` pour le nom et la description.
2. **Garmin** : demander l'accès au Garmin Connect Developer Program, puis lire les activités.
3. **ChatGPT** : vérifier l'ouverture de « Sign in with ChatGPT » aux développeurs, sinon clé API OpenAI côté serveur.
4. Remplacer les données de `useActivities` et `useAi` par des routes serveur (`server/api/…`).
