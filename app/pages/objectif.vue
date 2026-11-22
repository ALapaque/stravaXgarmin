<script setup lang="ts">
import { ArrowRight, Trash2 } from 'lucide-vue-next'
import type { Goal } from '~/composables/useFitness'

useHead({ title: 'Objectif · stravaXgarmin' })

const { goal, goalInfo, forme } = useFitness()
const { upcoming } = usePlan()
const { show } = useToast()
const router = useRouter()

const draft = reactive<Goal>({ name: goal.value?.name ?? '', date: goal.value?.date ?? '', distance: goal.value?.distance ?? 'half' })
const predicted = computed(() => forme.value?.data.predictions?.[draft.distance] ?? null)
const KM: Record<Goal['distance'], number> = { '5k': 5, '10k': 10, half: 21.0975, marathon: 42.195 }
const sessionsBefore = computed(() => (draft.date ? upcoming.value.filter((s) => s.date <= draft.date).length : 0))

async function save() {
  if (!draft.date) return
  goal.value = { name: draft.name.trim().slice(0, 60), date: draft.date, distance: draft.distance }
  show('Objectif enregistré')
  await router.push('/')
}

async function remove() {
  goal.value = null
  show('Objectif retiré')
  await router.push('/progression')
}
</script>

<template>
  <div class="stack">
    <BackLink to="/progression" label="Progression" />
    <div class="title-block">
      <p class="eyebrow">Ta prochaine course</p>
      <h1 class="h1 h1--xl">Objectif</h1>
    </div>

    <GoalCard v-if="goalInfo" compact />

    <form class="card card--pad form" @submit.prevent="save">
      <label class="field">
        <span class="label">Nom de la course</span>
        <input v-model="draft.name" type="text" maxlength="60" placeholder="Semi de Bruxelles" autocomplete="off">
      </label>

      <fieldset class="field">
        <legend class="label">Distance</legend>
        <div class="segmented">
          <button v-for="d in GOAL_DISTANCES" :key="d.id" type="button" :aria-pressed="draft.distance === d.id" @click="draft.distance = d.id">
            {{ d.label }}
          </button>
        </div>
      </fieldset>

      <label class="field">
        <span class="label">Date</span>
        <input v-model="draft.date" type="date" :min="TODAY" required>
      </label>

      <div v-if="predicted" class="pred">
        <p class="eyebrow">Temps prédit par ta montre aujourd’hui</p>
        <p class="num big">{{ formatDuration(Math.round(predicted)) }}</p>
        <p class="hint">soit {{ formatPace(predicted, KM[draft.distance]) }} /km<template v-if="sessionsBefore"> · {{ sessionsBefore }} séance{{ sessionsBefore > 1 ? 's' : '' }} prévue{{ sessionsBefore > 1 ? 's' : '' }} d’ici là</template></p>
      </div>

      <button type="submit" class="btn btn--primary" :disabled="!draft.date">
        {{ goal ? 'Mettre à jour' : 'Enregistrer l’objectif' }}
        <ArrowRight :size="20" aria-hidden="true" />
      </button>
    </form>

    <button v-if="goal" type="button" class="btn btn--secondary" @click="remove">
      <Trash2 :size="18" aria-hidden="true" /> Retirer l’objectif
    </button>
    <p class="fine">Le temps prédit vient de Garmin et bouge avec ton entraînement. Sans Garmin connecté, le compte à rebours s’affiche seul.</p>
  </div>
</template>

<style scoped>
.title-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;
}

.field input {
  min-height: 52px;
  padding: 0 14px;
  border-radius: var(--r-ctrl);
  border: 1px solid var(--line-strong);
  background: var(--surface-2);
  color: var(--ink);
  font: inherit;
  font-size: 16px;
  outline: none;
  transition: border-color 0.2s ease;
}

.field input:focus {
  border-color: var(--focus);
}

.pred {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px;
  border-radius: var(--r-ctrl);
  background: color-mix(in srgb, var(--primary-solid) 10%, transparent);
}

.big {
  margin: 4px 0 0;
  font-size: 44px;
}

.hint {
  margin: 0;
  font-size: 14px;
  color: var(--muted);
}
</style>
