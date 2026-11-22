<script setup lang="ts">
/*
 * Présentation de l'appli + connexion, affichée sur / et /connexion quand rien n'est connecté.
 * Design : taste-skill (entrée du héros mot par mot, moments « word-highlight » et « iris-opens »)
 * et ui-ux-pro-max (aperçu de l'appli dans un téléphone, sections courtes, CTA répété).
 */
import { Type, Sparkles, ClipboardCheck, CalendarCheck, RotateCcw, Footprints, ShieldCheck, ArrowDown, Sunrise, NotebookText, TrendingUp } from 'lucide-vue-next'

useHead({
  title: 'stravaXgarmin · Tes courses Garmin, bien nommées sur Strava',
  meta: [{ name: 'description', content: 'Fini les « Morning Run » : le nom de ta séance sur Strava, un Débrief après chaque course, sur tapis comme dehors, et ton plan face à ce que tu as couru.' }],
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
  // Deux mots barrés plutôt qu'un bloc insécable : avec une police large, le titre va à la ligne au lieu de sortir de l'écran
  { t: '« Morning', cls: 'strike strike--join' },
  { t: 'Run ».', cls: 'strike' },
  { t: 'Tes' },
  { t: 'courses' },
  { t: 'Garmin,', cls: 'garmin' },
  { t: 'bien' },
  { t: 'nommées' },
  { t: 'sur' },
  { t: 'Strava.', cls: 'strava' },
]

const FEATURES = [
  { icon: ClipboardCheck, color: 'var(--accent-text)', title: 'Un Débrief après chaque course', text: 'Séance faite, écourtée ou ratée, ton ressenti sur 10 et quelques mots : publiés sous ta description Strava, sans jamais toucher à ton texte.' },
  { icon: Footprints, color: 'var(--type-long)', title: 'Pensé pour le tapis', text: 'Pas de GPS ? Tes tours suffisent : chaque effort, chaque récup, ton cardio, comme dehors.' },
  { icon: CalendarCheck, color: 'var(--ok)', title: 'Prévu contre réalisé', text: 'Ton plan Kiprun passe par Garmin : chaque course est comparée à sa séance, et tu vois semaine après semaine si tu tiens le cap.' },
  { icon: Type, color: 'var(--info)', title: 'Des noms qui veulent dire quelque chose', text: 'Le nom de ta séance arrive sur Strava, au format « [KIPRUN] - Footing 40’ » si tu l’utilises déjà.' },
  { icon: Sparkles, color: 'var(--chatgpt)', title: 'L’IA de ton choix', text: 'Titres, analyse de séance et lecture de ta semaine, avec Gemini (gratuit), Mistral ou OpenAI.' },
  { icon: RotateCcw, color: 'var(--type-tempo)', title: 'Tout s’annule', text: 'Chaque changement est noté et se défait d’un tap.' },
]

/* Trois onglets, trois questions */
const TABS = [
  { icon: Sunrise, name: 'Aujourd’hui', question: 'Qu’est-ce que j’ai à faire maintenant ?', text: 'Le débrief en attente, la séance du jour, ta semaine.' },
  { icon: NotebookText, name: 'Journal', question: 'Qu’ai-je fait, qu’est-ce qui m’attend ?', text: 'Ton plan et tes courses sur une seule ligne de temps.' },
  { icon: TrendingUp, name: 'Progression', question: 'Suis-je régulier ? Est-ce que je progresse ?', text: 'Plan suivi, charge, forme, records et ton bilan de la semaine.' },
]

const STEPS = [
  { title: 'Connecte Strava', text: 'L’appli lit tes courses et peut modifier leur nom.' },
  { title: 'Ajoute Garmin', text: 'Pour ton plan (tes séances Kiprun exportées), les noms de ta montre et ta forme.' },
  { title: 'Cours, puis débriefe', text: 'Le nom de la séance arrive sur Strava ; en trente secondes, ton débrief s’ajoute dessous.' },
]
</script>

<template>
  <div class="stack stack--wide landing">
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
      <p class="lead hero-in" style="--d: 0.75s">Le nom de ta séance arrive sur Strava. Puis le Débrief : ce que tu as fait face au plan, même sur tapis, ton ressenti et l’analyse, publiés sous ta description.</p>

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
      <h2 class="h1 sec-title">Tout ce que Strava ne fait pas pour tes séances</h2>
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

    <!-- Trois onglets, trois questions -->
    <section class="section">
      <h2 class="h1 sec-title">Trois onglets, trois questions</h2>
      <ol class="tabs-list">
        <li v-for="(t, i) in TABS" :key="t.name" class="card tab-card" :style="{ '--i': i }">
          <span class="tile" style="--tile: var(--accent-text)" aria-hidden="true"><component :is="t.icon" :size="22" /></span>
          <span class="row__main">
            <span class="eyebrow">{{ t.name }}</span>
            <h3 class="title q">{{ t.question }}</h3>
            <p class="text">{{ t.text }}</p>
          </span>
        </li>
      </ol>
    </section>

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
      <p class="lead">Le cœur bat à ton vrai rythme, les lignes défilent à ton allure, dehors comme sur tapis. Et six thèmes, de « Néon » à « Trail », que tu peux régler à ton goût.</p>
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
    <section class="card card--pad privacy narrow">
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

    <section class="final narrow">
      <h2 class="h1 sec-title">Prêt pour ta prochaine sortie ?</h2>
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

/* Le trait couvre aussi l'espace jusqu'au mot barré suivant : un seul trait quand ils sont sur la même ligne */
.strike--join::after {
  width: calc(104% + 0.3em);
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

.tabs-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.tab-card {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 18px;
}

.tab-card .eyebrow {
  color: var(--accent-text);
}

.tab-card .q {
  margin: 2px 0 0;
  font-size: 18px;
  line-height: 1.25;
  white-space: normal;
}

.tab-card .text {
  margin: 4px 0 0;
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

/*
 * Tablette et ordinateur : le téléphone passe à droite du titre, le manifeste fait face
 * à la démo de synchro, et les listes deviennent des grilles.
 */
@media (min-width: 720px) {
  .landing {
    max-width: 1120px;
    gap: 32px;
  }

  .features {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 28px 32px;
  }

  .steps,
  .tabs-list {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .tab-card {
    flex-direction: column;
    height: 100%;
  }

  .step {
    flex-direction: column;
    align-items: flex-start;
    height: 100%;
  }

  .sec-title {
    font-size: 40px;
    max-width: 18ch;
  }

  .narrow {
    width: 100%;
    max-width: 760px;
    margin-inline: auto;
  }

  .final {
    align-items: center;
    text-align: center;
  }

  .showcase {
    max-width: 760px;
  }
}

@media (min-width: 960px) {
  .hero {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
    column-gap: 56px;
    align-items: center;
    margin-top: 32px;
  }

  .hero > * {
    grid-column: 1;
  }

  .hero > :deep(.phone) {
    grid-column: 2;
    grid-row: 1 / span 6;
    zoom: 1.3;
  }

  .hero .title {
    font-size: 76px;
    line-height: 0.98;
  }

  .hero .lead {
    max-width: 44ch;
    font-size: 19px;
  }

  .actions {
    max-width: 440px;
  }

  .statement-section {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
    align-items: center;
    gap: 56px;
    margin-top: 72px;
  }

  .section {
    margin-top: 56px;
  }

  .features {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
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
