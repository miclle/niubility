import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function manualChunks(id: string) {
  if (!id.includes('node_modules')) {
    return undefined
  }

  if (id.includes('video.js') || id.includes('mpd-parser') || id.includes('@videojs')) {
    return 'video-player'
  }

  if (
    id.includes('@tiptap') ||
    id.includes('prosemirror-') ||
    id.includes('orderedmap')
  ) {
    return 'editor'
  }

  if (
    id.includes('lucide-react') ||
    id.includes('@base-ui') ||
    id.includes('@dnd-kit')
  ) {
    return 'ui-kit'
  }

  if (
    id.includes('@tanstack/react-query') ||
    id.includes('axios') ||
    id.includes('dayjs') ||
    id.includes('i18next') ||
    id.includes('react-i18next')
  ) {
    return 'data-vendor'
  }

  return 'vendor'
}

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
      rollupOptions: {
        output: {
          manualChunks,
        },
      },
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
      allowedHosts: true
    }
  }
})
