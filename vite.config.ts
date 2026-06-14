import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'public/version.json'), 'utf-8'))

// Read GH_TOKEN from environment or .env file
let ghToken = process.env.GH_TOKEN || ''
try {
  if (!ghToken) {
    const envFile = readFileSync(resolve(__dirname, '.env'), 'utf-8')
    const match = envFile.match(/GH_TOKEN=(.+)/)
    if (match) ghToken = match[1].trim()
  }
} catch {}

export default defineConfig({
  plugins: [react()],
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __GH_TOKEN__: JSON.stringify(ghToken)
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173
  }
})
