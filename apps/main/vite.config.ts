import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

/**
 * Configuration de chunking robuste pour éviter les erreurs de dépendances React
 * 
 * Cette fonction détecte automatiquement les dépendances React pour les regrouper
 * dans le même chunk. Cela évite les erreurs comme "Cannot read properties of undefined (reading 'forwardRef')"
 * qui surviennent quand React est dans un chunk séparé de ses dépendances.
 */

// Liste des patterns connus pour les bibliothèques React
const REACT_DEPENDENCY_PATTERNS = [
  // React core
  /node_modules\/react($|\/)/,
  /node_modules\/react-dom($|\/)/,
  
  // Bibliothèques React courantes (commencent par react-)
  /node_modules\/react-/,
  
  // Bibliothèques UI qui utilisent React.forwardRef
  /node_modules\/lucide-react/,
  /node_modules\/recharts/,
  /node_modules\/recharts-to-png/,
  
  // Parties React du package shared
  /packages\/shared\/src\/contexts/,
  /packages\/shared\/src\/hooks/,
  /packages\/shared\/src\/components/,
];

// Patterns pour les autres vendors
const VENDOR_PATTERNS = {
  firebase: /node_modules\/firebase/,
  // Note: react-to-print est une dépendance React et sera capturée par isReactDependencyByName
  pdf: /node_modules\/(html2canvas|jspdf|pdfjs-dist)/,
  ai: /node_modules\/(openai|tesseract\.js)/,
};

// Patterns pour les chunks de fonctionnalités
const FEATURE_PATTERNS = {
  pdfUtils: /(utils\/PDFGenerator|utils\/RechartsToPNG|utils\/MultiFormatToPDF)/,
  chatComponents: /(components\/chat\/MessageBubble|components\/chat\/PDFPreview|components\/chat\/GraphRenderer)/,
};

/**
 * Détecte si un module est une dépendance React
 */
function isReactDependency(id: string): boolean {
  return REACT_DEPENDENCY_PATTERNS.some(pattern => pattern.test(id));
}

/**
 * Détecte automatiquement les dépendances React par leur nom de package
 * Utilise heuristiques communes pour détecter les bibliothèques React
 */
function isReactDependencyByName(id: string): boolean {
  // Si c'est un node_module
  if (!id.includes('node_modules/')) return false;
  
  // Extraire le nom du package
  const packageNameMatch = id.match(/node_modules\/([@\w\-\.]+)/);
  if (!packageNameMatch) return false;
  
  const packageName = packageNameMatch[1];
  
  // Patterns courants pour les packages React
  const reactPackagePatterns = [
    /^react(-|$)/,           // react, react-dom, react-router, etc.
    /^@react-/,              // @react-spring, @react-three, etc.
    /^@radix-ui\//,          // @radix-ui/react-*
    /^@headlessui\//,        // @headlessui/react
    /^@chakra-ui\//,         // @chakra-ui/react
    /^@mui\//,               // @mui/material, etc.
    /-react$/,                // finit par -react
    /-react-/,                // contient -react-
  ];
  
  return reactPackagePatterns.some(pattern => pattern.test(packageName));
}

/**
 * Détermine le chunk approprié pour un module donné
 */
function determineChunk(id: string): string | undefined {
  // PRIORITÉ 1: Dépendances React (doivent être ensemble)
  if (isReactDependency(id) || isReactDependencyByName(id)) {
    return 'vendor-react';
  }
  
  // PRIORITÉ 2: Autres vendors spécifiques
  if (VENDOR_PATTERNS.firebase.test(id)) {
    return 'vendor-firebase';
  }
  if (VENDOR_PATTERNS.pdf.test(id)) {
    return 'vendor-pdf';
  }
  if (VENDOR_PATTERNS.ai.test(id)) {
    return 'vendor-ai';
  }
  
  // PRIORITÉ 3: Chunks de fonctionnalités
  if (FEATURE_PATTERNS.pdfUtils.test(id)) {
    return 'pdf-utils';
  }
  if (FEATURE_PATTERNS.chatComponents.test(id)) {
    return 'chat-components';
  }
  
  // PRIORITÉ 4: Package shared (parties non-React seulement)
  // Les parties React ont déjà été capturées par isReactDependency
  if (id.includes('packages/shared')) {
    return 'shared';
  }
  
  return undefined;
}

// Main app PWA configuration with blue theme (no admin mode)
const getPWAConfig = () => {
  // Detect environment based on hostname or env vars
  const getEnvType = (): 'dev' | 'pre-release' | 'prod' => {
    // Check environment variables first
    if (process.env.VITE_APP_ENV === 'dev' || process.env.NODE_ENV === 'development') {
      return 'dev';
    }
    if (process.env.VITE_APP_ENV === 'pre-release') {
      return 'pre-release';
    }
    
    // Check hostname at build time (for static builds)
    // This will be evaluated at build time, so we need to check process.env
    // For runtime detection, the client-side code will handle it
    const hostname = process.env.VITE_HOSTNAME || '';
    if (hostname.includes('pre.') || hostname.includes('apirelease.')) {
      return 'pre-release';
    }
    if (hostname.includes('dev.') || hostname.includes('apidev.')) {
      return 'dev';
    }
    
    return 'prod';
  };
  
  const envType = getEnvType();
  
  let appName: string;
  let shortName: string;
  
  switch (envType) {
    case 'pre-release':
      appName = 'Ubora pre';
      shortName = 'Ubora pre';
      break;
    case 'dev':
      appName = 'Ubora dev';
      shortName = 'Ubora dev';
      break;
    default: // prod
      appName = 'Ubora';
      shortName = 'Ubora';
      break;
  }
  
  return {
    name: appName,
    short_name: shortName,
    description: 'Application de gestion des formulaires pour entreprises multi-agences',
    theme_color: '#3b82f6', // Blue theme for main app
    background_color: '#ffffff',
    display: 'standalone' as const,
    orientation: 'portrait-primary' as const,
    scope: '/',
    start_url: '/',
    id: '/',
    categories: ['productivity', 'business'],
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
        cacheId: `ubora-main-${Date.now()}`,
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
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Ensure proper chunk order and dependency resolution
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        manualChunks: (id) => {
          // Utilise la fonction de détection automatique pour éviter les erreurs de dépendances
          // Cette approche détecte automatiquement les dépendances React et les regroupe
          // Évite les erreurs comme "Cannot read properties of undefined (reading 'forwardRef')"
          return determineChunk(id);
        },
      },
    },
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
  },
  server: {
    port: 5173,
    host: true
  },
  publicDir: path.resolve(__dirname, '../../public')
});

