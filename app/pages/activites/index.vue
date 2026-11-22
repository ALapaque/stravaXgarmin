<script setup lang="ts">
/* Ancienne adresse (menu à cinq onglets) : redirige, côté serveur comme dans le navigateur (shared/utils/nav.ts). */
import { legacyRedirect } from '#shared/utils/nav'

definePageMeta({
  redirect: (to) => legacyRedirect(to.path, to.query) ?? '/',
})
</script>

<template>
  <div />
</template>
