import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  resolve: {
    alias: {
      // Shared aliases
      '@calculations': path.resolve(__dirname, './src/shared/utils/calculations'),
      '@constants': path.resolve(__dirname, './src/shared/constants'),
      '@utils': path.resolve(__dirname, './src/shared/utils'),
      '@firestore': path.resolve(__dirname, './src/shared/data/firestore'),
      '@data': path.resolve(__dirname, './src/shared/data'),
      '@types': path.resolve(__dirname, './src/shared/types'),
      '@components': path.resolve(__dirname, './src/shared/components'),
      '@hooks': path.resolve(__dirname, './src/shared/hooks'),
      '@contexts': path.resolve(__dirname, './src/shared/contexts'),
      '@styles': path.resolve(__dirname, './src/shared/styles'),
      // App-specific aliases
      '@budget': path.resolve(__dirname, './src/apps/budget'),
      '@packing': path.resolve(__dirname, './src/apps/packing'),
    },
  },
  build: {
    // Build output goes to /docs for GitHub Pages
    outDir: '../docs',
    emptyOutDir: true,
  },
})
