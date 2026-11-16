// Rasterize outlined Geist Mono artwork directly at 2x social-card resolution.
// SVG paths keep the result independent of installed fonts and avoid upscaling a PNG.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'public/img/og-home-v4.svg');
const destination = path.join(root, 'public/img/og-home-v4.png');

const result = await sharp(source, { density: 144 })
  .png({ compressionLevel: 9 })
  .toFile(destination);

if (result.width !== 2400 || result.height !== 1260) {
  throw new Error(`Unexpected social-card dimensions: ${result.width}x${result.height}`);
}
console.log(`Generated ${destination}: ${result.width}x${result.height}, ${result.size} bytes`);
