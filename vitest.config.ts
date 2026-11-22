// Tests de la logique pure (shared/utils, app/utils, server/utils), sans Nuxt.
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
