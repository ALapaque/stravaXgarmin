<script setup lang="ts">
import { Trophy, Sparkles, Clock, CalendarRange } from 'lucide-vue-next'

useHead({ title: 'Notifications · stravaXgarmin' })

const { list, unread, markAllRead } = useNotifications()

const ICONS = {
  titles: { icon: Sparkles, color: 'var(--accent-text)' },
  records: { icon: Trophy, color: 'var(--ok)' },
  review: { icon: Clock, color: 'var(--ko)' },
  recap: { icon: CalendarRange, color: 'var(--info)' },
}

const when = new Intl.DateTimeFormat('fr-BE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Brussels' })

// Marquées comme lues en quittant l'écran, pour que les nouvelles restent visibles pendant la lecture
onBeforeUnmount(markAllRead)
</script>

<template>
  <div class="stack">
    <BackLink to="/" label="Aujourd’hui" />
    <div class="head">
      <h1 class="h1">Notifications</h1>
      <button v-if="unread" type="button" class="link" @click="markAllRead">Tout marquer comme lu</button>
    </div>

    <ul v-if="list.length" class="card list items">
      <li v-for="n in list" :key="n.id">
        <component :is="n.to ? 'NuxtLink' : 'div'" :to="n.to" class="row item" :class="{ unread: !n.read }">
          <span class="tile" :style="{ '--tile': ICONS[n.kind].color }" aria-hidden="true">
            <component :is="ICONS[n.kind].icon" :size="22" />
          </span>
          <span class="row__main">
            <span class="title">{{ n.title }}</span>
            <span class="body">{{ n.body }}</span>
            <span class="label">{{ when.format(new Date(n.at)) }}</span>
          </span>
          <span v-if="!n.read" class="dot" aria-label="Non lue" />
        </component>
      </li>
    </ul>
    <p v-else class="card card--pad lead">Rien de neuf pour l’instant.</p>
  </div>
</template>

<style scoped>
/* Le lien passe sous le titre quand ils ne tiennent pas côte à côte (petit écran, police large) */
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 4px 12px;
}

.items {
  margin: 0;
  padding: 0;
  list-style: none;
}

.item {
  align-items: flex-start;
}

.item .title {
  white-space: normal;
}

.body {
  color: var(--ink-2);
  font-size: 15px;
}

.dot {
  flex-shrink: 0;
  width: 10px;
  height: 10px;
  margin-top: 6px;
  border-radius: 50%;
  background: var(--primary);
  animation: pop 0.5s var(--ease-spring) 0.4s backwards;
}
</style>
