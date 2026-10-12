import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The API only allows the origins localhost:5173 and localhost:3000 (see WebConfig.java),
  // so fail instead of silently moving to another port.
  server: { port: 5173, strictPort: true },
})
