<script setup lang="ts">
/*
 * En-tête commun des trois onglets. Première ligne : le sur-titre, et à droite la cloche (notifications non
 * lues) et l'avatar du coureur, qui ouvre les réglages. Dessous, le grand titre, seul sur toute la largeur :
 * avec une police large ou un long prénom, il ne passe jamais sous les boutons. Il va à la ligne à l'espace ;
 * un mot trop long pour la ligne rétrécit (taille calculée d'après son nombre de lettres) et, en dernier
 * recours seulement, se coupe plutôt que de sortir de l'écran.
 * Le titre peut être passé en texte (« title ») ou dans l'emplacement par défaut (ex. « Salut <prénom flouté> »),
 * le sur-titre aussi (emplacement « eyebrow »).
 */
import { Bell } from 'lucide-vue-next'

const props = defineProps<{
  eyebrow?: string
  title?: string
  /** Le texte du titre quand il passe par l'emplacement par défaut (« Salut Amaury ») : sert à l'ajuster à la largeur */
  fit?: string
}>()
/** Nombre de lettres du mot le plus long du titre : un mot ne se coupe pas, il rétrécit (un trait d'union permet d'aller à la ligne) */
const longest = computed(() => Math.max(1, ...(props.fit ?? props.title ?? '').split(/[\s-]+/).map((w) => w.length)))
const { unread } = useNotifications()
const { initial, masked } = useRunner()
// Les non-lues dépendent de l'état gardé, chargé après l'hydratation : affichées une fois la page montée
const mounted = ref(false)
onMounted(() => (mounted.value = true))
const count = computed(() => (mounted.value ? unread.value : 0))
</script>

<template>
  <header class="app-head">
    <p class="eyebrow over"><slot name="eyebrow">{{ eyebrow }}</slot></p>
    <div class="actions">
      <NuxtLink to="/notifications" class="bell card" :aria-label="count ? `Notifications, ${count} non lues` : 'Notifications'">
        <Bell :size="20" aria-hidden="true" />
        <span v-if="count" :key="count" class="badge" aria-hidden="true">{{ count }}</span>
      </NuxtLink>
      <NuxtLink to="/reglages" class="avatar" aria-label="Réglages et compte">
        <span :class="{ masked }">{{ initial }}</span>
      </NuxtLink>
    </div>
    <h1 class="h1 h1--xl title" :style="{ '--longest': longest }"><slot>{{ title }}</slot></h1>
  </header>
</template>

<style scoped>
.app-head {
  container-type: inline-size;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas:
    'over actions'
    'title title';
  align-items: center;
  gap: 8px 12px;
}

/* Le sur-titre partage sa ligne avec les boutons : s'il est long, il passe sur deux lignes à côté d'eux */
.over {
  grid-area: over;
  min-width: 0;
  text-wrap: balance;
}

.actions {
  grid-area: actions;
  display: flex;
  align-items: center;
  gap: 8px;
}

/*
 * Taille du titre : celle des grands titres, sauf si son mot le plus long ne tiendrait pas sur la ligne.
 * 0,74 em par lettre est la largeur de la police de titre la plus large (Unbounded) : avec les autres,
 * le mot tient à plus forte raison.
 */
.title {
  grid-area: title;
  min-width: 0;
  font-size: min(var(--xl), calc(100cqi / (var(--longest, 1) * 0.74)));
  overflow-wrap: anywhere;
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
