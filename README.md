# stravaXgarmin

PWA Nuxt qui copie le nom de tes courses Garmin Connect vers Strava, avec titres et analyses générés par IA (ChatGPT).

> État actuel : interface complète avec des **données fictives**. Les appels Strava, Garmin et ChatGPT à brancher sont marqués `TODO` dans le code, et la date du jour est figée (`TODAY` dans `useActivities.ts`).

## Démarrer

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # build de production (.output/)
npm run preview
```

Node 20 ou plus récent.

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

`BrandMark.vue` affiche pour l'instant un emplacement aux couleurs de Strava (#FC4C02), Garmin (#007CC3) et ChatGPT (#10A37F). Remplace-les par les fichiers officiels des kits presse, en respectant les guides de marque (Strava impose ses boutons « Connect with Strava » et le logo « Powered by Strava »).

## Prochaines étapes

1. **Strava** : créer l'appli API, OAuth (`activity:read_all`, `activity:write`), webhook sur les nouvelles activités, `PUT /activities/{id}` pour le nom et la description.
2. **Garmin** : demander l'accès au Garmin Connect Developer Program, puis lire les activités.
3. **ChatGPT** : vérifier l'ouverture de « Sign in with ChatGPT » aux développeurs, sinon clé API OpenAI côté serveur.
4. Remplacer les données de `useActivities` et `useAi` par des routes serveur (`server/api/…`).
