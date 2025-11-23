import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Important for assets to load correctly in Cordova/Capacitor
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});