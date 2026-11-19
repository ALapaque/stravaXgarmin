<script setup lang="ts">
/*
 * Barre latérale des grands écrans : le menu principal, et sous la section ouverte ses
 * rubriques (les deux faces de la barre du téléphone, dépliées côte à côte).
 */
import { Bell, RefreshCw, Sparkles } from 'lucide-vue-next'

const { active, sub: subState, pick } = useNav()
// Les rubriques dépendent de la page, connue après la barre au rendu serveur :
// on les affiche une fois l'appli démarrée dans le navigateur (elles se déplient alors).
const ready = ref(false)
onMounted(() => (ready.value = true))
const sub = computed(() => (ready.value ? subState.value : null))
const { unread } = useNotifications()
const { run: sync, syncing } = useSync()
const { accounts } = useAccounts()
const { current: version } = useUpdates()
</script>

<template>
  <aside class="side" aria-label="Navigation principale">
    <NuxtLink to="/" class="brand">
      <img src="/favicon.svg" alt="" width="36" height="36">
      <span class="name">strava<span class="x">X</span>garmin</span>
    </NuxtLink>

    <nav class="menu">
      <template v-for="(t, i) in NAV" :key="t.to">
        <NuxtLink :to="t.to" class="item" :aria-current="i === active ? 'page' : undefined">
          <span class="ic"><component :is="t.icon" :size="20" aria-hidden="true" /></span>
          {{ t.label }}
        </NuxtLink>
        <!-- Rubriques de la section ouverte -->
        <div class="subs" :class="{ open: i === active && sub }">
          <div class="subs-in">
            <button
              v-for="it in i === active && sub ? sub.items : []"
              :key="it.id"
              type="button"
              class="sub"
              :aria-current="it.id === sub?.current ? 'true' : undefined"
              @click="pick(it.id)"
            >
              <component :is="SUB_ICONS[it.icon] ?? Sparkles" :size="16" aria-hidden="true" />
              {{ it.label }}
              <span v-if="it.dot" class="dot" aria-label="à faire" />
            </button>
          </div>
        </div>
      </template>
    </nav>

    <div class="foot">
      <NuxtLink to="/notifications" class="item">
        <span class="ic"><Bell :size="20" aria-hidden="true" /></span>
        Notifications
        <span v-if="unread" class="count">{{ unread }}</span>
      </NuxtLink>
      <button v-if="accounts.strava.connected" type="button" class="item" :disabled="syncing" @click="sync(true)">
        <span class="ic"><RefreshCw :size="20" :class="{ spin: syncing }" aria-hidden="true" /></span>
        {{ syncing ? 'Synchronisation…' : 'Synchroniser' }}
      </button>
      <p class="fine v">Version {{ version }}</p>
    </div>
  </aside>
</template>

<style scoped>
.side {
  position: sticky;
  top: 0;
  display: none;
  flex-direction: column;
  gap: 28px;
  height: 100dvh;
  padding: 28px 16px 20px;
  border-right: 1px solid var(--tab-border);
  background: var(--tab-bg);
  -webkit-backdrop-filter: blur(30px) saturate(180%);
  backdrop-filter: blur(30px) saturate(180%);
  overflow-y: auto;
  animation: side-in 0.6s var(--ease-out) backwards;
}

@keyframes side-in {
  from {
    opacity: 0;
    transform: translateX(-24px);
  }
}

@media (min-width: 1080px) {
  .side {
    display: flex;
  }
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 10px;
}

.brand img {
  border-radius: 10px;
}

.name {
  font-family: var(--font-display);
  font-weight: var(--display-weight);
  font-size: 19px;
  letter-spacing: -0.03em;
}

.x {
  background: var(--primary);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.menu {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 46px;
  padding: 0 10px;
  border: 0;
  border-radius: var(--r-ctrl);
  background: none;
  color: var(--muted);
  font: inherit;
  font-size: 15px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  transition: color 0.2s ease, background 0.2s ease;
}

.item:hover {
  color: var(--ink);
  background: var(--surface-2);
}

.ic {
  display: grid;
  place-items: center;
  width: 38px;
  height: 30px;
  border-radius: var(--r-pill, 15px);
  transition: background 0.3s ease, color 0.3s ease, transform 0.15s ease;
}

.item:active .ic {
  transform: scale(0.9);
}

.item[aria-current='page'] {
  color: var(--ink);
  font-weight: 700;
}

.item[aria-current='page'] .ic {
  background: var(--tab-active);
  color: var(--on-tab-active);
  box-shadow: var(--primary-shadow), inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

/* Les rubriques se déplient sous la section ouverte */
.subs {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.45s var(--ease-out);
}

.subs.open {
  grid-template-rows: 1fr;
}

.subs-in {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 0;
  margin-left: 28px;
  padding-left: 12px;
  border-left: 1px solid var(--line-strong);
  overflow: hidden;
}

.sub {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 38px;
  padding: 0 10px;
  border: 0;
  border-radius: var(--r-ctrl);
  background: none;
  color: var(--muted);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  transition: color 0.2s ease, background 0.2s ease;
}

.sub:hover {
  color: var(--ink);
}

.sub[aria-current='true'] {
  color: var(--ink);
  background: var(--surface-2);
}

.sub[aria-current='true'] svg {
  color: var(--accent-text);
}

.dot {
  width: 7px;
  height: 7px;
  margin-left: auto;
  border-radius: 50%;
  background: var(--ko);
  box-shadow: 0 0 8px var(--ko);
}

.foot {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.count {
  margin-left: auto;
  display: grid;
  place-items: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 11px;
  background: var(--ko);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
}

.v {
  padding: 8px 10px 0;
}

.spin {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
