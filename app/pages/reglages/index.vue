<script setup lang="ts">
/*
 * Accueil des réglages : une rubrique par thème (tuile, titre, état en une ligne, chevron), chacune sur sa
 * page, puis « À propos ». On y entre par l'avatar ; aucune rubrique dans la barre du bas.
 * Les anciennes adresses /reglages?onglet=… mènent à la bonne sous-page (shared/utils/nav.ts).
 */
import { ChevronRight, Link2, PenLine, HeartPulse, Bell, Palette, Sparkles, LogOut } from 'lucide-vue-next'
import { legacyRedirect } from '#shared/utils/nav'
import { estimateHrMax } from '#shared/utils/zones'

definePageMeta({
  middleware: [(to) => {
    const t = legacyRedirect(to.path, to.query)
    if (t) return navigateTo(t, { replace: true, redirectCode: 301 })
  }],
})

useHead({ title: 'Réglages · stravaXgarmin' })

const settings = useSettings()
const { theme, themes, customized } = useTheme()
const { permission, syncPermission } = useNotifications()
const { current: appVersion, showHistory } = useUpdates()
const { accounts } = useAccounts()
const { active: demo, exit } = useDemo()
const { summary: health } = useHealth()
const { activities } = useActivities()
const convention = useConvention()
const { goalInfo } = useFitness()

// L'état gardé (lectures, autorisation des notifications) n'est connu qu'après l'hydratation
const mounted = ref(false)
onMounted(() => {
  mounted.value = true
  syncPermission()
})
const healthErrors = computed(() => (mounted.value ? health.value.errors.length : 0))

const accountsLine = computed(() => {
  if (demo.value) return 'Mode démo · aucun compte connecté'
  const bits = [
    accounts.value.strava.connected ? 'Strava' : null,
    accounts.value.garmin.connected ? 'Garmin' : null,
    accounts.value.ai.connected ? (accounts.value.ai.name?.split(' · ')[0] ?? 'IA') : null,
  ].filter(Boolean)
  return bits.length ? `${bits.join(', ')} ${bits.length > 1 ? 'connectés' : 'connecté'}` : 'Aucun compte connecté'
})
const publishLine = computed(() =>
  [settings.value.autoSync ? 'Synchro automatique' : 'Synchro à la main', convention.enabled.value ? `[${convention.sources.value[0] ?? 'SOURCE'}] - Titre` : 'titres sans étiquette'].join(' · '),
)
const hrMax = computed(() => settings.value.hrMax || estimateHrMax(activities.value))
const runnerLine = computed(() => {
  const hr = hrMax.value ? `FC max ${hrMax.value} bpm` : 'FC max à préciser'
  const goal = goalInfo.value && !goalInfo.value.past ? `objectif J-${goalInfo.value.days}` : `chaussures ${settings.value.shoeLimitKm} km`
  return `${hr} · ${goal}`
})
const notifLine = computed(() => {
  const kinds = Object.values(settings.value.notify.kinds ?? {})
  const on = kinds.filter(Boolean).length
  const phone = mounted.value && settings.value.notify.system && permission.value === 'granted' ? 'Sur le téléphone' : 'Dans l’appli'
  return `${phone} · ${on} sur ${kinds.length} activées`
})
const themeLine = computed(() => `${themes.find((t) => t.id === theme.value)?.label ?? 'Néon'}${customized.value ? ' · réglages sur mesure' : ''}`)

const SECTIONS = computed(() => [
  { to: '/reglages/comptes', title: 'Comptes', line: healthErrors.value ? `${healthErrors.value} ${healthErrors.value > 1 ? 'lectures' : 'lecture'} en échec · à vérifier` : accountsLine.value, icon: Link2, tile: 'var(--info)', alert: healthErrors.value > 0 },
  { to: '/reglages/synchro', title: 'Titres et publication', line: publishLine.value, icon: PenLine, tile: 'var(--accent-text)', alert: false },
  { to: '/reglages/coureur', title: 'Coureur', line: runnerLine.value, icon: HeartPulse, tile: 'var(--ko)', alert: false },
  { to: '/reglages/notifications', title: 'Notifications', line: notifLine.value, icon: Bell, tile: 'var(--ok)', alert: false },
  { to: '/reglages/apparence', title: 'Apparence', line: themeLine.value, icon: Palette, tile: 'var(--type-race)', alert: false },
])
</script>

<template>
  <div class="stack stack--wide">
    <div class="title-block">
      <p class="eyebrow">Ton compte et ton appli</p>
      <h1 class="h1 h1--xl">Réglages</h1>
    </div>

    <nav class="card list list--grid sections" aria-label="Rubriques des réglages">
      <NuxtLink v-for="(s, i) in SECTIONS" :key="s.to" :to="s.to" class="row section" :style="{ '--i': i }">
        <span class="tile" :style="{ '--tile': s.alert ? 'var(--ko)' : s.tile }" aria-hidden="true"><component :is="s.icon" :size="22" /></span>
        <span class="row__main">
          <span class="title">{{ s.title }}</span>
          <span class="hint" :class="{ warn: s.alert }">{{ s.line }}</span>
        </span>
        <span v-if="s.alert" class="dot" aria-label="à vérifier" />
        <ChevronRight class="go" :size="20" aria-hidden="true" />
      </NuxtLink>
    </nav>

    <section class="about" aria-labelledby="about-title">
      <h2 id="about-title" class="eyebrow group">À propos</h2>
      <div class="card list">
        <button type="button" class="row" @click="showHistory">
          <span class="tile" style="--tile: var(--accent-text)" aria-hidden="true"><Sparkles :size="22" /></span>
          <span class="row__main">
            <span class="title">Quoi de neuf</span>
            <span class="hint">Version {{ appVersion }} · notes de version</span>
          </span>
          <ChevronRight class="go" :size="20" aria-hidden="true" />
        </button>
        <button v-if="demo" type="button" class="row" @click="exit">
          <span class="tile" style="--tile: var(--muted)" aria-hidden="true"><LogOut :size="22" /></span>
          <span class="row__main">
            <span class="title">Quitter la démo</span>
            <span class="hint">Les données fictives disparaissent ; tu retrouves la page d’accueil</span>
          </span>
        </button>
      </div>
      <p class="fine">Aucune donnée stockée sur nos serveurs : tes réglages restent dans ce navigateur.</p>
    </section>
  </div>
</template>

<style scoped>
.title-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.group {
  margin: 4px 0 0;
  color: var(--accent-text);
}

.hint {
  font-size: 14px;
  color: var(--muted);
}

.warn {
  color: var(--ko);
}

.sections {
  margin: 0;
}

.section {
  min-height: 76px;
}

.section .row__main {
  gap: 3px;
}

.section .hint {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.go {
  flex-shrink: 0;
  color: var(--muted);
  transition: transform 0.2s var(--ease-out);
}

a.section:hover .go {
  transform: translateX(3px);
}

.dot {
  flex-shrink: 0;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--ko);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ko) 22%, transparent);
}

.about {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

@media (min-width: 720px) {
  .about {
    max-width: 640px;
  }

  .section {
    min-height: 96px;
    padding: 18px;
  }
}

@media (min-width: 1080px) {
  .card.list--grid.sections {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
