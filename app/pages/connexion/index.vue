<script setup lang="ts">
import { Type, Sparkles, Trophy, FileText, RotateCcw, Bell, ShieldCheck, ArrowDown } from 'lucide-vue-next'

definePageMeta({ layout: 'bare' })
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

const FEATURES = [
  { icon: Type, color: 'var(--accent-text)', title: 'Des noms qui veulent dire quelque chose', text: 'Le nom donné par ta montre arrive sur Strava. Sinon, tes propres modèles : distance, allure, lieu, météo.' },
  { icon: Sparkles, color: 'var(--chatgpt)', title: 'Des titres par IA', text: 'Sobre, drôle ou épique : trois idées par course avec ton compte ChatGPT, ou le tien écrit à la main.' },
  { icon: Trophy, color: 'var(--ok)', title: 'Tes records repérés', text: '5 km, 10 km, semi : dès que tu bats un record, l’appli le voit et te propose le titre qui va avec.' },
  { icon: FileText, color: 'var(--info)', title: 'Une description qui raconte la course', text: 'Météo, temps au kilomètre et chaussures ajoutés à la description Strava, si tu le veux.' },
  { icon: RotateCcw, color: 'var(--type-tempo)', title: 'Tout est annulable', text: 'Chaque changement fait sur Strava ou Garmin est noté et se défait d’un tap.' },
  { icon: Bell, color: 'var(--ko)', title: 'Récaps et notifications', text: 'Ta semaine et ton mois en un écran, prêts à partager en story.' },
]

const STEPS = [
  { title: 'Connecte Strava', text: 'L’appli lit tes courses et peut modifier leur nom.' },
  { title: 'Ajoute Garmin si tu veux', text: 'Pour récupérer les noms de ta montre, et même renommer côté Garmin.' },
  { title: 'Cours', text: 'À chaque ouverture de l’appli, les noms génériques sont remplacés.' },
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

    <!-- Héros -->
    <section class="hero">
      <p class="kicker label">Pour les coureurs Garmin sur Strava</p>
      <h1 class="h1 h1--xl">
        Fini les <span class="strike">« Morning Run »</span>. Tes courses <span class="garmin">Garmin</span>, bien nommées sur <span class="strava">Strava</span>.
      </h1>
      <p class="lead">Le nom de chaque sortie suit ta montre jusqu’à Strava, avec des titres par IA, tes records et tes récaps en prime.</p>
      <SyncDemo />
    </section>

    <section class="actions" aria-label="Connexion">
      <p v-if="error" class="card card--pad err" role="alert">{{ error }}</p>
      <a v-if="!accounts.strava.connected" href="/api/auth/strava/login" class="btn btn--brand" style="--brand: var(--strava)">
        <BrandMark brand="strava" :size="28" inverse />
        Connecter Strava
      </a>
      <NuxtLink v-if="!accounts.garmin.connected" to="/connexion/garmin" class="btn btn--brand" style="--brand: var(--garmin)">
        <BrandMark brand="garmin" :size="28" inverse />
        Connecter Garmin
      </NuxtLink>
      <NuxtLink v-if="accounts.strava.connected" to="/" class="btn btn--primary">Aller à l’accueil</NuxtLink>
      <button v-else type="button" class="link center" @click="enterDemo">Explorer la démo avec des données fictives</button>
      <a href="#fonctions" class="more"><ArrowDown :size="18" aria-hidden="true" /> Ce que fait l’appli</a>
    </section>

    <!-- Fonctionnalités -->
    <section id="fonctions" class="section">
      <h2 class="h1 sec-title">Tout ce que Strava ne fait pas pour tes noms de course</h2>
      <div class="features">
        <article v-for="f in FEATURES" :key="f.title" class="card feature reveal">
          <span class="tile" :style="{ '--tile': f.color }" aria-hidden="true"><component :is="f.icon" :size="22" /></span>
          <h3 class="title">{{ f.title }}</h3>
          <p>{{ f.text }}</p>
        </article>
      </div>
    </section>

    <!-- Aperçu animé -->
    <section class="section">
      <h2 class="h1 sec-title">Tes séances, vivantes</h2>
      <div class="card showcase reveal">
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
      <p class="lead">Le cœur bat à ton vrai rythme, les lignes défilent à ton allure. Plus quatre thèmes, de « Néon » à « Calme ».</p>
    </section>

    <!-- Étapes -->
    <section class="section">
      <h2 class="h1 sec-title">En route en une minute</h2>
      <ol class="steps">
        <li v-for="(s, i) in STEPS" :key="s.title" class="card step reveal">
          <span class="n num" aria-hidden="true">{{ i + 1 }}</span>
          <span class="row__main">
            <span class="title">{{ s.title }}</span>
            <span class="text">{{ s.text }}</span>
          </span>
        </li>
      </ol>
    </section>

    <!-- Confidentialité -->
    <section class="card card--pad privacy reveal">
      <ShieldCheck :size="26" aria-hidden="true" />
      <div>
        <h2 class="h2">Tes identifiants restent à toi</h2>
        <ul>
          <li>Ton mot de passe Garmin sert une fois et n’est jamais enregistré.</li>
          <li>Les accès sont des jetons chiffrés, gardés dans ton navigateur, sans base de données.</li>
          <li>Rien n’est modifié sans que tu l’aies activé, et tout s’annule.</li>
        </ul>
      </div>
    </section>

    <section class="actions final">
      <a v-if="!accounts.strava.connected" href="/api/auth/strava/login" class="btn btn--brand" style="--brand: var(--strava)">
        <BrandMark brand="strava" :size="28" inverse />
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
  gap: 16px;
  margin-top: 16px;
}

.kicker {
  color: var(--accent-text);
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
  animation: strike 0.6s var(--ease-out) 0.7s backwards;
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
  animation: nudge 1.6s ease-in-out infinite;
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
  margin-top: 20px;
}

.sec-title {
  font-size: 28px;
}

.features {
  display: grid;
  gap: 12px;
}

.feature {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 18px;
}

.feature h3 {
  margin: 4px 0 0;
  font-size: 17px;
}

.feature p,
.step .text {
  margin: 0;
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
  margin-top: 20px;
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
  margin-top: 8px;
}

.foot {
  text-align: center;
  padding: 8px 0 4px;
}

/* Les blocs apparaissent quand on arrive dessus en faisant défiler (navigateurs compatibles) */
@supports (animation-timeline: view()) {
  .reveal {
    animation: rise linear both;
    animation-timeline: view();
    animation-range: entry 0% entry 60%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .reveal,
  .more svg,
  .strike::after {
    animation: none;
  }
}
</style>
