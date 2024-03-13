import { 
  httpMockApiDirList, 
  rpcMockApiDirList, 
  projectRootDir, 
  isDirectory, 
  mkdir,
} from '@/utils/fileUtils';
import { readObjectFromJsonFile, writeObjectToJsonFile } from '@/utils/jsonUtils';
import type { RequestItemLocalConf } from "@/types/requestTypes";
import type { JsonObj } from '@/types/basic';
import type { IncomingMessage } from 'node:http';
import path from 'node:path';
import { v4 as uuid } from 'uuid';

// http请求的持久化配置路径
const httpApiConf = path.join(projectRootDir, 'mock', 'http', 'httpConf.json');
// rpc请求的持久化配置路径
const rpcApiConf = path.join(projectRootDir, 'mock', 'rpc', 'rpcConf.json');

// http请求的配置（api与id的绑定关系）
export let httpApiAndIdPair: RequestItemLocalConf[] = [];
// 从http请求的持久化配置文件获取到的对象
export let httpApiAndIdPairObj = {};

// rpc请求的配置（api与id的绑定关系）
export let rpcApiAndIdPair: RequestItemLocalConf[] = [];
// 从rpc请求的持久化配置文件获取到的对象
export let rpcApiAndIdPairObj = {};

// 初始化http请求的配置
export const initExistedHttpRequests = ():[RequestItemLocalConf[], JsonObj] => {
  let isNeedStoreApiConf = false;
  httpApiAndIdPairObj = readObjectFromJsonFile(httpApiConf);
  httpApiAndIdPair = httpMockApiDirList
    .filter(orgPath => isDirectory(path.join(projectRootDir, 'mock', 'http', orgPath)))
    .map(apiPath => {
      if(httpApiAndIdPairObj[apiPath]) {
        return { apiPath, uuid: httpApiAndIdPairObj[apiPath] };
      } else {
        isNeedStoreApiConf = true;
        const apiId = uuid();
        httpApiAndIdPairObj[apiPath] = apiId;
        return { apiPath, uuid: apiId };
      }
    });

  if(isNeedStoreApiConf) {
    writeObjectToJsonFile(httpApiConf, httpApiAndIdPairObj);
  }

  return [httpApiAndIdPair, httpApiAndIdPairObj];
};

// 初始化rpc请求的配置
export const initExistedRpcRequests = ():[RequestItemLocalConf[], JsonObj] => {
  let isNeedStoreApiConf = false;
  rpcApiAndIdPairObj = readObjectFromJsonFile(rpcApiConf);
  rpcApiAndIdPair = rpcMockApiDirList
    .filter(orgPath => isDirectory(path.join(projectRootDir, 'mock', 'rpc', orgPath)))
    .map(apiPath => {
      if(rpcApiAndIdPairObj[apiPath]) {
        return { apiPath, uuid: rpcApiAndIdPairObj[apiPath] };
      } else {
        isNeedStoreApiConf = true;
        const apiId = uuid();
        rpcApiAndIdPairObj[apiPath] = apiId;
        return { apiPath, uuid: apiId };
      }
    });

  if(isNeedStoreApiConf) {
    writeObjectToJsonFile(rpcApiConf, rpcApiAndIdPairObj);
  } 

  return [rpcApiAndIdPair, rpcApiAndIdPairObj];
};

initExistedHttpRequests();
initExistedRpcRequests();
