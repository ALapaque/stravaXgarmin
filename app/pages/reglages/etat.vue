<script setup lang="ts">
/*
 * État des connexions : ce que l'appli a réussi à lire chez Strava, Garmin et l'IA, et quand.
 * Les durées (« il y a 3 min ») dépendent de l'heure : affichées seulement une fois la page montée,
 * sinon le rendu serveur et le navigateur ne seraient pas d'accord.
 */
import { CircleCheck, CircleAlert, CircleDashed, RefreshCw, Copy, Sparkles } from 'lucide-vue-next'

useHead({ title: 'État des connexions · stravaXgarmin' })

const { health, connected, summary, entry } = useHealth()
const { accounts } = useAccounts()
const { active: demo } = useDemo()
const { run, syncing } = useSync()
const { show } = useToast()
const version = useRuntimeConfig().public.version as string

const mounted = ref(false)
// Les durées relatives avancent toutes seules pendant que l'écran reste ouvert
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  mounted.value = true
  timer = setInterval(() => (now.value = Date.now()), 30_000)
})
onBeforeUnmount(() => clearInterval(timer))
const ago = (iso: string | null) => (mounted.value ? formatAgo(iso, now.value) : '')

type Provider = 'strava' | 'garmin' | 'ai'

const GROUPS = computed(() => {
  const name = (p: Provider) => {
    if (demo.value) return 'Compte de démo'
    if (!connected.value[p]) return null
    return (p === 'ai' ? accounts.value.ai.name : accounts.value[p].name) ?? 'Connecté'
  }
  return ([
    { id: 'strava', title: 'Strava' },
    { id: 'garmin', title: 'Garmin Connect' },
    { id: 'ai', title: 'IA' },
  ] as const).map((g) => ({
    ...g,
    account: name(g.id),
    sources: HEALTH_SOURCES.filter((s) => s.provider === g.id),
  }))
})

/** Où se reconnecter quand une session a expiré (mêmes liens que Réglages → Comptes). */
const RECONNECT: Record<Provider, { href?: string; to?: string }> = {
  strava: { href: '/api/auth/strava/login' },
  garmin: { to: '/connexion/garmin' },
  ai: { to: '/connexion/ia?retour=/reglages/etat' },
}

const errorCount = computed(() => summary.value.errors.length)

async function readAll() {
  await run(true)
}

async function copyDiagnostic() {
  const text = diagnosticText({
    version,
    now: new Date().toISOString(),
    connected: connected.value,
    aiProvider: demo.value ? 'démo' : accounts.value.ai.provider,
    health: health.value,
    userAgent: navigator.userAgent,
  })
  try {
    await navigator.clipboard.writeText(text)
    show('Diagnostic copié')
  } catch {
    show('Copie impossible ici')
  }
}
</script>

<template>
  <div class="stack stack--wide etat-page">
    <BackLink to="/reglages" label="Réglages" />
    <div class="title-block">
      <h1 class="h1">État des connexions</h1>
      <p class="lead">Ce que l’appli a réussi à lire, et quand.</p>
    </div>

    <div class="cols etat">
      <div class="col span-all overview">
        <section v-if="!errorCount" class="card card--pad summary" aria-live="polite">
          <span class="tile summary-tile" style="--tile: var(--ok)" aria-hidden="true"><CircleCheck :size="24" /></span>
          <span class="row__main">
            <span class="h2">Tout fonctionne</span>
            <span class="summary-sub">{{ mounted && summary.lastAt ? `Dernière lecture ${ago(summary.lastAt)}.` : ' ' }}</span>
          </span>
        </section>
        <section v-else class="card card--pad summary summary--ko" aria-live="polite">
          <span class="tile summary-tile" style="--tile: var(--ko)" aria-hidden="true"><CircleAlert :size="24" /></span>
          <span class="row__main">
            <span class="h2">{{ errorCount }} {{ errorCount > 1 ? 'lectures' : 'lecture' }} en échec</span>
            <span class="summary-sub">Le reste continue de marcher avec ce qui a déjà été lu.</span>
          </span>
        </section>

        <div class="actions">
          <button type="button" class="btn btn--primary" :disabled="syncing" @click="readAll">
            {{ syncing ? 'Lecture en cours…' : 'Tout relire maintenant' }}
            <RefreshCw :size="20" :class="{ spin: syncing }" aria-hidden="true" />
          </button>
          <button type="button" class="btn btn--secondary" @click="copyDiagnostic">
            <Copy :size="18" aria-hidden="true" /> Copier le diagnostic
          </button>
          <p class="fine">Le diagnostic ne contient ni ton nom, ni tes courses, ni tes accès : seulement l’état de chaque lecture.</p>
        </div>
      </div>

      <section v-for="g in GROUPS" :key="g.id" class="card list group" :class="`group--${g.id}`" :aria-labelledby="`group-${g.id}`">
        <div class="row group-head">
          <BrandMark v-if="g.id !== 'ai'" :brand="g.id" :size="40" />
          <span v-else class="tile ai-tile" aria-hidden="true"><Sparkles :size="22" /></span>
          <span class="row__main">
            <span :id="`group-${g.id}`" class="title">{{ g.title }}</span>
            <span class="hint">{{ g.account ?? 'Non connecté' }}</span>
          </span>
          <template v-if="!g.account">
            <a v-if="g.id === 'strava'" href="/api/auth/strava/login" class="btn btn--sm btn--brand" style="--brand: var(--strava)">Connecter</a>
            <NuxtLink v-else-if="g.id === 'garmin'" to="/connexion/garmin" class="btn btn--sm btn--brand" style="--brand: var(--garmin)">Connecter</NuxtLink>
            <NuxtLink v-else :to="{ path: '/connexion/ia', query: { retour: '/reglages/etat' } }" class="btn btn--sm btn--primary">Activer</NuxtLink>
          </template>
        </div>

        <div
          v-for="s in g.sources"
          :key="s.key"
          class="row source"
          :class="[`is-${g.account ? entry(s.key).status : 'off'}`]"
        >
          <span class="state" aria-hidden="true">
            <CircleCheck v-if="g.account && entry(s.key).status === 'ok'" :size="20" />
            <CircleAlert v-else-if="g.account && entry(s.key).status === 'error'" :size="20" />
            <CircleDashed v-else :size="20" />
          </span>
          <span class="row__main">
            <span class="title">{{ s.label }}</span>
            <template v-if="!g.account">
              <span class="hint">{{ s.hint }}</span>
            </template>
            <template v-else-if="entry(s.key).status === 'error'">
              <span class="hint err">{{ entry(s.key).error }}</span>
              <span class="help">
                <template v-if="entry(s.key).code === 401">
                  <a v-if="RECONNECT[g.id].href" :href="RECONNECT[g.id].href" class="link">Reconnecter</a>
                  <NuxtLink v-else :to="RECONNECT[g.id].to!" class="link">Reconnecter</NuxtLink>
                </template>
                <template v-else-if="entry(s.key).code === 429">Trop de demandes : réessaie dans un quart d’heure.</template>
                <template v-else>Réessaie dans quelques minutes. Si ça dure, copie le diagnostic.</template>
              </span>
              <span v-if="mounted && entry(s.key).okAt" class="fine">Dernière réussite : {{ ago(entry(s.key).okAt) }}</span>
            </template>
            <span v-else-if="entry(s.key).status === 'ok'" class="hint">{{ entry(s.key).info ?? s.hint }}</span>
            <span v-else class="hint">{{ s.hint }}</span>
          </span>
          <span v-if="g.account" class="label when">
            <span class="sr-only">{{ entry(s.key).status === 'error' ? 'Échec' : entry(s.key).status === 'ok' ? 'Réussi' : 'Pas encore lu' }}, </span>
            {{ ago(entry(s.key).at) }}
          </span>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.title-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.overview {
  gap: 14px;
}

