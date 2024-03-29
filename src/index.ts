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

const _dirname = join(fileURLToPath(import.meta.url), '../');

let wsServer: any;

const messageStatusPair: any = {};

const startServer = (port: number, open = false, remark: string = "mock server"): http.Server => {
  const server = http.createServer();

  server.listen(port, () => {
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
  response.setHeader('Content-Type', 'text/plain; charset=utf-8');
  const statusCode = success ? 200 : 500;
  response.write(JSON.stringify(data));
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

  const mockServer = startServer(serverPort);

  mockServer.on('request', (req, res) => {
    const parsedUrl = new URL(req.url ?? '', `http://${req.headers.host}`);
    const apiPath: string = parsedUrl.pathname;
    const apiQuery = parsedUrl.searchParams;
    let requestBodyStr = '';
    let param;
  
    req.on('data', (thunk) => {
      if (Buffer.isBuffer(thunk)) {
        requestBodyStr += thunk.toString();
      } else {
        requestBodyStr += thunk;
      }
    });
    req.on('end', () => {
      if(req.method === 'GET') {
        param = [...apiQuery.keys()].reduce((rsObj, key) => {
          rsObj[key] = apiQuery.get(key);
          return rsObj;
        }, {});
      } else {
      // 根据请求头的Content-Type处理请求体
        switch (true) {
          case req.headers['content-type']?.includes('application/json'):
            param = JSON.parse(requestBodyStr);
            break;
          case req.headers['content-type']?.includes('application/x-www-form-urlencoded'):
            {
            // 处理URL编码格式的请求体
              const dataAsObject = new URLSearchParams(requestBodyStr);
              param = Object.fromEntries(dataAsObject);
            }
            break;
          case req.headers['content-type']?.includes('multipart/form-data'):
            {
            // 处理multipart/form-data格式的请求体
              const boundary = req.headers['content-type']?.split('boundary=')[1];
              const dataAsObject = requestBodyStr?.split(boundary ?? '')?.reduce((rsObj: any, part) => {
                if (part.includes('filename')) {
                  const filename = (part.match(/filename="(.*)"/) ?? [])?.[1];
                  rsObj.filename = filename;
                } else {
                  const key = (part.match(/name="(.*)"/) ?? [])?.[1];
                  rsObj[key] = part.split('\r\n').slice(2, -2).join('\r\n');
                }
                return rsObj;
              }, {});
              param = dataAsObject;
            }
            break;
          default:
            console.log('other header: ', req.headers['content-type']);
            break;
        }
      }

      const paths: string[] = apiPath.split('/');
      paths[0] === '' && paths.shift();
      paths[paths.length - 1] === '' && paths.pop();
      switch (true) {
        case /^\/?mock-system\/.*/.test(apiPath):
          handleSystemRequest(apiPath, param, res);
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
            // 是否要走代理及是否要创建mock数据
            let isNeedProxy, isNeedCreateMock;
            if (!memoryData.memoryMockConf?.api2IdAndCheckedScene?.[purifiedFormattedPath]) {
              isNeedProxy = true;
              isNeedCreateMock = memoryData.isCreateMockItemFromRequest;
            } else {
              const thisMockItemMockPattern = memoryData.memoryMockConf.api2IdAndCheckedScene[purifiedFormattedPath].mockPattern;
              isNeedProxy = thisMockItemMockPattern.startsWith('request') || memoryData.isCreateMockItemFromRequest;
              isNeedCreateMock = thisMockItemMockPattern.endsWith('create') || memoryData.isCreateMockItemFromRequest;
            }

            if (!isNeedProxy && !isNeedCreateMock) {
              const messageId = uuid();
              handleHttpWorkerRequest({ apiPath: purifiedFormattedPath, param, messageId }, memoryData, res).catch(console.error);
            } else if (matchedProxy.target && isNeedProxy) {
              const info2CreateMockItemFromRequest = {
                apiPath,
                param,
                mockItemId: memoryData.memoryMockConf?.api2IdAndCheckedScene?.[purifiedFormattedPath]?.id ?? uuid(),
                isCreateMockItemFromRequest: isNeedCreateMock,
              };

              proxyRequest({ ...matchedProxy, authInfo: memoryData.authInfo[matchedProxy.prefix] }, requestBodyStr, req, res, info2CreateMockItemFromRequest, wsServer);
            } else {
              res.statusCode = 404;
              res.end();
            }
          }
          break;
      }

    });
  });
};