import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/play/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Telugu WAP Music Player',
        short_name: 'TeluguPlayer',
        description: 'PWA Music Player to stream and cache songs from TeluguWAP',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        // Cache external audio streams and files if possible, and regular assets
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/mp3teluguwap\.net\/mp3\/.*\.(mp3|zip)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'wap-audio-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 30 * 24 * 60 * 60 // 30 Days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  server: {
    proxy: {
      '/api-proxy': {
        target: 'https://mp3teluguwap.net',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-proxy/, ''),
        headers: {
          'Referer': 'https://mp3teluguwap.net/'
        }
      }
    }
  }
});
