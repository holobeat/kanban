import fs from 'node:fs';

fs.rmSync('dist', { recursive: true, force: true });
fs.mkdirSync('dist', { recursive: true });

fs.cpSync('index.html', 'dist/index.html');
fs.cpSync('styles.css', 'dist/styles.css');
fs.cpSync('app.js', 'dist/app.js');
fs.cpSync('manifest.webmanifest', 'dist/manifest.webmanifest');
fs.mkdirSync('dist/icons', { recursive: true });
fs.cpSync('icons/icon.svg', 'dist/icons/icon.svg');
fs.cpSync('icons/icon-maskable.svg', 'dist/icons/icon-maskable.svg');
fs.cpSync('sw.js', 'dist/sw.js');

console.log('Build complete.');
