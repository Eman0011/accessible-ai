import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    visualizer({ open: true }) // Automatically opens the report in the browser
  ],
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn'],
      },
      output: {
        comments: false,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'aws-vendor': ['aws-amplify', '@aws-amplify/ui-react'],
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'chart-vendor': ['chart.js', 'react-chartjs-2'],
          'ui-vendor': ['@cloudscape-design/components'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  optimizeDeps: {
    exclude: ['aws-sdk'],
    include: ['react', 'react-dom', 'react-router-dom'],
  },
  resolve: {
    alias: {
      'core-js': 'core-js@2.6.12',
      'glob': 'glob@10.3.10'
    }
  }
})
