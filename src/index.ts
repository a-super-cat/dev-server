import http from 'node:http';
import { WebSocketServer } from 'ws';
import { URL, fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { handleWebRequest, handleSystemRequest } from '@/server';
import { getMemoryData } from '@/server/service/mainService';
import chalk from 'chalk';
import c, { fork } from 'node:child_process';
import { v4 as uuid } from 'uuid';
import type { ServerResponse, IncomingMessage } from 'node:http';
import { proxyRequest } from '@/proxyServer/httpProxyServer';
import { localIps } from '@/utils/constants';
import { parseBody, formatParams } from '@/utils/commonUtils';
import type { JsonObj } from './types/basic';

const _dirname = join(fileURLToPath(import.meta.url), '../');

let wsServer: any;

const messageStatusPair: any = {};

const startServer = (port: number, open = false, remark: string = "mock server"): http.Server => {
  const server = http.createServer({ keepAlive: true, requestTimeout: 10000 });
  server.listen(port, () => {
    server.setTimeout(10000);
    console.log(chalk.green(`${remark || ''} Server running at http://localhost:${port}/`));
    if (open) {
      c.exec(`start http://localhost:${port}`);
    }
  });

  server.on('error', (error: any) => {
    if (error.code === 'EADDRINUSE') {
      console.log(chalk.blue(`${remark || ''} Server port ${port} is in use, trying another one...`));
      server.close( () => {
        startServer(port + 1,open, remark); // 尝试下一个端口
      });
    } else {
      console.error(error);
    }
  });

  return server;
};


const afterMessageDealCallBack = (resolve, param, response: any) => (messageRes: any) => {
  const { data, mockItemId, matchedScene, success } = messageRes;
  response.setHeader('Content-Type', 'application/json;charset=utf-8');
  const statusCode = success ? 200 : 500;
  response.write(JSON.stringify(data || {}));
  response.statusCode = statusCode;
  response.end();
  wsServer?.clients?.forEach((client: any) => {
    const wsReqIp = client._socket.remoteAddress;
    if (localIps.includes(wsReqIp)) {
      client.send(JSON.stringify({ type: 'param', data: { mockItemId, matchedScene, param } }));
    }
  });
  resolve(messageRes);
};

const httpWorker = fork(join(_dirname, './server/service/httpWorkerService.js'), [], { env: process.env });
httpWorker.on('message', (msg: any) => {
  const { messageId } = msg;
  messageStatusPair?.[messageId]?.(msg);
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  delete messageStatusPair[messageId];
});

const handleHttpWorkerRequest = async (arg: any, memoryData, response: ServerResponse<IncomingMessage>): Promise<void> => {
  await new Promise((resolve, reject) => {
    const { messageId, param } = arg;
    messageStatusPair[messageId] = afterMessageDealCallBack(resolve, param, response);
    httpWorker.send({ arg, memoryData });
  });
};


export const startMockServer = (proxyInfo: any): void => {
  const { mockServerPort: serverPort, mockServerWsPort: wsServerPort } = process.env as any;
  // websocket服务
  wsServer = new WebSocketServer({ port: wsServerPort });
  wsServer.on('listening', () => {
    console.log(chalk.green(`WebSocket Server running at ws://localhost:${wsServerPort}/`));
  });
  wsServer.on('connection', (ws) => {
    console.log(chalk.green('WebSocket Server connected'));
  });

  const mockServer = startServer(serverPort, true, 'Mock');

  mockServer.on('request', (req, res) => {
    const parsedUrl = new URL(req.url ?? '', `http://${req.headers.host}`);
    const apiPath: string = parsedUrl.pathname;
    const apiQuery = parsedUrl.searchParams;
    let param;

    switch (true) {
      case /^\/?mock-system\/.*/.test(apiPath):
        // 系统请求
        if (req.method === 'GET') {
          param = formatParams([...apiQuery.keys()].reduce((rsObj, key) => {
            rsObj[key] = apiQuery.get(key);
            return rsObj;
          }, {}));

          handleSystemRequest(apiPath, param, res);
        } else {
          parseBody(req).then((parsedObj) => {
            handleSystemRequest(apiPath, parsedObj, res);
          }).catch(console.error);
        }
        break;
      case /^\/?mock-web\/.*/.test(apiPath) || apiPath === '/':
        if (apiPath === '/') {
          res.writeHead(302, { Location: '/mock-web/' });
          res.end();
        } else {
          handleWebRequest(apiPath, res);
        }
        break;
      default:
        {
          // 这个路径是删除掉prefix的路径
          let purifiedApiPath = apiPath;
          const memoryData = getMemoryData();
          const matchedProxy = proxyInfo.find((i) => apiPath.startsWith(i.prefix) || apiPath.startsWith(`/${i.prefix}`));
          if (Object.keys(matchedProxy || {}).length > 0) {
            purifiedApiPath = apiPath.replace(matchedProxy.prefix, '');
          }
          const purifiedFormattedPath = purifiedApiPath.split('/').filter(Boolean).join('.');
          const mockItemDir = `${req.method ?? 'GET'}.${purifiedApiPath.split('/').filter(Boolean).join('.')}`;

          // 带有路径参数的mockItem
          const withPathParamsMockItemList = memoryData.memoryMockItemIdAndApiPairList.filter(item => item?.apiPath?.includes('__'));
          const matchedMockItem: JsonObj | undefined = withPathParamsMockItemList.find(item => {
            const mockItemDirName: string = item.apiPath;
            const matchPartten = mockItemDirName.replaceAll(/\.__\w+\.?/g, '.\\w+.');
            return new RegExp(`^${matchPartten}$`).test(mockItemDir);
          }); 

          const matchedMockItemDir = memoryData.memoryMockConf.api2IdAndCheckedScene?.[mockItemDir]?.mockPattern ? mockItemDir : matchedMockItem?.apiPath;

          // 是否要走代理及是否要创建mock数据
          let isNeedProxy, isNeedCreateMock;
          if (!memoryData.memoryMockConf?.api2IdAndCheckedScene?.[matchedMockItemDir]) {
            isNeedProxy = true;
            isNeedCreateMock = memoryData.isCreateMockItemFromRequest;
          } else {
            const thisMockItemMockPattern = memoryData.memoryMockConf.api2IdAndCheckedScene?.[matchedMockItemDir]?.mockPattern;
            isNeedProxy = thisMockItemMockPattern.startsWith('request') || memoryData.isCreateMockItemFromRequest;
            isNeedCreateMock = thisMockItemMockPattern.endsWith('create') || memoryData.isCreateMockItemFromRequest;
          }

          if (!isNeedProxy && !isNeedCreateMock) {
            const messageId = uuid();
            if (req.method === 'GET') {
              param = formatParams([...apiQuery.keys()].reduce((rsObj, key) => {
                rsObj[key] = apiQuery.get(key);
                return rsObj;
              }, {}));
              handleHttpWorkerRequest({ mockItemDir: matchedMockItemDir, purifiedFormattedPath, param, messageId }, memoryData, res).catch(console.error);
            } else {
              parseBody(req).then((parsedObj) => {
                handleHttpWorkerRequest({ mockItemDir: matchedMockItemDir, purifiedFormattedPath, param: parsedObj, messageId }, memoryData, res).catch(console.error);
              }).catch(console.error);
            }
          } else if (matchedProxy?.target && isNeedProxy) {
            const info2CreateMockItemFromRequest = {
              apiPath,
              mockItemId: memoryData.memoryMockConf?.api2IdAndCheckedScene?.[mockItemDir]?.id ?? uuid(),
              isCreateMockItemFromRequest: isNeedCreateMock,
            };

            proxyRequest({
              ...matchedProxy, 
              loginPath: memoryData.authConf?.[matchedProxy.prefix]?.loginPath,
              authCodePath: memoryData.authConf?.[matchedProxy.prefix]?.authCodePath,
              auth: memoryData.authConf?.[matchedProxy.prefix]?.auth,
              conf: memoryData.authConf?.[matchedProxy.prefix]?.conf,
            }, req, res, info2CreateMockItemFromRequest, wsServer);
          } else {
            console.log('not find matched proxy for: ', apiPath);
            res.statusCode = 404;
            res.end();
          }
        }
        break;
    }
  });
};