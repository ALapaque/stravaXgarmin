<script setup lang="ts">
/*
 * Fonctions IA réservées à qui a ajouté sa clé OpenAI : sans clé, le contenu
 * (des lignes d'exemple, jamais de vraies propositions) est flouté sous un bouton de connexion.
 */
withDefaults(defineProps<{ text?: string }>(), {
  text: 'Ajoute ta clé OpenAI pour obtenir des propositions.',
})

const { connected, available, connect } = useChatGpt()
const locked = computed(() => !connected.value)
</script>

<template>
  <div class="ai-lock" :class="{ locked }">
    <div class="content" :aria-hidden="locked" :inert="locked || undefined">
      <slot :locked="locked" />
    </div>
    <div v-if="locked" class="overlay">
      <BrandMark brand="chatgpt" :size="40" />
      <p>{{ text }}</p>
      <button v-if="available" type="button" class="btn btn--brand btn--sm" style="--brand: var(--chatgpt)" @click="connect">
        Activer l’IA
      </button>
      <span v-else class="soon">Connexion ChatGPT bientôt disponible</span>
    </div>
  </div>
</template>

<style scoped>
.ai-lock {
  position: relative;
}

.locked .content {
  filter: blur(7px);
  opacity: 0.6;
  pointer-events: none;
  user-select: none;
}

.overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 16px;
  text-align: center;
  animation: rise 0.5s var(--ease-out) backwards;
}

.soon {
  padding: 8px 14px;
  border-radius: 99px;
  font-size: 14px;
  font-weight: 700;
  color: var(--chatgpt);
  background: color-mix(in srgb, var(--chatgpt) 16%, transparent);
}

.overlay p {
  margin: 0;
  max-width: 30ch;
  font-weight: 600;
}
</style>
