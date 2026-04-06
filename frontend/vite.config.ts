import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Dependencies (e.g. ag-grid) ship BigInt literals; default safari13 target cannot emit them.
  build: {
    target: 'es2021',
  },
})
