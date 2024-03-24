const path = require('path');
const fs = require('fs-extra');
const webFilePath = path.join(__dirname, './node_modules/@jiazhiwei/dev-server-web/dist/');

fs.copy(webFilePath, path.join(__dirname, './web/'), (err) => {})
