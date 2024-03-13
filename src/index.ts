import http from 'node:http';
import { URL } from 'node:url';
import { handleWebRequest, handleHttpMockRequest, handleSystemRequest } from '@/server';
import chalk from 'chalk';
import c from 'node:child_process';
const apiServerPort = 3000;
const webServerPort = 8080;

let requestBodyStr = '';

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
  let param;
  console.log('--------------',req.method);
  if(req.method === 'GET') {
    param = [...apiQuery.keys()].reduce((rsObj, key) => {
      rsObj[key] = apiQuery.get(key);
      return rsObj;
    }, {});

    // const data = handleHttpMockRequest(apiPath);
    // if(data) {
    //   res.setHeader('Content-Type', '"text/html;charset=utf-8"');
    //   res.write(data);
    //   res.statusCode = 200;
    //   res.end();
    // }
  } else {
    requestBodyStr = '';
    req.on('data', (thunk) => {
      requestBodyStr += thunk;
    });
    req.on('end', () => {
      switch (req.headers['content-type']) {
        case 'application/json':
          {
            const dataAsJson = JSON.parse(requestBodyStr);
            param = dataAsJson;
            console.log(dataAsJson);
            res.end('Received JSON data');
          }
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
    });
  }

  const responseData = { code: 200 };

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
      res.write(JSON.stringify(responseData));
      res.statusCode = 200;
      res.end();
      break;
  }
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