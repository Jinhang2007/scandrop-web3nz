import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    ssr: 'worker/index.js',
    outDir: 'dist/server',
    emptyOutDir: true,
    target: 'es2022',
    rollupOptions: {
      output: {
        entryFileNames: 'index.js',
        format: 'es',
      },
    },
  },
  ssr: {
    target: 'webworker',
    noExternal: true,
  },
})
