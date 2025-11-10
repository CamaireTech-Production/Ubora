/**
 * Utility functions for managing PWA entry points
 */

/**
 * Generate a URL with entry point parameter
 */
export const generateEntryPointUrl = (entryPoint: 'regular' | 'admin', path: string = ''): string => {
  const baseUrl = entryPoint === 'admin' ? '/admin' : '';
  const fullPath = path ? `${baseUrl}${path}` : baseUrl || '/';
  const url = new URL(fullPath, window.location.origin);
  url.searchParams.set('entry', entryPoint);
  return url.toString();
};

/**
 * Generate a shareable link for the app with entry point
 */
export const generateShareableLink = (entryPoint: 'regular' | 'admin'): string => {
  const baseUrl = window.location.origin;
  const path = entryPoint === 'admin' ? '/admin/login' : '/';
  return `${baseUrl}${path}?entry=${entryPoint}`;
};

/**
 * Get the current entry point from URL
 */
export const getCurrentEntryPoint = (): 'regular' | 'admin' | 'auto' => {
  const urlParams = new URLSearchParams(window.location.search);
  const entryPoint = urlParams.get('entry');
  
  if (entryPoint === 'admin') return 'admin';
  if (entryPoint === 'regular') return 'regular';
  
  // Check if we're on admin route
  if (window.location.pathname.startsWith('/admin')) return 'admin';
  
  return 'auto';
};

/**
 * Switch between entry points
 */
export const switchEntryPoint = (newEntryPoint: 'regular' | 'admin'): void => {
  const currentPath = window.location.pathname;
  
  if (newEntryPoint === 'admin') {
    // Switch to admin
    const adminPath = currentPath.startsWith('/admin') ? currentPath : '/admin/login';
    window.location.href = generateEntryPointUrl('admin', adminPath.replace('/admin', ''));
  } else {
    // Switch to regular
    const regularPath = currentPath.startsWith('/admin') ? '/' : currentPath;
    window.location.href = generateEntryPointUrl('regular', regularPath);
  }
};

/**
 * Check if user can switch entry points
 */
export const canSwitchEntryPoint = (): boolean => {
  // For now, always allow switching
  // You can add logic here to check user permissions, etc.
  return true;
};
