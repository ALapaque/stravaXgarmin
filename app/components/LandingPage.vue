<script setup lang="ts">
/*
 * Présentation de l'appli + connexion, affichée sur / et /connexion quand rien n'est connecté.
 * Design : taste-skill (entrée du héros mot par mot, moments « word-highlight » et « iris-opens »)
 * et ui-ux-pro-max (aperçu de l'appli dans un téléphone, sections courtes, CTA répété).
 */
import { Type, Sparkles, Trophy, FileText, RotateCcw, Bell, ShieldCheck, ArrowDown } from 'lucide-vue-next'

useHead({
  title: 'stravaXgarmin · Tes courses Garmin, bien nommées sur Strava',
  meta: [{ name: 'description', content: 'Fini les « Morning Run » : le nom de tes courses Garmin copié sur Strava, des titres par IA, tes records et tes récaps.' }],
})

const route = useRoute()
const { accounts } = useAccounts()
const { enter: enterDemo } = useDemo()

const ERRORS: Record<string, string> = {
  'strava-refus': 'Connexion Strava annulée.',
  'strava-etat': 'La connexion Strava a expiré, recommence.',
  'strava-permissions': 'Coche « modifier tes activités » sur Strava : sans ça, impossible de renommer.',
}
const error = computed(() => ERRORS[String(route.query.erreur ?? '')])

// Titre découpé en mots pour l'entrée « mot par mot » (chaque mot monte hors de son masque)
const TITLE = [
  { t: 'Fini' },
  { t: 'les' },
  { t: '« Morning Run ».', cls: 'strike' },
  { t: 'Tes' },
  { t: 'courses' },
  { t: 'Garmin,', cls: 'garmin' },
  { t: 'bien' },
  { t: 'nommées' },
  { t: 'sur' },
  { t: 'Strava.', cls: 'strava' },
]

const FEATURES = [
  { icon: Type, color: 'var(--accent-text)', title: 'Des noms qui veulent dire quelque chose', text: 'Le nom de ta montre arrive sur Strava. Sinon, tes propres modèles : distance, allure, lieu, météo.' },
  { icon: Sparkles, color: 'var(--chatgpt)', title: 'Des titres par IA', text: 'Sobre, drôle ou épique : trois idées par course avec ta clé OpenAI, ou le tien écrit à la main.' },
  { icon: Trophy, color: 'var(--ok)', title: 'Tes records repérés', text: '5 km, 10 km, semi : record battu, titre proposé.' },
  { icon: FileText, color: 'var(--info)', title: 'Une description qui raconte', text: 'Météo, temps au kilomètre et chaussures ajoutés sur Strava.' },
  { icon: RotateCcw, color: 'var(--type-tempo)', title: 'Tout s’annule', text: 'Chaque changement est noté et se défait d’un tap.' },
  { icon: Bell, color: 'var(--ko)', title: 'Récaps à partager', text: 'Ta semaine et ton mois en un écran, prêts pour une story.' },
]

const STEPS = [
  { title: 'Connecte Strava', text: 'L’appli lit tes courses et peut modifier leur nom.' },
  { title: 'Ajoute Garmin si tu veux', text: 'Pour récupérer les noms de ta montre, et même renommer côté Garmin.' },
  { title: 'Cours', text: 'À chaque ouverture, les noms génériques sont remplacés.' },
]
</script>

