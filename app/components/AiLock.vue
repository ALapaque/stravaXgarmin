<script setup lang="ts">
/*
 * Fonctions IA réservées à qui a activé l'IA (clé Gemini, Mistral ou OpenAI) : sans clé, le contenu
 * (des lignes d'exemple, jamais de vraies propositions) est flouté sous un bouton de connexion.
 */
import { Sparkles } from 'lucide-vue-next'

withDefaults(defineProps<{ text?: string }>(), {
  text: 'Active l’IA pour obtenir des propositions. C’est gratuit avec Gemini.',
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
      <span class="spark" aria-hidden="true"><Sparkles :size="22" /></span>
      <p>{{ text }}</p>
      <button v-if="available" type="button" class="btn btn--primary btn--sm" @click="connect">
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

.spark {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 14px;
  color: #fff;
  background: linear-gradient(135deg, var(--primary-solid), var(--accent-text));
  animation: pop 0.6s var(--ease-spring) 0.1s backwards;
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
