import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'
import legacy from '@vitejs/plugin-legacy' // EKLENDİ

export default defineConfig({
  plugins: [
    vue(),
    vueJsx(),
    vueDevTools(),
    // Legacy eklentisi Safari ve eski tarayıcı sorunlarını çözer
    legacy({
      targets: ['defaults', 'not IE 11'],
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
    // Legacy plugin kullanıldığı için buradaki target ayarı artık ikincil önemde,
    // ancak güvenli olması için es2015 bırakılabilir.
    target: 'es2015',
    minify: 'terser', // Terser sıkıştırması daha güvenlidir
  }
})