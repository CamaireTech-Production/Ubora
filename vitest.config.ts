import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

const resolveFromRoot = (relativePath: string) =>
  path.resolve(__dirname, relativePath)

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolveFromRoot('apps/main/src'),
      '@ubora/shared': resolveFromRoot('packages/shared/src')
    }
  },
  test: {
    environment: 'jsdom',
    setupFiles: [
      resolveFromRoot('apps/main/src/test/setup.ts')
    ],
    globals: true,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/*.bugDetection.*',
      'api/node_modules/**'
    ],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        'dist/',
        'build/',
        '**/*.bugDetection.*'
      ]
    }
  }
})
