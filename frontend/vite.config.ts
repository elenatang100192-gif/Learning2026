import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  cacheDir: process.env.VITE_CACHE_DIR || '/tmp/vite-cache-frontend', // 使用临时目录避免权限问题
  plugins: [
    react(),
    tailwindcss(),
  ],
  optimizeDeps: {
    force: true, // 强制重新构建依赖，解决 "Outdated Optimize Dep" 错误
  },
  server: {
    host: '0.0.0.0', // 允许外部访问
    port: 5173, // 前端应用使用5173端口
    fs: {
      strict: true,
    },
    hmr: process.env.NODE_ENV === 'production' ? false : {
      host: 'localhost',
    },
    cors: true,
    open: false, // 不自动打开浏览器
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: false,
  },
  // 移动端构建时使用根路径，Web部署时使用 /Video-frontend/
  // 注意：CAPACITOR 环境变量需要在构建时设置
  // 如果设置了 CAPACITOR 环境变量，使用根路径；否则使用 /Video-frontend/
  base: (process.env.CAPACITOR === 'true' || process.env.CAPACITOR === '1' || process.env.CAPACITOR === 'TRUE' || process.env.VITE_CAPACITOR === 'true' || process.env.npm_config_capacitor === 'true') ? '/' : '/Video-frontend/',
})

