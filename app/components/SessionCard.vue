<script setup lang="ts">
/*
 * Une séance prévue du plan, en carte (Aujourd'hui) ou en ligne compacte (en-tête « À venir » du Journal).
 * - carte : sur-titre (« Prochaine séance · Demain » par défaut), titre, profil, durée, distance, source ;
 * - compact : le jour en pastille, le titre, la durée, et le mini-profil à droite.
 * Toute la carte mène à « to » (par défaut, la rubrique À venir du Journal, où se trouve le déroulé).
 */
import { CalendarClock, ArrowUpRight } from 'lucide-vue-next'
import type { PlanSession } from '~/composables/usePlan'

const props = withDefaults(defineProps<{ session: PlanSession; compact?: boolean; kicker?: string; to?: string }>(), {
  compact: false,
  kicker: undefined,
  to: '/journal?onglet=a-venir',
})

const s = computed(() => props.session)
const at = computed(() => new Date(`${s.value.date}T12:00:00Z`))
const dayNum = computed(() => at.value.getUTCDate())
const weekday = computed(() => {
  if (s.value.date === TODAY) return 'auj.'
  return new Intl.DateTimeFormat('fr-BE', { weekday: 'short', timeZone: 'UTC' }).format(at.value).replace('.', '')
})
const meta = computed(() => [s.value.durationSec ? formatHours(s.value.durationSec) : '', s.value.distanceM ? `${formatKm(s.value.distanceM / 1000)} km` : ''].filter(Boolean))
</script>

<template>
  <NuxtLink v-if="compact" :to="to" class="row compact" :class="{ soon: session.date === TODAY }">
    <span class="date" aria-hidden="true">
      <span class="wd">{{ weekday }}</span>
      <span class="num dn">{{ dayNum }}</span>
    </span>
    <span class="row__main">
      <span class="title">{{ session.title }}</span>
      <span class="label">{{ planDay(session.date) }}<template v-if="meta.length"> · {{ meta.join(' · ') }}</template></span>
    </span>
    <span v-if="session.blocks.length" class="mini">
      <WorkoutProfile :blocks="session.blocks" :height="26" />
    </span>
  </NuxtLink>

  <NuxtLink v-else :to="to" class="card next">
    <div class="next-head">
      <span class="tile" style="--tile: var(--accent-text)" aria-hidden="true"><CalendarClock :size="20" /></span>
      <span class="row__main">
        <span class="eyebrow">{{ kicker ?? `Prochaine séance · ${planDay(session.date)}` }}</span>
        <span class="title next-title">{{ session.title }}</span>
      </span>
      <ArrowUpRight class="go" :size="20" aria-hidden="true" />
    </div>
    <WorkoutProfile v-if="session.blocks.length" :blocks="session.blocks" :height="44" />
    <p class="next-meta">
      <span v-for="m in meta" :key="m">{{ m }}</span>
      <span v-if="session.provider" class="provider">{{ session.provider }}</span>
    </p>
  </NuxtLink>
</template>

<style scoped>
.next {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
}

.next-head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.row__main .next-title {
  font-size: 18px;
  line-height: 1.2;
  white-space: normal;
}

.next-meta {
  display: flex;
  gap: 14px;
  margin: 0;
  font-size: 13px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.provider {
  margin-left: auto;
  font-weight: 700;
  color: var(--ink-2);
}

.go {
  color: var(--muted);
  flex-shrink: 0;
}

/* ── Compact ── */
.compact {
  gap: 14px;
  min-height: 62px;
  padding: 10px 14px;
}

.date {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: var(--r-ctrl);
  background: var(--surface-2);
  box-shadow: inset 0 0 0 1px var(--line);
}

.soon .date {
  background: color-mix(in srgb, var(--accent-text) 16%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent-text) 45%, transparent);
  color: var(--accent-text);
}

.wd {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
  line-height: 1.2;
}

.soon .wd {
  color: inherit;
}

.dn {
  font-size: 18px;
}

.mini {
  flex-shrink: 0;
  width: 64px;
  opacity: 0.9;
}
</style>