/* ── Résumé ── */
.summary {
  display: flex;
  align-items: center;
  gap: 14px;
}

.summary > * {
  position: relative;
  z-index: 1;
}

.summary-tile {
  width: 48px;
  height: 48px;
  animation: pop 0.6s var(--ease-spring) 0.2s backwards;
}

.summary .h2 {
  font-size: 22px;
}

.summary-sub {
  font-size: 15px;
  color: var(--ink-2);
}

/* ── Actions ── */
.actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.actions .btn--secondary svg {
  color: var(--accent-text);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ── Groupes ── */
.group-head {
  min-height: 72px;
}

.ai-tile {
  --tile: var(--accent-text);
  width: 40px;
  height: 40px;
}

.hint {
  font-size: 15px;
  color: var(--muted);
}

.source {
  align-items: flex-start;
}

.source .row__main {
  gap: 3px;
}

/* Libellés en entier, même dans une colonne étroite */
.source .title {
  white-space: normal;
}

.state {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  margin-top: 1px;
  border-radius: var(--r-pill);
  color: var(--muted);
  background: color-mix(in srgb, var(--muted) 12%, transparent);
}

.is-ok .state {
  color: var(--ok);
  background: color-mix(in srgb, var(--ok) 16%, transparent);
}

.is-error .state {
  color: var(--ko);
  background: color-mix(in srgb, var(--ko) 16%, transparent);
  animation: pop 0.6s var(--ease-spring) 0.3s backwards;
}

.is-idle .state {
  opacity: 0.7;
}

.is-off {
  opacity: 0.55;
}

.err {
  color: var(--ko);
  overflow-wrap: anywhere;
}

.help {
  font-size: 15px;
  color: var(--ink-2);
}

.help .link {
  display: inline-block;
  padding: 6px 0;
}

.when {
  flex-shrink: 0;
  margin-top: 6px;
  text-align: right;
  white-space: nowrap;
}

/* Tablette : résumé en haut, groupes en grille */
@media (min-width: 720px) {
  .etat {
    gap: 16px 20px;
  }

  .overview {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    align-items: start;
    gap: 20px;
  }

  .overview .summary {
    min-height: 100%;
  }

  /* Garmin (4 lectures) occupe la hauteur de Strava + IA : pas de trou sous la colonne la plus courte */
  .group--strava {
    grid-column: 1;
    grid-row: 2;
  }

  .group--garmin {
    grid-column: 2;
    grid-row: 2 / span 2;
  }

  .group--ai {
    grid-column: 1;
    grid-row: 3;
  }
}

/* Ordinateur : résumé et actions à gauche (restent visibles), groupes à droite */
@media (min-width: 1080px) {
  .etat {
    grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
  }

  .etat > .overview {
    display: flex;
    grid-column: 1;
    grid-row: 1 / span 3;
    position: sticky;
    top: 24px;
  }

  .etat > .overview .summary {
    min-height: 0;
    padding: 24px;
  }

  .etat > .group {
    grid-column: 2;
    grid-row: auto;
  }
}
</style>
