import assert from 'assert';
import path from 'node:path';
import {
  projectRootDir,
  move,
  getDirSubList,
} from '@/utils/fileUtils';
import { 
  readObjectFromJsonFile, 
  writeObjectToJsonFile,
  getMockItemSceneListConf,
  initMockConf,
} from '@/utils/jsonUtils';
import type { ServerResponse, IncomingMessage } from 'http';
import type { MockConfigObj, JsonObj } from '@/types/basic';
import _ from 'lodash';

let memoryMockConf = {} as any as MockConfigObj;
let memoryMockItemIdAndApiPairList = [] as JsonObj[];

const handleMockItemOperation = async (operation: string, param: any):Promise<any> => {
  const { id, path: apiPath } = param;
  const [mockItemIdAndApiPairList, mockConf] = await initMockConf;
  if(Object.keys(memoryMockConf).length === 0) {
    memoryMockConf = _.cloneDeep(mockConf);
    memoryMockItemIdAndApiPairList = _.cloneDeep(mockItemIdAndApiPairList);
  }
  if(operation === 'list') {
    console.log('memoryMockItemIdAndApiPairList', memoryMockItemIdAndApiPairList);
    return await Promise.all(memoryMockItemIdAndApiPairList.map(async (item) => {
      const { apiPath } = item;
      // 获取mockItem的scene列表的配置
      const scenesConf = await getMockItemSceneListConf(apiPath);
      // 获取mockItem的scene文件列表
      const scenesFileList = await getDirSubList(path.join(projectRootDir, 'mock', apiPath, 'scenes'), { onlyFile: true });
      // 获取mockItem的基本信息
      const mockItemBaseInfo = await readObjectFromJsonFile(path.join(projectRootDir, 'mock', apiPath, 'baseConf.json'));
      const scenesBaseInfoList = scenesFileList.map(fileName => {
        const sceneId = fileName.replace(/.json^/, '');
        return scenesConf[sceneId];
      });
      return {
        basicInfo: mockItemBaseInfo,
        scenesList: scenesBaseInfoList,
      };
    }));
  }
  assert(apiPath, 'apiPath is required');
  const paths: string[] = apiPath.split('/');
  paths[0] === '' && paths.shift();
  paths[paths.length - 1] === '' && paths.pop();
  const mockRequestType = paths.length ? 'http' : 'rpc';
  const apiAlbumPath = paths.length ? paths.join('.') : apiPath;
  switch (operation) {
    case 'save':
    {
      const originPath = memoryMockConf.id2ApiAndType[id]?.[0] || '';
      // 匹配以下情况则说明是新mockItem或者id对应的apiPath已经发生改变，需要进行mockConf的持久化
      if (originPath !== apiAlbumPath) {
        
        // 如果id存在，且id对应的apiPath不是当前的apiPath，则移动文件
        if (originPath) {
          const whichChange = memoryMockItemIdAndApiPairList.findIndex((item) => item.id === id);
          console.log('whichChange', whichChange, param, memoryMockItemIdAndApiPairList);
          assert(whichChange !== -1, 'mockItem id not found');
          memoryMockItemIdAndApiPairList[whichChange].apiPath = apiAlbumPath;
          await move(path.join(projectRootDir, 'mock', originPath), path.join(projectRootDir, 'mock', apiAlbumPath));
        } else {
          memoryMockItemIdAndApiPairList.unshift({ id, apiPath: apiAlbumPath, type: mockRequestType });
        }

        // 更新内存中的mockConf
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete memoryMockConf.api2Id[originPath];
        memoryMockConf.id2ApiAndType[id] = [apiAlbumPath, mockRequestType];
        memoryMockConf.api2Id[apiAlbumPath] = id;
        // 当mockConf发生变化时，memoryMockItemIdAndApiPairList也要进行更新
        await writeObjectToJsonFile(path.join(projectRootDir, 'mock', 'mockConf.json'), memoryMockConf);
      }
      const res = writeObjectToJsonFile(path.join(projectRootDir, 'mock', apiAlbumPath, 'baseConf.json'), param);
      assert(res, 'save mockItem failed');
      return true;
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
    console.log('dispatchRequest error:', err);
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