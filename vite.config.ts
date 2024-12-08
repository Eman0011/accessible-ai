import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['aws-sdk']
  },
  resolve: {
    alias: {
      'core-js': 'core-js@2.6.12',
      'glob': 'glob@10.3.10'
    }
  }
})
