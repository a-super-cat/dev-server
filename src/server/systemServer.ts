import assert from 'assert';
import path from 'node:path';
import {
  projectRootDir,
  move,
} from '@/utils/fileUtils';
import { 
  readObjectFromJsonFile, 
  writeObjectToJsonFile,
  httpMockConf,
  rpcMockConf,
} from '@/utils/jsonUtils';
import type { ServerResponse, IncomingMessage } from 'http';
import type { MockConfigObj, JsonObj } from '@/types/basic';
import _ from 'lodash';

let memoryMockConf = {} as any as MockConfigObj;
let memoryMockItemIdAndApiPairList = [] as JsonObj[];

const handleMockItemOperation = async (operation: string, param: any):Promise<any> => {
  const { mockItemId: id, apiPath } = param;
  assert(apiPath, 'apiPath is required');
  const paths: string[] = apiPath.split('/');
  paths[0] === '' && paths.shift();
  paths[paths.length - 1] === '' && paths.pop();
  const mockServerType = paths.length ? 'http' : 'rpc';
  const [mockItemIdAndApiPairList, mockConf] = await (mockServerType === 'http' ? httpMockConf : rpcMockConf);
  if(Object.keys(memoryMockConf).length === 0) {
    memoryMockConf = _.cloneDeep(mockConf);
    memoryMockItemIdAndApiPairList = _.cloneDeep(mockItemIdAndApiPairList);
  }
  const apiAlbumPath = paths.length ? paths.join('.') : apiPath;
  switch (operation) {
    case 'save':
    {
      // 如果id存在，且id对应的apiPath不是当前的apiPath，则移动文件且修改mockConf
      if(memoryMockConf.id2Api[id] && memoryMockConf.id2Api[id] !== apiAlbumPath) {
        await move(path.join(projectRootDir, 'mock', mockServerType, memoryMockConf.id2Api[id]), path.join(projectRootDir, 'mock', mockServerType, apiAlbumPath));
      }
      // 匹配以下情况则说明是新mockItem或者id对应的apiPath已经发生改变，需要进行mockConf的持久化
      if (memoryMockConf.id2Api[id] !== apiAlbumPath) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete memoryMockConf.api2Id[memoryMockConf.id2Api[id]];
        memoryMockConf.id2Api[id] = apiAlbumPath;
        memoryMockConf.api2Id[apiAlbumPath] = id;
        await writeObjectToJsonFile(path.join(projectRootDir, 'mock', mockServerType, 'mockConf.json'), memoryMockConf);
      }
      const res = writeObjectToJsonFile(path.join(projectRootDir, 'mock', mockServerType, apiAlbumPath, 'baseConf.json'), param);
      assert(res, 'save mockItem failed');
      return true;
    }
    case 'list':
    {
      return mockItemIdAndApiPairList;
    }

  }
};

const handleSceneItemOperation = async (operation: string, param: any):Promise<any> => {
  
};

// 分发请求
const dispatchRequest = async (apiPath: string, param: any):Promise<any> => {
  try {
    switch (apiPath) {
      // mockItem操作
      case '/mock-system/saveMockItem':
        return await handleMockItemOperation('save', param);
      case '/mock-system/getMockItemList':
        return await handleMockItemOperation('list', param);
      case '/mock-system/getMockItemOne':
        return await handleMockItemOperation('one', param);
      case '/mock-system/deleteMockItem':
        return await handleMockItemOperation('delete', param);
      // sceneItem操作
      case '/mock-system/saveSceneItem':
        return await handleSceneItemOperation('save', param);
      case '/mock-system/getSceneItemList':
        return await handleSceneItemOperation('list', param);
      case '/mock-system/getSceneItemOne':
        return await handleSceneItemOperation('one', param);
      case '/mock-system/deleteSceneItem':
        return await handleSceneItemOperation('delete', param);
    }
  } catch (err) {
    return err;
  }
};


export const handleSystemRequest = (apiPath: string, requestData: any, res: ServerResponse<IncomingMessage>):any => {
  console.log('handleSystemRequest', apiPath);
  dispatchRequest(apiPath, requestData).then((data) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.write(JSON.stringify({ code: 200, data, msg: 'success' }));
    res.statusCode = 200;
    res.end();
  }).catch((err) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.write(JSON.stringify({ code: 500, msg: 'error', data: err }));
    res.statusCode = 500;
    res.end();
  });
  
};