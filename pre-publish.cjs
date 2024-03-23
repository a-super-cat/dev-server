const fs = require('fs');
const path = require('path');

const packagePath = path.resolve(__dirname, 'package.json');
const packageJson = require(packagePath);

delete packageJson.scripts.postinstall;

fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));