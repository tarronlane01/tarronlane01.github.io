import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  resolve: {
    alias: {
      '@calculations': path.resolve(__dirname, './src/utils/calculations'),
      '@constants': path.resolve(__dirname, './src/constants'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@firestore': path.resolve(__dirname, './src/data/firestore'),
      '@queries': path.resolve(__dirname, './src/data/queries'),
      '@data': path.resolve(__dirname, './src/data'),
      '@types': path.resolve(__dirname, './src/types'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@contexts': path.resolve(__dirname, './src/contexts'),
      '@styles': path.resolve(__dirname, './src/styles'),
    },
  },
  build: {
    // Build output goes to /docs for GitHub Pages
    outDir: '../docs',
    emptyOutDir: true,
  },
})
