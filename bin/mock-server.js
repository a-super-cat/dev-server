#!/usr/bin/env node

import { startMockServer } from '../dist/index.js'
import fs from 'fs-extra';

const defaultMockConf = {
  serverPort: 3000,
  wsServerPort: 3001,
  mockDir: 'mock',
  https: false,
  proxyList: [],
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

process.env.mockServerPort = mockConf.serverPort;
process.env.mockServerWsPort = mockConf.wsServerPort;
process.env.mockDir = mockConf.mockDir;
process.env.mockServerIsHttps = mockConf.https;
process.env.mockServerWorkDir = mockServerWorkDir;
process.env.assetsManageWithGit = mockConf.assetsManageWithGit || false;
const proxyInfo = Object.keys(mockConf.proxy || {}).map((key) => ({ ...mockConf.proxy[key], prefix: key }));
startMockServer(proxyInfo);