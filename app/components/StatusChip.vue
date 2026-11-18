<script setup lang="ts">
defineProps<{ ok: boolean; label?: string }>()
</script>

<template>
  <span class="chip" :class="ok ? 'chip--ok' : 'chip--ko'">{{ label ?? (ok ? 'Synchro' : 'Différent') }}</span>
</template>
