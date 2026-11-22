<script setup lang="ts">
/*
 * Débrief d'une course, en résumé : issue, ressenti « 7 · Difficile », la note, « Publié sur Strava »
 * ou « Gardé pour toi », et « Modifier ». Course à débriefer : un bloc mis en avant qui mène au Débrief.
 * Rien pour une course sans débrief qui n'en réclame pas.
 */
import { ArrowRight, CircleCheckBig, CircleDotDashed, CircleX, Lock, PenLine } from 'lucide-vue-next'
import type { Activity } from '~/composables/useActivities'

const props = defineProps<{ activity: Activity }>()
const { get, toDebrief } = useDebriefs()
const { isPublished } = useActivities()

const d = computed(() => get(props.activity.id))
const todo = computed(() => toDebrief.value.some((x) => x.id === props.activity.id))
const to = computed(() => `/activites/${props.activity.id}/debrief`)
const published = computed(() => Boolean(d.value?.publishedAt) || isPublished(props.activity.id, 'debrief'))
const ICONS = { done: CircleCheckBig, short: CircleDotDashed, failed: CircleX }
const TONES = { done: 'var(--ok)', short: 'var(--accent-text)', failed: 'var(--ko)' }
</script>

<template>
  <section v-if="d?.status === 'done'" class="card card--pad dsum" aria-labelledby="dsum-title">
    <div class="head">
      <h2 id="dsum-title" class="eyebrow">Débrief</h2>
      <span class="where" :class="{ pub: published }">
        <BrandMark v-if="published" brand="strava" :size="20" />
        <Lock v-else :size="14" aria-hidden="true" />
        {{ published ? 'Publié sur Strava' : 'Gardé pour toi' }}
      </span>
    </div>
    <div class="facts">
      <span v-if="d.outcome" class="fact" :style="{ '--tone': TONES[d.outcome] }">
        <component :is="ICONS[d.outcome]" :size="18" aria-hidden="true" />
        <span>{{ OUTCOME_LABELS[d.outcome] }}</span>
      </span>
      <span v-if="d.rpe" class="fact rpe" :style="{ '--tone': rpeTint(d.rpe) }">
        <span class="num">{{ d.rpe }}</span>
        <span>· {{ RPE_LABELS[d.rpe] }}</span>
      </span>
    </div>
    <p v-if="d.note" class="note">{{ d.note }}</p>
    <NuxtLink :to="to" class="link edit"><PenLine :size="16" aria-hidden="true" /> Modifier</NuxtLink>
  </section>

  <NuxtLink v-else-if="todo" :to="to" class="block block--primary dtodo">
    <span class="row__main">
      <span class="title">{{ d?.status === 'draft' ? 'Débrief commencé' : 'À débriefer' }}</span>
      <span class="sub">Vingt secondes pour boucler ta séance.</span>
    </span>
    <span class="go">{{ d?.status === 'draft' ? 'Reprendre' : 'Débriefer' }} <ArrowRight :size="18" aria-hidden="true" /></span>
  </NuxtLink>
</template>

<style scoped>
.dsum {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.where {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--muted);
}

.where.pub {
  color: var(--ink-2);
}

.facts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
}

.fact {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-display);
  font-weight: var(--title-weight);
  font-size: 18px;
  color: var(--tone);
}

.fact.rpe .num {
  font-size: 26px;
}

.fact.rpe span + span {
  color: var(--ink);
}

.note {
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  color: var(--ink-2);
  white-space: pre-line;
}

.edit {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  min-height: 44px;
  padding: 0;
}

.dtodo {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 18px 18px 20px;
}

.dtodo > * {
  position: relative;
  z-index: 1;
}

.dtodo .title {
  white-space: normal;
  font-family: var(--font-display);
  font-size: 19px;
}

.dtodo .sub {
  font-size: 14px;
  opacity: 0.88;
}

.go {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  min-height: 44px;
  padding: 0 14px;
  border-radius: var(--r-btn);
  font-weight: 700;
  background: color-mix(in srgb, var(--on-primary) 16%, transparent);
}
</style>
