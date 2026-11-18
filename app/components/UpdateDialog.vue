<script setup lang="ts">
import { Sparkles, Wrench, Zap, Undo2, X } from 'lucide-vue-next'

const { open, mode, releases, target, installUpdate } = useUpdates()
const installing = ref(false)
const primary = ref<HTMLButtonElement>()

const ICONS: Record<string, { icon: unknown; color: string }> = {
  Nouveautés: { icon: Sparkles, color: 'var(--accent-text)' },
  Corrections: { icon: Wrench, color: 'var(--info)' },
  Performances: { icon: Zap, color: 'var(--ok)' },
  'Retours en arrière': { icon: Undo2, color: 'var(--muted)' },
}
const iconOf = (title: string) => ICONS[title] ?? { icon: Sparkles, color: 'var(--accent-text)' }

const heading = computed(() =>
  mode.value === 'update' ? 'Mise à jour disponible' : mode.value === 'history' ? 'Notes de version' : 'Quoi de neuf ?',
)

const dateFmt = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
const formatDate = (d: string) => dateFmt.format(new Date(`${d}T12:00:00Z`))

function close() {
  open.value = false
}

async function update() {
  installing.value = true
  await installUpdate()
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && open.value) close()
}

watch(open, async (v) => {
  if (!v) return
  installing.value = false
  await nextTick()
  primary.value?.focus()
})

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="open" class="backdrop" @click.self="close">
        <section class="sheet" role="dialog" aria-modal="true" aria-labelledby="upd-title">
          <button type="button" class="x" aria-label="Fermer" @click="close"><X :size="20" /></button>

          <header class="head">
            <span class="icon-wrap" aria-hidden="true">
              <span class="halo" />
              <img src="/favicon.svg" alt="" width="64" height="64">
            </span>
            <p class="label">{{ target ? `Version ${target}` : 'Nouvelle version' }}</p>
            <h2 id="upd-title" class="h1">{{ heading }}</h2>
          </header>

          <div class="notes">
            <article v-for="(r, ri) in releases" :key="r.version" class="release" :style="{ '--r': ri }">
              <p v-if="releases.length > 1 || mode === 'history'" class="rel-head">
                <span class="title">Version {{ r.version }}</span>
                <span class="label">{{ formatDate(r.date) }}</span>
              </p>
              <section v-for="s in r.sections" :key="s.title" class="group">
                <h3 class="g-title" :style="{ color: iconOf(s.title).color }">
                  <component :is="iconOf(s.title).icon" :size="16" aria-hidden="true" />
                  {{ s.title }}
                </h3>
                <ul>
                  <li v-for="(it, i) in s.items" :key="i" :style="{ '--i': i }">{{ it }}</li>
                </ul>
              </section>
            </article>
            <p v-if="!releases.length" class="lead empty">
              {{ mode === 'update' ? 'Une nouvelle version de l’appli est prête.' : 'Pas encore de notes de version.' }}
            </p>
          </div>

          <footer class="actions">
            <button v-if="mode === 'update'" ref="primary" type="button" class="btn btn--primary" :disabled="installing" @click="update">
              {{ installing ? 'Mise à jour…' : 'Mettre à jour maintenant' }}
            </button>
            <button v-else ref="primary" type="button" class="btn btn--primary" @click="close">C’est parti</button>
            <button v-if="mode === 'update'" type="button" class="link later" @click="close">Plus tard</button>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(5, 6, 12, 0.6);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
}

.sheet {
  position: relative;
  display: flex;
  flex-direction: column;
  width: min(100%, 480px);
  max-height: 88dvh;
  padding: 28px 20px calc(env(safe-area-inset-bottom) + 20px);
  border-radius: 32px 32px 0 0;
  background: var(--bg);
  border: 1px solid var(--surface-border);
  border-bottom: 0;
  box-shadow: 0 -20px 60px rgba(0, 0, 0, 0.5);
}

.x {
  position: absolute;
  top: 14px;
  right: 14px;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 50%;
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
}

.head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-align: center;
}

.icon-wrap {
  position: relative;
  display: grid;
  place-items: center;
  width: 96px;
  height: 96px;
  margin-bottom: 6px;
}

.icon-wrap img {
  position: relative;
  border-radius: 16px;
  animation: pop 0.7s var(--ease-spring) 0.15s backwards;
}

/* Halo tournant en dégradé autour de l'icône */
.halo {
  position: absolute;
  inset: 0;
  border-radius: 28px;
  background: conic-gradient(from 0deg, #ff5a1f, #ff2e93, #2b6bff, #00e0c6, #ff5a1f);
  filter: blur(14px);
  opacity: 0.7;
  animation: spin 6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.head .h1 {
  font-size: 28px;
}

.notes {
  flex: 1;
  overflow-y: auto;
  margin: 18px -4px 0;
  padding: 0 4px;
  overscroll-behavior: contain;
}

.release + .release {
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid var(--line);
}

.rel-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin: 0 0 8px;
}

.group + .group {
  margin-top: 12px;
}

.g-title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 6px;
  font-size: 14px;
  font-weight: 700;
}

ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

li {
  position: relative;
  padding: 7px 0 7px 18px;
  color: var(--ink-2);
  font-size: 15px;
  line-height: 1.4;
  animation: rise 0.45s var(--ease-out) backwards;
  animation-delay: calc(0.25s + var(--r, 0) * 0.1s + var(--i) * 40ms);
}

li::before {
  content: '';
  position: absolute;
  left: 2px;
  top: 14px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--primary);
}

.empty {
  text-align: center;
  margin: 8px auto;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 18px;
}

.actions .btn {
  justify-content: center;
}

.later {
  align-self: center;
}

.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.3s ease;
}

.sheet-enter-active .sheet {
  transition: transform 0.5s var(--ease-spring);
}

.sheet-leave-active .sheet {
  transition: transform 0.25s ease-in;
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}

.sheet-enter-from .sheet,
.sheet-leave-to .sheet {
  transform: translateY(100%);
}

@media (prefers-reduced-motion: reduce) {
  .halo {
    animation: none;
  }
}
</style>
