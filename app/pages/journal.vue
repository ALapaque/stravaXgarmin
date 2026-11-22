<script setup lang="ts">
/* Journal : tes courses et ton plan. Rubriques : Tout, À venir, À débriefer. */
useHead({ title: 'Journal · stravaXgarmin' })

const { sorted: activities } = useActivities()
const { toDebrief } = useDebriefs()
const { accounts } = useAccounts()
const { active: demo } = useDemo()

// Le nombre de courses à débriefer dépend de l'état gardé : le point d'attention n'arrive qu'après le montage
const mounted = ref(false)
onMounted(() => (mounted.value = true))

const { tab, direction } = useTab(['tout', 'a-venir', 'a-debriefer'] as const, 'tout')
useSubnav('journal', 'Rubriques du journal', () => [
  { id: 'tout', label: 'Tout', icon: 'all' },
  { id: 'a-venir', label: 'À venir', icon: 'upcoming' },
  { id: 'a-debriefer', label: 'À débriefer', icon: 'todo', dot: mounted.value && toDebrief.value.length > 0 },
], tab)
</script>

<template>
  <div class="stack stack--wide">
    <AppHeader eyebrow="Ton plan et tes courses" title="Journal" />

    <ConnectPrompt v-if="!activities.length && !accounts.strava.connected && !demo" />

    <Transition v-else :name="`tab-${direction}`" mode="out-in">
      <div v-if="tab === 'tout'" key="tout" class="panel">
        <div v-if="activities.length" class="card list list--grid">
          <ActivityRow v-for="a in activities" :key="a.id" :activity="a" />
        </div>
        <p v-else class="card card--pad lead">Aucune course sur les 60 derniers jours.</p>
      </div>

      <div v-else-if="tab === 'a-venir'" key="a-venir" class="panel">
        <PlanUpcoming />
      </div>

      <div v-else key="a-debriefer" class="panel">
        <div v-if="toDebrief.length" class="card list list--grid">
          <ActivityRow v-for="a in toDebrief" :key="a.id" :activity="a" />
        </div>
        <p v-else class="card card--pad lead">Tout est à jour.</p>
      </div>
    </Transition>
  </div>
</template>
