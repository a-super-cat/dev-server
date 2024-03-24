#!/usr/bin/env node

import { startMockServer } from '../dist/index.js'
import fs from 'fs-extra';

const defaultMockConf = {
  serverPort: 3000,
  wsServerPort: 3001,
  mockDir: 'mock',
  https: false,
};

const mockServerWorkDir = process.cwd();
let mockConf = {};
try {
  mockConf = {
    ...defaultMockConf,
    ...fs.readJsonSync(`${mockServerWorkDir}/mock.config.json`),
  };
} catch {
  mockConf = defaultMockConf;
}

Object.keys(mockConf).forEach(key => {
  process.env[key] = mockConf[key];
});
process.env.mockServerWorkDir = mockServerWorkDir;
startMockServer();