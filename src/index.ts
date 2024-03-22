import http from 'node:http';
import { WebSocketServer } from 'ws';
import { URL, fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { handleWebRequest, handleHttpMockRequest, handleSystemRequest } from '@/server';
import chalk from 'chalk';
import c, { fork } from 'node:child_process';
import { v4 as uuid } from 'uuid';
import type { ServerResponse, IncomingMessage } from 'node:http';
import { loadSync } from '@grpc/proto-loader';
import grpc, { loadPackageDefinition, ServerCredentials } from '@grpc/grpc-js';

const _dirname = join(fileURLToPath(import.meta.url), '../');
const localIps = ['::1', '127.0.0.1'];

const apiServerPort = 3000;
const webSocketPort = 3001;
const webServerPort = 8080;

const messageStatusPair: any = {};

const startServer = (port: number, remark: string, open = false): http.Server => {
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
        startServer(port + 1, remark); // 尝试下一个端口
      });
    } else {
      console.error(error);
    }
  });

  return server;
};

// websocket服务
const wsServer = new WebSocketServer({ port: webSocketPort });
wsServer.on('listening', () => {
  console.log(chalk.green(`WebSocket Server running at ws://localhost:${webSocketPort}/`));
});
wsServer.on('connection', (ws) => {
  console.log(chalk.green('WebSocket Server connected'));
});

const afterMessageDealCallBack = (resolve, param, response: any) => (messageRes: any) => {
  const { data, mockItemId, matchedScene, success } = messageRes;
  response.setHeader('Content-Type', 'text/plain; charset=utf-8');
  const statusCode = success ? 200 : 500;
  response.write(JSON.stringify({ code: statusCode, data, msg: success ? 'success' : 'fail' }));
  response.statusCode = statusCode;
  response.end();
  wsServer.clients.forEach((client: any) => {
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

const handleHttpWorkerRequest = async (arg: any, response: ServerResponse<IncomingMessage>): Promise<void> => {
  await new Promise((resolve, reject) => {
    const { messageId, param } = arg;
    messageStatusPair[messageId] = afterMessageDealCallBack(resolve, param, response);
    httpWorker.send(arg);
  });
};

const apiServer = startServer(apiServerPort, 'API');

apiServer.on('request', (req, res) => {
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
      case /^\/?web-static\/.*/.test(apiPath):
        handleWebRequest(apiPath, res);
        break;
      default:
        {
          const messageId = uuid();
          handleHttpWorkerRequest({ apiPath: formattedPath, param, messageId }, res).catch(console.error);
        }
        break;
    }

  });
});
