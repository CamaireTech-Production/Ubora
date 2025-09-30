import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Environment-based PWA configuration
const getPWAConfig = () => {
  const isDev = process.env.NODE_ENV === 'development' || process.env.VITE_APP_ENV === 'dev';
  const isAdmin = process.env.VITE_PWA_MODE === 'admin';
  
  let appName, shortName, description, startUrl, scope;
  
  if (isAdmin) {
    appName = isDev ? 'Ubora Admin Dev' : 'Ubora Admin';
    shortName = isDev ? 'Ubora Admin Dev' : 'Ubora Admin';
    description = 'Panel d\'administration Ubora pour la gestion des utilisateurs et du système';
    startUrl = '/admin/login';
    scope = '/admin';
  } else {
    appName = isDev ? 'Ubora Dev' : 'Ubora';
    shortName = isDev ? 'Ubora Dev' : 'Ubora';
    description = 'Application de gestion des formulaires pour entreprises multi-agences';
    startUrl = '/';
    scope = '/';
  }

  return {
    name: appName,
    short_name: shortName,
    description,
    theme_color: '#3b82f6',
    background_color: '#ffffff',
    display: 'standalone' as const,
    orientation: 'portrait-primary' as const,
    scope,
    start_url: startUrl,
    id: isAdmin ? '/admin' : '/',
    categories: ['productivity', 'business'],
    lang: 'fr',
    dir: 'ltr' as const,
    icons: [
      {
        src: 'fav-icons/android-icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: 'fav-icons/android-icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable'
      },
      {
        src: 'fav-icons/android-icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: 'fav-icons/android-icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      },
      {
        src: 'fav-icons/android-icon-144x144.png',
        sizes: '144x144',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: 'fav-icons/android-icon-96x96.png',
        sizes: '96x96',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: 'fav-icons/android-icon-72x72.png',
        sizes: '72x72',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: 'fav-icons/android-icon-48x48.png',
        sizes: '48x48',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: 'fav-icons/android-icon-36x36.png',
        sizes: '36x36',
        type: 'image/png',
        purpose: 'any'
      }
    ]
  };
};

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['fav-icons/favicon.ico', 'fav-icons/apple-icon.png'],
      manifest: getPWAConfig(),
      strategies: 'generateSW',
      injectRegister: false, // We'll handle registration manually for dynamic manifests
      selfDestroying: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB limit
        skipWaiting: true,
        clientsClaim: true,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          },
          {
            urlPattern: /^https:\/\/.*\.firebaseapp\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'firebase-api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 // 1 day
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: true,
        type: 'module'
      }
    })
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1000, // Increase warning limit to 1MB
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Keep core app logic together
          if (id.includes('src/contexts/AuthContext') || 
              id.includes('src/contexts/AppContext') ||
              id.includes('src/App.tsx') ||
              id.includes('src/main.tsx')) {
            return 'app-core';
          }
          
          // Vendor chunks
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/firebase')) {
            return 'vendor-firebase';
          }
          if (id.includes('node_modules/recharts') || id.includes('node_modules/html2canvas') || id.includes('node_modules/jspdf')) {
            return 'vendor-charts';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-ui';
          }
          if (id.includes('node_modules/pdfjs-dist') || id.includes('node_modules/react-to-print')) {
            return 'vendor-pdf';
          }
          if (id.includes('node_modules/openai') || id.includes('node_modules/tesseract.js')) {
            return 'vendor-ai';
          }
          
          // Feature chunks
          if (id.includes('src/utils/PDFGenerator') || 
              id.includes('src/utils/RechartsToPNG') || 
              id.includes('src/utils/MultiFormatToPDF')) {
            return 'pdf-utils';
          }
          if (id.includes('src/components/chat/MessageBubble') || 
              id.includes('src/components/chat/PDFPreview') || 
              id.includes('src/components/chat/GraphRenderer')) {
            return 'chat-components';
          }
        },
      },
    },
  },
});