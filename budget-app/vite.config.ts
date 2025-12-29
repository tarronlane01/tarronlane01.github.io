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
      '@utils': path.resolve(__dirname, './src/utils'),
      '@firestore': path.resolve(__dirname, './src/data/firestore'),
      '@queries': path.resolve(__dirname, './src/data/queries'),
      '@data': path.resolve(__dirname, './src/data'),
      '@types': path.resolve(__dirname, './src/types'),
    },
  },
  build: {
    // Build output goes to /docs for GitHub Pages
    outDir: '../docs',
    emptyOutDir: true,
  },
})
