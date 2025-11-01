# PWA Multi-App Implementation Guide

## Overview

This implementation provides **three distinct PWA experiences** from a single codebase:

1. **Ubora Dev** - Development environment for regular users
2. **Ubora** - Production environment for regular users  
3. **Ubora Admin** - Admin panel (works on both dev and prod)

## How It Works

### 1. Environment Detection

The system automatically detects the environment based on:
- **Subdomain**: `dev.ubora-app.com` vs `my.ubora-app.com`
- **Environment Variables**: `VITE_APP_ENV=dev` vs `VITE_APP_ENV=prod`

### 2. Route-Based PWA Mode

The system detects admin routes (`/admin/*`) and automatically switches to admin PWA mode:
- **Regular Routes** (`/login`, `/dashboard`, etc.) → User PWA
- **Admin Routes** (`/admin/login`, `/admin/dashboard`, etc.) → Admin PWA

### 3. Dynamic PWA Configuration

Based on environment + route detection, the system generates:

| Environment | Route Type | App Name | Short Name | Start URL | Scope |
|-------------|------------|----------|------------|-----------|-------|
| Dev | Regular | Ubora Dev | Ubora Dev | `/` | `/` |
| Dev | Admin | Ubora Admin Dev | Ubora Admin Dev | `/admin/login` | `/admin` |
| Prod | Regular | Ubora | Ubora | `/` | `/` |
| Prod | Admin | Ubora Admin | Ubora Admin | `/admin/login` | `/admin` |

## Implementation Details

### Core Files

1. **`src/utils/pwaConfig.ts`** - PWA configuration logic
2. **`src/hooks/usePWARouteDetection.ts`** - Route detection hook
3. **`src/components/PWAManager.tsx`** - PWA management component
4. **`src/components/PWAInstallPrompt.tsx`** - Dynamic install prompt
5. **`vite.config.ts`** - Build-time PWA configuration
6. **`scripts/update-html-meta.js`** - HTML meta tag updates

### Build Process

1. **Pre-build**: `scripts/update-html-meta.js` updates HTML meta tags
2. **Build**: Vite generates PWA manifest based on environment
3. **Runtime**: React components detect routes and update PWA behavior

### CI/CD Integration

Both deployment workflows now include:
```bash
# PWA Configuration for Development/Production
VITE_APP_ENV=dev/prod
NODE_ENV=production
```

## User Experience

### Regular Users

**Development Environment:**
- Visit `dev.ubora-app.com`
- PWA installs as "Ubora Dev"
- Opens to regular user dashboard

**Production Environment:**
- Visit `my.ubora-app.com`
- PWA installs as "Ubora"
- Opens to regular user dashboard

### Admin Users

**Development Environment:**
- Visit `dev.ubora-app.com/admin/login`
- PWA installs as "Ubora Admin Dev"
- Opens directly to admin login/dashboard

**Production Environment:**
- Visit `my.ubora-app.com/admin/login`
- PWA installs as "Ubora Admin"
- Opens directly to admin login/dashboard

### Users with Both Roles

Can install both versions:
- "Ubora" or "Ubora Dev" for regular work
- "Ubora Admin" or "Ubora Admin Dev" for admin tasks
- Two separate app icons and entries on their device

## Installation Behavior

### Install Prompts

- **Regular Routes**: Blue-themed install prompt for user app
- **Admin Routes**: Red-themed install prompt for admin app
- **Separate Storage**: Each app type has its own dismiss storage

### App Separation

- **Different Manifests**: Each app type uses different manifest files
- **Different Scopes**: Admin app scoped to `/admin`, user app scoped to `/`
- **Different Start URLs**: Admin app starts at `/admin/login`, user app at `/`

## Technical Benefits

1. **Same Deployment**: No changes to CI/CD pipelines
2. **Same Subdomains**: Uses existing infrastructure
3. **Smart Detection**: Automatically adapts based on context
4. **Separate Apps**: Users get distinct app entries
5. **Shared Codebase**: No code duplication
6. **Independent Updates**: Each PWA can be updated independently

## Testing

Run the test script to verify configuration:
```bash
npm run test:pwa-config
# or
node scripts/test-pwa-config.js
```

## Deployment

The implementation works with your existing deployment:

1. **Dev Branch** → `dev.ubora-app.com` → "Ubora Dev" / "Ubora Admin Dev"
2. **Master Branch** → `my.ubora-app.com` → "Ubora" / "Ubora Admin"

No additional configuration needed - the system automatically detects the environment and route context.

## Future Enhancements

- **Custom Icons**: Add "DEV" or "ADMIN" badges to icons
- **Additional PWAs**: Easy to add more specialized apps (e.g., manager-specific)
- **Advanced Scoping**: More granular route-based PWA behavior
- **Analytics**: Track PWA installation rates by type

## Troubleshooting

### Common Issues

1. **PWA not updating**: Clear browser cache and reinstall
2. **Wrong app name**: Check environment variables in CI/CD
3. **Admin prompt not showing**: Ensure you're on `/admin/*` routes
4. **Installation issues**: Check manifest.json generation
5. **Router context error**: Ensure PWAManager is inside Router component (✅ Fixed)

### Debug Mode

Add to browser console to debug:
```javascript
// Check current PWA config
console.log(window.pwaConfig);

// Check if admin mode
console.log(window.location.pathname.startsWith('/admin'));
```

## Support

This implementation provides a robust, scalable solution for multiple PWA experiences from a single codebase while maintaining the simplicity of your existing deployment process.
