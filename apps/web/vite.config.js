import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    // File watching inside Docker bind mounts is unreliable on macOS/Windows
    watch: { usePolling: process.env.DOCKER === 'true' },
  },
})
