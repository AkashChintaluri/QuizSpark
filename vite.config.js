import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
        },
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          return `assets/[name]-[hash].${ext}`;
        },
      },
    },
    css: {
      modules: {
        localsConvention: 'camelCase',
      },
    },
    chunkSizeWarningLimit: 1000,
    emptyOutDir: true,
  },
  define: {
    'process.env': {
      VITE_SUPABASE_URL: JSON.stringify(process.env.VITE_SUPABASE_URL),
      VITE_SUPABASE_KEY: JSON.stringify(process.env.VITE_SUPABASE_KEY),
      SUPABASE_SERVICE_KEY: JSON.stringify(process.env.SUPABASE_SERVICE_KEY),
    },
  },
  server: {
    hmr: true,
  },
});