import http from 'http';
import { URL } from 'node:url';
import _ from 'lodash';
import * as prettier from 'prettier';
import { join } from 'node:path';
import { v4 as uuid } from 'uuid';
import { projectRootDir, mockDirName } from '@/utils/fileUtils';
import { createMockItemAndSceneItemFromProxy, setAuthInfo } from '@/server/service/mainService';
import { localIps } from '@/utils/constants';
import type { PeekObjectFromStream } from '@/stream/PeekObjectFromStream';
import fse from 'fs-extra';
import assert from 'assert';

export const proxyRequest = (proxyInfo: any, peekObjStream: PeekObjectFromStream, req: http.IncomingMessage, res: http.ServerResponse, createMockConfOptions: any, wsServer: any): void => {
  const { 
    prefix, 
    target, 
    changeOrigin = true, 
    deletePrefix = true, 
    auth = {}, 
    loginPath, 
    authCodePath, 
    conf = {},
  } = proxyInfo;
  const { apiPath, mockItemId, isCreateMockItemFromRequest } = createMockConfOptions;
  let requestParam = {};
  // eslint-disable-next-line no-template-curly-in-string
  const { authType = 'header', conf: authorizedInfo = { Authorization: 'Bearer ${token}' } } = conf;
  // 授权用的key
  const authKey = Object.keys(authorizedInfo || {})?.[0] ?? 'Authorization';
  const formattedApiPath = apiPath?.startsWith(prefix) ? apiPath?.replace(prefix, '') : apiPath?.replace(`/${prefix}`, '');
  let reqPath = req.url;
  // 如果是query方式，将授权信息拼接到url上
  if(authType === 'query') {
    const pathUtil = new URL(req.url ?? '', `http://${req.headers.host}`);
    authType === 'query' && pathUtil.searchParams.append(authKey, auth[authKey]);
    reqPath = pathUtil.pathname + pathUtil.search;
  }

  peekObjStream.on('parsed', (obj) => {
    requestParam = obj;
  });

  const options = {
    path: deletePrefix ? formattedApiPath : reqPath,
    method: req.method,
    Headers: {
      // ..._.omit(req.headers, ['host']),
      ...changeOrigin ? { host: target } : {},
      ...authType === 'header' ? auth : {},
    },
  };

  const proxyReq = http.request(target, options, (proxyRes) => {
    const sceneId = uuid();
    res.writeHead(proxyRes.statusCode ?? 200, proxyRes.headers);

    // 解析响应流中的数据
    let resStr = '';
    let objFromStream;
    proxyRes.on('data',(chunk) => {
      resStr += chunk.toString();
    });
    proxyRes.on('end', () => {
      try {
        objFromStream = JSON.parse(resStr);
      } catch {
        objFromStream = {};
      }
      if (Object.keys(objFromStream).length) {
        // 如果是授权的请求则保存授权信息
        if(formattedApiPath?.startsWith(loginPath)) {
          try {
            assert(authCodePath, 'authCodePath is required');
            const token = _.get(objFromStream, authCodePath);
            assert(token, 'not find token in response data (by authCodePath)');
            // eslint-disable-next-line no-template-curly-in-string
            const authValuePattern = authorizedInfo?.[authKey] ?? 'Bearer ${token}';
            const formattedToken = authValuePattern.replace(/\$\{\w+\}/g, token);
            setAuthInfo({ prefix, auth: { [authKey]: formattedToken } }); // 保存授权信息
          } catch (error) {
            console.error('get auth info error', error);
          }
        }

        // 将响应数据转换为mock配置
        if ( isCreateMockItemFromRequest ) {
          const mockItemdir = formattedApiPath.split('/').filter(Boolean).join('.') ?? 'default';
          const fileName = join(projectRootDir, mockDirName, mockItemdir, 'scenes', `${sceneId}.ts`);
          const formattedMockConf = `export default (param: any) => {
            return ${JSON.stringify(objFromStream, null, 2)};
          }`;
          Promise.all([prettier.format(JSON.stringify(requestParam ?? {}, null, 2), { parser: 'json' }), prettier.format(formattedMockConf, { parser: 'typescript' })])
            .then(([prettieredParam, prettieredResponse]) => {
              createMockItemAndSceneItemFromProxy({
                mockItem: {
                  id: mockItemId,
                  apiPath: formattedApiPath,
                  mockPattern: 'mock',
                  type: 'HTTP',
                  requestMethod: req.method as any,
                },
                sceneItem: {
                  id: sceneId,
                  name: 'From Request',
                  param: prettieredParam ?? '{}',
                },
              }, () => {
                wsServer?.clients?.forEach((client: any) => {
                  const wsReqIp = client._socket.remoteAddress;
                  if (localIps.includes(wsReqIp)) {
                    client.send(JSON.stringify({ type: 'refresh:mockList', data: { } }));
                  }
                });
              });
              fse.outputFile(fileName, prettieredResponse).catch(console.error);
            }).catch(console.error);
        }
      }
    });

    // 将响应数据转发到客户端
    proxyRes.pipe(res);
  });

  if (authType === 'header' && auth[authKey]) {
    proxyReq.setHeader(authKey, auth[authKey]);
  }

  if (req.method !== 'GET') {
    // 将客户端的请求体转发到目标服务器
    const includeHeaders = ['user-agent', 'content-length'];
    includeHeaders.forEach((key: string) => {
      if (req.headers[key]) {
        proxyReq.setHeader(key, req.headers[key] as string);
      }
    });
    proxyReq.setHeader('Connection', 'keep-alive');
    proxyReq.setHeader('Origin', target);
    proxyReq.setHeader('Content-Type', req.headers['content-type'] ?? 'application/json');
    peekObjStream.pipe(proxyReq);
  } else {
    // 将客户端的请求体转发到目标服务器
    req.pipe(proxyReq);
    proxyReq.end();
  }

  proxyReq.on('error', (e) => {
    console.error(`problem with request: ${e.message}`, e.stack);
  });

};
