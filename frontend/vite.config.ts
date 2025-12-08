import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'
import legacy from '@vitejs/plugin-legacy' // <--- BU SATIRI EKLE

export default defineConfig({
  plugins: [
    vue(),
    vueJsx(),
    vueDevTools(),
    // AŞAĞIDAKİ BLOĞU EKLE:
    legacy({
      targets: ['defaults', 'not IE 11'], // Safari ve eski tarayıcılar için otomatik uyumluluk sağlar
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
      },
    }
  },
  build: {
    target: 'es2015', // Bunu tutabilirsin, zararı yok ama legacy plugin asıl işi yapacak.
    minify: 'terser', // Terser kullanarak daha güvenli sıkıştırma yapalım
  }
})