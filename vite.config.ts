import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-180.png', 'logo.png'],
      manifest: {
        name: 'Compta Aquatic Shape', short_name: 'Compta AS', lang: 'fr', display: 'standalone',
        start_url: './', background_color: '#0b6e99', theme_color: '#0b6e99',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
});
