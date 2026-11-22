<script setup lang="ts">
/* Ancienne adresse (des notifications y mènent encore) : tout se fait maintenant dans le Débrief. */
definePageMeta({ redirect: (to) => `/activites/${String(to.params.id)}/debrief` })
</script>

<template>
  <div class="stack" />
</template>
