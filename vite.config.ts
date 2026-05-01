import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves the site at /CharJ-admin/, so production assets
// must be requested from that subpath. Local dev keeps "/".
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/CharJ-admin/' : '/',
}))