<template>
  <div class="stack landing">
    <header class="top">
      <span class="logo">
        <img src="/favicon.svg" alt="" width="34" height="34">
        <span class="h2">stravaXgarmin</span>
      </span>
      <button v-if="!accounts.strava.connected" type="button" class="link" @click="enterDemo">Démo</button>
      <NuxtLink v-else to="/" class="link">Accueil</NuxtLink>
    </header>

    <!-- Héros : le titre monte mot par mot, puis le texte, les boutons et le téléphone se posent -->
    <section class="hero">
      <p class="kicker label">Pour les coureurs Garmin sur Strava</p>
      <h1 class="h1 h1--xl title" aria-label="Fini les « Morning Run ». Tes courses Garmin, bien nommées sur Strava.">
        <template v-for="(w, i) in TITLE" :key="i">
          <span class="mask" aria-hidden="true"><span class="word" :class="w.cls" :style="{ '--i': i }">{{ w.t }}</span></span>{{ ' ' }}
        </template>
      </h1>
      <p class="lead hero-in" style="--d: 0.75s">Le nom que ta montre donne à chaque séance arrive sur Strava. En prime : titres par IA, records et récaps.</p>

      <div class="actions hero-in" style="--d: 0.9s" aria-label="Connexion">
        <p v-if="error" class="card card--pad err" role="alert">{{ error }}</p>
        <a v-if="!accounts.strava.connected" href="/api/auth/strava/login" class="btn btn--brand cta">
          <BrandMark brand="strava" :size="28" />
          Connecter Strava
        </a>
        <NuxtLink v-if="!accounts.garmin.connected" to="/connexion/garmin" class="btn btn--secondary">
          <BrandMark brand="garmin" :size="28" />
          Connecter Garmin
        </NuxtLink>
        <NuxtLink v-if="accounts.strava.connected" to="/" class="btn btn--primary">Aller à l’accueil</NuxtLink>
        <button v-else type="button" class="link center" @click="enterDemo">Explorer la démo avec des données fictives</button>
        <p class="trust fine"><ShieldCheck :size="16" aria-hidden="true" /> Aucune donnée stockée sur nos serveurs</p>
      </div>

      <LandingHeroPhone />
      <a href="#manifeste" class="more"><ArrowDown :size="18" aria-hidden="true" /> Pourquoi cette appli</a>
    </section>

    <!-- Manifeste : la phrase s'allume mot à mot au défilement -->
    <section id="manifeste" class="section statement-section">
      <LandingWordHighlight
        text="Ta montre sait que c’était un fractionné. Strava croit que c’était un Morning Run. On remet les choses dans l’ordre, à chaque course."
        :strong="['fractionné', 'Morning', 'ordre']"
      />
      <SyncDemo />
    </section>

    <!-- Fonctionnalités, sur leur propre fond, révélées par un disque qui s'ouvre -->
    <LandingIrisSection>
      <h2 class="h1 sec-title">Tout ce que Strava ne fait pas pour tes noms de course</h2>
      <div class="features">
        <article v-for="f in FEATURES" :key="f.title" class="feature">
          <span class="tile" :style="{ '--tile': f.color }" aria-hidden="true"><component :is="f.icon" :size="22" /></span>
          <span class="row__main">
            <h3 class="title">{{ f.title }}</h3>
            <p>{{ f.text }}</p>
          </span>
        </article>
      </div>
    </LandingIrisSection>

    <!-- Aperçu animé -->
    <section class="section">
      <h2 class="h1 sec-title">Tes séances, vivantes</h2>
      <div class="card showcase">
        <div class="kpi" style="color: var(--ko)">
          <span class="label">fréquence cardiaque</span>
          <span class="num">168 <small>bpm</small></span>
          <KpiPulse kind="hr" :value="168" />
        </div>
        <div class="kpi" style="color: var(--ok)">
          <span class="label">allure</span>
          <span class="num">4:41 <small>/km</small></span>
          <KpiPulse kind="pace" :value="281" />
        </div>
      </div>
      <p class="lead">Le cœur bat à ton vrai rythme, les lignes défilent à ton allure. Et quatre thèmes, de « Néon » à « Calme ».</p>
    </section>

    <!-- Étapes -->
    <section class="section">
      <h2 class="h1 sec-title">En route en une minute</h2>
      <ol class="steps">
        <li v-for="(s, i) in STEPS" :key="s.title" class="card step">
          <span class="n num" aria-hidden="true">{{ i + 1 }}</span>
          <span class="row__main">
            <span class="title">{{ s.title }}</span>
            <span class="text">{{ s.text }}</span>
          </span>
        </li>
      </ol>
    </section>

    <!-- Confidentialité -->
    <section class="card card--pad privacy">
      <ShieldCheck :size="26" aria-hidden="true" />
      <div>
        <h2 class="h2">Aucune donnée stockée chez nous</h2>
        <ul>
          <li>Pas de base de données : ni tes courses ni tes comptes ne sont conservés sur nos serveurs.</li>
          <li>Tes accès Strava et Garmin sont des jetons chiffrés, gardés dans ton navigateur. Te déconnecter les efface.</li>
          <li>Ton mot de passe Garmin sert une seule fois et n’est jamais enregistré.</li>
          <li>Rien n’est modifié sans ton accord, et tout s’annule.</li>
        </ul>
      </div>
    </section>

    <section class="final">
      <h2 class="h1 sec-title">Prêt pour ta prochaine sortie ?</h2>
      <a v-if="!accounts.strava.connected" href="/api/auth/strava/login" class="btn btn--brand cta">
        <BrandMark brand="strava" :size="28" />
        Commencer avec Strava
      </a>
      <NuxtLink v-else to="/" class="btn btn--primary">Aller à l’accueil</NuxtLink>
    </section>

    <footer class="fine foot">
      stravaXgarmin n’est affilié ni à Strava, ni à Garmin, ni à OpenAI. Le renommage côté Garmin passe par une API non officielle.
    </footer>
  </div>
