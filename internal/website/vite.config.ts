import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss()],
    define: {
      __APP_ENV__: JSON.stringify(env.APP_ENV),
    },
    build: {
      outDir: 'build',
    },
    resolve: {
      alias: {
        "@": "/src",
        src: "/src",
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      host: "0.0.0.0",
      allowedHosts: ["mars-local.qiniu.io"]
    }
  }
})
