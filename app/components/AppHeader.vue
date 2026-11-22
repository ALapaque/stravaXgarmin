<script setup lang="ts">
/*
 * En-tête commun des trois onglets : sur-titre, grand titre, et à droite la cloche (notifications non lues)
 * et l'avatar du coureur, qui ouvre les réglages. Le titre peut être passé en texte (« title ») ou dans
 * l'emplacement par défaut (ex. « Salut <prénom flouté> »), le sur-titre aussi (emplacement « eyebrow »).
 */
import { Bell } from 'lucide-vue-next'

defineProps<{ eyebrow?: string; title?: string }>()
const { unread } = useNotifications()
const { initial, masked } = useRunner()
// Les non-lues dépendent de l'état gardé, chargé après l'hydratation : affichées une fois la page montée
const mounted = ref(false)
onMounted(() => (mounted.value = true))
const count = computed(() => (mounted.value ? unread.value : 0))
</script>

<template>
  <header class="app-head">
    <div class="hello">
      <p v-if="eyebrow || $slots.eyebrow" class="eyebrow"><slot name="eyebrow">{{ eyebrow }}</slot></p>
      <h1 class="h1 h1--xl"><slot>{{ title }}</slot></h1>
    </div>
    <div class="actions">
      <NuxtLink to="/notifications" class="bell card" :aria-label="count ? `Notifications, ${count} non lues` : 'Notifications'">
        <Bell :size="20" aria-hidden="true" />
        <span v-if="count" :key="count" class="badge" aria-hidden="true">{{ count }}</span>
      </NuxtLink>
      <NuxtLink to="/reglages" class="avatar" aria-label="Réglages et compte">
        <span :class="{ masked }">{{ initial }}</span>
      </NuxtLink>
    </div>
  </header>
</template>

<style scoped>
.app-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  padding-top: 4px;
}

.hello {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.bell {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  color: var(--ink);
}

.badge {
  position: absolute;
  z-index: 1;
  top: -3px;
  right: -3px;
  display: grid;
  place-items: center;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  border-radius: 10px;
  background: var(--ko);
  color: var(--on-primary);
  font-size: 12px;
  font-weight: 700;
  box-shadow: 0 0 0 3px var(--bg);
  animation: pop 0.5s var(--ease-spring) 0.6s backwards;
}

.avatar {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--primary);
  color: var(--on-primary);
  font-weight: 800;
  box-shadow: 0 0 0 2px var(--bg), 0 0 0 3.5px color-mix(in srgb, var(--primary-solid) 60%, transparent), var(--primary-shadow);
  transition: transform 0.15s ease;
}

.avatar:active {
  transform: scale(0.92);
}

.masked {
  filter: blur(6px);
  user-select: none;
}
</style>
