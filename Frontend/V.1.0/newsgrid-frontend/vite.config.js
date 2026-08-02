import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true
  },
  build: {
    target: 'esnext',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // OPTIMIZED: Remove console.log in production build for high performance
        drop_debugger: true
      }
    },
    rollupOptions: {
      output: {
        // OPTIMIZED: Code Splitting - Split heavy vendor libraries into smaller cached JS chunks
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-router': ['react-router-dom'],
          'vendor-query': ['@tanstack/react-query', 'axios']
        }
      }
    }
  }
})