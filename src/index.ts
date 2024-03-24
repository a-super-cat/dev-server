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

const _dirname = join(fileURLToPath(import.meta.url), '../');
const localIps = ['::1', '127.0.0.1'];

const apiServerPort = 3000;
const webSocketPort = 3001;

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
  response.write(JSON.stringify({ code: statusCode, data, msg: success ? 'success' : 'fail' }));
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

const httpWorker = fork(join(_dirname, './server/service/httpWorkerService.js'));
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


export const startMockServer = (config: any): void => {
  // websocket服务
  wsServer = new WebSocketServer({ port: webSocketPort });
  wsServer.on('listening', () => {
    console.log(chalk.green(`WebSocket Server running at ws://localhost:${webSocketPort}/`));
  });
  wsServer.on('connection', (ws) => {
    console.log(chalk.green('WebSocket Server connected'));
  });

  const mockServer = startServer(apiServerPort);

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
        switch (req.headers['content-type']) {
          case 'application/json':
            param = JSON.parse(requestBodyStr);
            break;
          case 'application/x-www-form-urlencoded':
            {
            // 处理URL编码格式的请求体
              const dataAsObject = new URLSearchParams(requestBodyStr);
              console.log(Object.fromEntries(dataAsObject));
              res.end('Received URL-encoded data');
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
      const formattedPath = paths.length ? paths.join('.') : apiPath;
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
            const messageId = uuid();
            handleHttpWorkerRequest({ apiPath: formattedPath, param, messageId }, getMemoryData(), res).catch(console.error);
          }
          break;
      }

    });
  });
};