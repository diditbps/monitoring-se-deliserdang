import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      '/api.php': {
        target: 'http://localhost/se-monitoring-deliserdang/public',
        changeOrigin: true,
      }
    }
  }
})
