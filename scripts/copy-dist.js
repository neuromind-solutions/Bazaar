import fs from 'fs';
import path from 'path';

const src = path.resolve('apps/desktop/dist');
const dest = path.resolve('dist');

if (fs.existsSync(src)) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true });
  console.log(`[build] Successfully synced output: ${src} -> ${dest}`);
} else {
  console.error(`[build] Error: Source dist directory not found at ${src}`);
  process.exit(1);
}
