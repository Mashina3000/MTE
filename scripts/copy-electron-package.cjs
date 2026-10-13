const fs = require('node:fs');
const path = require('node:path');

const source = path.resolve(__dirname, '../electron/package.json');
const destinationDirectory = path.resolve(__dirname, '../dist-electron');

fs.mkdirSync(destinationDirectory, { recursive: true });
fs.copyFileSync(source, path.join(destinationDirectory, 'package.json'));
