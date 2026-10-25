import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Served from https://<user>.github.io/EUVABECO_web/ on GitHub Pages.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/EUVABECO_web/',
  plugins: [react(), tailwindcss()],
  build: { chunkSizeWarningLimit: 1500 },
})
