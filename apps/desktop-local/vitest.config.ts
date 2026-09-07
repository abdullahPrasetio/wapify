import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      // Test jalan di Node biasa (bukan Electron) — stub safeStorage dkk.
      // Juga membuat CI aman walau binary Electron tidak terunduh
      // (npm ci --ignore-scripts).
      electron: resolve(__dirname, 'src/main/local/__tests__/electron-stub.ts')
    }
  },
  test: {
    environment: 'node',
    include: ['src/main/**/*.test.ts']
  }
})
