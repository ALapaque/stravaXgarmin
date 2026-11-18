<script setup lang="ts">
import { RotateCcw } from 'lucide-vue-next'

useHead({ title: 'Historique · stravaXgarmin' })

const { entries, undo } = useHistory()
const { byId } = useActivities()
const { show } = useToast()

const when = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Brussels' })

function cancel(id: string) {
  if (undo(id)) show('Modification annulée sur Strava')
}
</script>

<template>
  <div class="stack">
    <BackLink to="/reglages" label="Réglages" />
    <div class="title-block">
      <h1 class="h1">Historique</h1>
      <p class="lead">Tout ce que l’appli a changé sur Strava. Chaque modification peut être annulée.</p>
    </div>

    <ul v-if="entries.length" class="card list entries">
      <li v-for="e in entries" :key="e.id" class="entry" :class="{ undone: e.undone }">
        <div class="meta">
          <span class="label">{{ SOURCE_LABELS[e.source] }} · {{ when.format(new Date(e.at)) }}</span>
          <NuxtLink v-if="byId(e.activityId)" :to="`/activites/${e.activityId}`" class="act-link">
            {{ byId(e.activityId)!.garminName }}
          </NuxtLink>
        </div>
        <p v-if="e.field === 'name'" class="change">
          <s>{{ e.before || 'Sans nom' }}</s>
          <span aria-hidden="true">→</span>
          <span class="after">{{ e.after }}</span>
        </p>
        <p v-else class="change">
          <span class="after">{{ e.before ? 'Description modifiée' : 'Description ajoutée' }}</span>
        </p>
        <div class="foot">
          <span v-if="e.undone" class="chip chip--ko">Annulée</span>
          <button v-else type="button" class="btn btn--secondary btn--sm" @click="cancel(e.id)">
            <RotateCcw :size="16" aria-hidden="true" /> Annuler
          </button>
        </div>
      </li>
    </ul>
    <p v-else class="card card--pad lead">Aucune modification pour l’instant.</p>
  </div>
</template>

<style scoped>
.title-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.entries {
  margin: 0;
  padding: 0;
  list-style: none;
}

.entry {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  transition: opacity 0.3s ease;
}

.entry.undone {
  opacity: 0.55;
}

.meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.act-link {
  font-size: 15px;
  color: var(--muted);
}

.change {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px 8px;
  margin: 0;
}

.change s {
  color: var(--muted);
}

.after {
  font-weight: var(--title-weight);
}

.foot {
  display: flex;
}

.foot .btn svg {
  color: var(--accent-text);
}
</style>
