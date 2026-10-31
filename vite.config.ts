import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves this repo at /steal-a-poop/
export default defineConfig({
  base: '/steal-a-poop/',
  plugins: [react()],
})
