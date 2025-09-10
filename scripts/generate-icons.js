import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create icons directory if it doesn't exist
const iconsDir = path.join(__dirname, '../public/icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Create a simple SVG icon
const createIcon = (size) => {
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="#3b82f6"/>
    <rect x="${size * 0.2}" y="${size * 0.2}" width="${size * 0.6}" height="${size * 0.6}" rx="${size * 0.1}" fill="white"/>
    <rect x="${size * 0.3}" y="${size * 0.3}" width="${size * 0.4}" height="${size * 0.1}" rx="${size * 0.05}" fill="#3b82f6"/>
    <rect x="${size * 0.3}" y="${size * 0.45}" width="${size * 0.3}" height="${size * 0.1}" rx="${size * 0.05}" fill="#3b82f6"/>
    <rect x="${size * 0.3}" y="${size * 0.6}" width="${size * 0.35}" height="${size * 0.1}" rx="${size * 0.05}" fill="#3b82f6"/>
  </svg>`;
};

// Generate icons for different sizes
const sizes = [16, 32, 72, 96, 128, 144, 152, 180, 192, 384, 512];

sizes.forEach(size => {
  const svg = createIcon(size);
  const filename = `icon-${size}x${size}.png`;
  const filepath = path.join(iconsDir, filename);
  
  // For now, we'll create SVG files and let the user convert them to PNG
  const svgFilename = `icon-${size}x${size}.svg`;
  const svgFilepath = path.join(iconsDir, svgFilename);
  
  fs.writeFileSync(svgFilepath, svg);
  console.log(`Created ${svgFilename}`);
});

// Create favicon
const faviconSvg = createIcon(32);
fs.writeFileSync(path.join(iconsDir, 'favicon.svg'), faviconSvg);

// Create apple-touch-icon
const appleTouchIcon = createIcon(180);
fs.writeFileSync(path.join(iconsDir, 'apple-touch-icon.svg'), appleTouchIcon);

// Create PWA icons
fs.writeFileSync(path.join(iconsDir, 'pwa-192x192.svg'), createIcon(192));
fs.writeFileSync(path.join(iconsDir, 'pwa-512x512.svg'), createIcon(512));

console.log('Icons generated successfully!');
console.log('Note: You may want to convert the SVG files to PNG for better compatibility.');