</template>

<style scoped>
.landing {
  gap: 20px;
}

.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
}

.hero {
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin-top: 12px;
}

.kicker {
  color: var(--accent-text);
}

/* Entrée du titre : chaque mot monte hors de son masque, 700 ms, en cascade */
.mask {
  display: inline-block;
  overflow: hidden;
  vertical-align: top;
  padding-bottom: 0.08em;
  margin-bottom: -0.08em;
}

.word {
  display: inline-block;
  animation: word-up 0.7s var(--ease-out) backwards;
  animation-delay: calc(0.1s + var(--i) * 45ms);
}

@keyframes word-up {
  from {
    transform: translateY(105%);
  }
}

.hero-in {
  animation: rise 0.7s var(--ease-out) backwards;
  animation-delay: var(--d);
}

.strike {
  position: relative;
  color: var(--muted);
  white-space: nowrap;
}

.strike::after {
  content: '';
  position: absolute;
  left: -2%;
  top: 52%;
  height: 0.09em;
  width: 104%;
  border-radius: 99px;
  background: var(--ko);
  transform-origin: left;
  animation: strike 0.6s var(--ease-out) 0.9s backwards;
}

@keyframes strike {
  from {
    transform: scaleX(0);
  }
}

.garmin {
  color: #3da9f5;
}

.strava {
  color: var(--strava);
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cta {
  --brand: var(--strava);
  box-shadow: 0 10px 28px color-mix(in srgb, var(--strava) 40%, transparent);
}

.trust {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.trust svg {
  color: var(--ok);
}

.err {
  margin: 0;
  color: var(--ko);
  font-weight: 600;
}

.center {
  align-self: center;
}

.more {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: center;
  min-height: 44px;
  color: var(--muted);
  font-weight: 600;
}

.more svg {
  animation: nudge 1.6s ease-in-out 3;
}

@keyframes nudge {
  50% {
    transform: translateY(4px);
  }
}

.section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 24px;
}

.statement-section {
  gap: 28px;
  margin-top: 40px;
}

.sec-title {
  font-size: 28px;
}

.features {
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin-top: 20px;
}

.feature {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.feature h3 {
  margin: 0;
  font-size: 17px;
  white-space: normal;
}

.feature p,
.step .text {
  margin: 2px 0 0;
  color: var(--ink-2);
  font-size: 15px;
}

.showcase {
  display: grid;
  grid-template-columns: 1fr 1fr;
}

.showcase .kpi {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 18px;
}

.showcase .kpi + .kpi {
  border-left: 1px solid var(--line);
}

.showcase .label {
  color: inherit;
}

.showcase .num {
  font-size: 30px;
  color: var(--ink);
}

.showcase small {
  font-size: 14px;
  color: var(--muted);
}

.steps {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.step {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
}

.n {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--primary);
  color: var(--on-primary);
  font-size: 18px;
}

.privacy {
  display: flex;
  gap: 14px;
  margin-top: 24px;
}

.privacy > svg {
  flex-shrink: 0;
  color: var(--ok);
}

.privacy ul {
  margin: 8px 0 0;
  padding-left: 18px;
  color: var(--ink-2);
  font-size: 15px;
}

.privacy li + li {
  margin-top: 6px;
}

.final {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 32px;
}

.foot {
  text-align: center;
  padding: 8px 0 4px;
}

@media (prefers-reduced-motion: reduce) {
  .word,
  .hero-in,
  .more svg,
  .strike::after {
    animation: none;
  }
}
</style>
