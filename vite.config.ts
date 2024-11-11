import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['aws-sdk'],
    include: ['react', 'react-dom']
  },
  resolve: {
    alias: {
      'core-js': 'core-js@2.6.12',
      'glob': 'glob@10.3.10'
    }
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          aws: ['aws-amplify']
        }
      }
    }
  }
})
