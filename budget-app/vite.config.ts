import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  resolve: {
    alias: {
      '@constants': path.resolve(__dirname, './src/constants'),
    },
  },
  build: {
    // Build output goes to /docs for GitHub Pages
    outDir: '../docs',
    emptyOutDir: true,
  },
})
