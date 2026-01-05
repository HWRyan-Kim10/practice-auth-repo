import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Avoid writing cache into node_modules (helps if node_modules is read-only / root-owned)
  cacheDir: '.vite',
  build: {
    // Your existing dist/ is root-owned in this repo, so Vite can't clean it.
    // Use a new outDir that the current user can write to.
    outDir: 'dist-web',
    emptyOutDir: true,
  },
})
