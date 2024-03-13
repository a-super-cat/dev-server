import http from 'node:http';
import { URL } from 'node:url';
import { handleWebRequest, handleHttpMockRequest, handleSystemRequest } from '@/server';
import chalk from 'chalk';
import c from 'node:child_process';
const apiServerPort = 3000;
const webServerPort = 8080;

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

const apiServer = startServer(apiServerPort, 'API');
// const webServer =startServer(webServerPort, 'WEB', false);

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
          res.end('Received data');
          break;
      }
    }

    switch (true) {
      case /^\/?mock-system\/.*/.test(apiPath):
        handleSystemRequest(apiPath, param, res);
        break;
      case /^\/?web-static\/.*/.test(apiPath):
        handleWebRequest(apiPath, res);
        break;
      default:
        handleHttpMockRequest(apiPath);
        res.setHeader('Content-Type', 'application/json');
        res.write('{"msg": "hello world"}');
        res.statusCode = 200;
        res.end();
        break;
    }

  });
});

// webServer.on('request', (req, res) => {
//   const parsedUrl = new URL(req.url ?? '', `http://${req.headers.host}`);
//   const webPath: string = parsedUrl.pathname;
//   handleWebRequest(webPath, req).then((data) => {
//     if(data) {
//       res.setHeader('Content-Type', mime.getType(webPath));
//       res.write(data);
//       res.statusCode = 200;
//       res.end();
//     }
//   }).catch((err) => {
//     console.log('err', err);
//   });
// });