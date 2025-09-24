#!/usr/bin/env node

/**
 * Script to update HTML meta tags based on environment
 * This runs during the build process to set the correct PWA metadata
 */

const fs = require('fs');
const path = require('path');

// Get environment variables
const isDev = process.env.VITE_APP_ENV === 'dev' || process.env.NODE_ENV === 'development';
const isAdmin = process.env.VITE_PWA_MODE === 'admin';

// Determine app names based on environment
let appName, shortName, description;

if (isAdmin) {
  appName = isDev ? 'Ubora Admin Dev' : 'Ubora Admin';
  shortName = isDev ? 'Ubora Admin Dev' : 'Ubora Admin';
  description = 'Panel d\'administration Ubora pour la gestion des utilisateurs et du système';
} else {
  appName = isDev ? 'Ubora Dev' : 'Ubora';
  shortName = isDev ? 'Ubora Dev' : 'Ubora';
  description = 'Application de gestion des formulaires pour entreprises multi-agences';
}

// Read the HTML file
const htmlPath = path.join(__dirname, '..', 'index.html');
let htmlContent = fs.readFileSync(htmlPath, 'utf8');

// Update meta tags
htmlContent = htmlContent.replace(
  /<meta name="application-name" content="[^"]*" \/>/,
  `<meta name="application-name" content="${shortName}" />`
);

htmlContent = htmlContent.replace(
  /<meta name="apple-mobile-web-app-title" content="[^"]*" \/>/,
  `<meta name="apple-mobile-web-app-title" content="${shortName}" />`
);

htmlContent = htmlContent.replace(
  /<meta name="description" content="[^"]*" \/>/,
  `<meta name="description" content="${description}" />`
);

htmlContent = htmlContent.replace(
  /<title>[^<]*<\/title>/,
  `<title>${appName} - Gestion des Formulaires avec ARCHA</title>`
);

// Write the updated HTML back
fs.writeFileSync(htmlPath, htmlContent);

console.log(`✅ Updated HTML meta tags for ${isAdmin ? 'admin' : 'user'} app in ${isDev ? 'development' : 'production'} environment`);
console.log(`📱 App Name: ${appName}`);
console.log(`🏷️  Short Name: ${shortName}`);
