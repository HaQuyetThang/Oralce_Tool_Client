import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Dependencies (e.g. ag-grid) ship BigInt literals (0n). If esbuild targets Safari 13,
  // it will error because Safari 13 doesn't support BigInt literals.
  // Ensure BOTH dev pre-bundling (optimizeDeps) and build output target modern runtimes.
  esbuild: {
    target: 'es2021',
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2021',
    },
  },
  build: {
    target: 'es2021',
  },
})
