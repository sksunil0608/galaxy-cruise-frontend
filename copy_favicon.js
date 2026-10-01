const fs = require('fs');
const path = require('path');

const src = 'C:\\\\Users\\\\pc\\\\.gemini\\\\antigravity-ide\\\\brain\\\\6110e749-a9c4-4c8e-b1c5-a6b34044e5f0\\\\.user_uploaded\\\\media_1790849834486.png';
const publicPng = path.join(__dirname, 'public', 'favicon.png');
const publicIco = path.join(__dirname, 'public', 'favicon.ico');
const appIco = path.join(__dirname, 'app', 'favicon.ico');
const appIconPng = path.join(__dirname, 'app', 'icon.png');

if (fs.existsSync(src)) {
  fs.copyFileSync(src, publicPng);
  fs.copyFileSync(src, publicIco);
  fs.copyFileSync(src, appIco);
  fs.copyFileSync(src, appIconPng);
  console.log('Successfully copied turtle icon to favicon destinations');
} else {
  console.error('Source file not found:', src);
}
