import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// Admin-specific PWA configuration with red theme
const getPWAConfig = () => {
  // Detect environment: dev (admindev.ubora-app.com) or prod (admin.ubora-app.com)
  const isDev = process.env.VITE_APP_ENV === 'dev' || 
                process.env.NODE_ENV === 'development' ||
                (typeof window !== 'undefined' && window.location.hostname.includes('admindev'));
  
  return {
    name: isDev ? 'Ubora Admin Dev' : 'Ubora Admin',
    short_name: isDev ? 'Ubora Admin Dev' : 'Ubora Admin',
    description: 'Panel d\'administration Ubora pour la gestion des utilisateurs et du système',
    theme_color: '#dc2626', // Red theme for admin
    background_color: '#ffffff',
    display: 'standalone' as const,
    orientation: 'portrait-primary' as const,
    scope: '/',
    start_url: '/login',
    id: '/',
    categories: ['productivity', 'business', 'admin'],
    lang: 'fr',
    dir: 'ltr' as const,
    icons: [
      {
        src: '/fav-icons/android-icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/fav-icons/android-icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable'
      },
      {
        src: '/fav-icons/android-icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/fav-icons/android-icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      },
      {
        src: '/fav-icons/android-icon-144x144.png',
        sizes: '144x144',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/fav-icons/android-icon-96x96.png',
        sizes: '96x96',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/fav-icons/android-icon-72x72.png',
        sizes: '72x72',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/fav-icons/android-icon-48x48.png',
        sizes: '48x48',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/fav-icons/android-icon-36x36.png',
        sizes: '36x36',
        type: 'image/png',
        purpose: 'any'
      }
    ]
  };
};

export default defineConfig({
  root: __dirname,
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0')
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['fav-icons/favicon.ico', 'fav-icons/apple-icon.png'],
      manifest: getPWAConfig(),
      strategies: 'generateSW',
      injectRegister: false,
      selfDestroying: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB limit
        skipWaiting: true,
        clientsClaim: true,
        cacheId: `ubora-admin-${Date.now()}`,
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
  resolve: {
    alias: {
      '@ubora/shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@': path.resolve(__dirname, './src')
    }
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    outDir: 'dist-admin',
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vendor chunks
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/firebase')) {
            return 'vendor-firebase';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-ui';
          }
          
          // Shared package chunks
          if (id.includes('packages/shared')) {
            return 'shared';
          }
        },
      },
    },
  },
  server: {
    port: 5174,
    host: true
  },
  publicDir: path.resolve(__dirname, '../../public')
});

