import assert from 'assert';
import path from 'node:path';
import fse from 'fs-extra';
import {
  projectRootDir,
  move,
  getDirSubList,
  readLocalFile,
} from '@/utils/fileUtils';
import { 
  readObjectFromJsonFile, 
  writeObjectToJsonFile,
  getMockItemSceneListConf,
  initMockConf,
} from '@/utils/jsonUtils';
import type { MockConfigObj, JsonObj, MemoryMockItemAndSceneItemConfType, AppMockConfType } from '@/types/basic';
import { type SceneItemParam, type MockItemParam } from '@/types/requestTypes';
import _ from 'lodash';

let memoryMockConf = {} as any as MockConfigObj;
let memoryMockItemIdAndApiPairList = [] as JsonObj[];

let appMockConf = [] as AppMockConfType;
const memoryMockItemAndSceneItemListPair: Record<string, Array<{ id: string, name: string, param: string }>> = {};

// 这个是给worker线程用，用来获取匹配的参数
let memoryMockItemAndSceneItemConf = {} as any as MemoryMockItemAndSceneItemConfType;

// 获取mockItem配置数据
export const getMockItemConfData = async ():Promise<[MockConfigObj, JsonObj[]]> => {
  const [mockItemIdAndApiPairList, mockConf] = await initMockConf;
  if(Object.keys(memoryMockConf).length === 0) {
    memoryMockConf = _.cloneDeep(mockConf);
    memoryMockItemIdAndApiPairList = _.cloneDeep(mockItemIdAndApiPairList);
  }
  return [ memoryMockConf, memoryMockItemIdAndApiPairList ];
};

await getMockItemConfData();

// 获取mock的全量配置（搜索建立在此基础上）
export const getAppMockConf = async (): Promise<void> => {
  await getMockItemConfData();
  const listForWeb = await Promise.all(memoryMockItemIdAndApiPairList.map(async (item) => {
    const { apiPath: mockApiPath } = item;
    // 获取mockItem的scene列表的配置
    const scenesConf = await getMockItemSceneListConf(mockApiPath);
    // 获取mockItem的scene文件列表
    const scenesFileList = await getDirSubList(path.join(projectRootDir, 'mock', mockApiPath, 'scenes'), { onlyFile: true });
    // 获取mockItem的基本信息
    const mockItemBaseInfo = await readObjectFromJsonFile(path.join(projectRootDir, 'mock', mockApiPath, 'baseConf.json'));
    const scenesBaseInfoList = scenesFileList.map(fileName => {
      const sceneId = fileName.replace(/.ts$/, '');
      return { id: sceneId, ...scenesConf[sceneId] };
    });

    return {
      basicInfo: mockItemBaseInfo,
      scenesList: scenesBaseInfoList,
    };
  }));

  appMockConf = listForWeb;

  listForWeb.forEach((next) => {
    memoryMockItemAndSceneItemListPair[next.basicInfo.id] = next.scenesList;
  });

  memoryMockItemAndSceneItemConf = listForWeb.reduce((mockItemRes, next) => {
    const [apiDirName, mockType] = memoryMockConf.id2ApiAndType[next.basicInfo.id];
    if (!mockItemRes[mockType]) {
      mockItemRes[mockType] = {};
    }
    mockItemRes[mockType][apiDirName] = next.scenesList.reduce((sceneRes, next) => {
      sceneRes[next.id] = next;
      return sceneRes;
    }, {});
    return mockItemRes;
  }, {});
};

export const getMockItemAndSceneItemConf = async ():Promise<MemoryMockItemAndSceneItemConfType> => {
  await getAppMockConf();
  return memoryMockItemAndSceneItemConf;
};

// 搜索mockItem
export const handleSearchMockItem = async (param?: any): Promise<AppMockConfType> => {
  await getAppMockConf();
  return appMockConf;
};

// 添加或修改mockItem
export const handleAddOrUpdateMockItemConf = async (param: MockItemParam): Promise<any> => {
  const { id, path: mockApiPath } = param;
  const paths: string[] = mockApiPath.split('/');
  paths[0] === '' && paths.shift();
  paths[paths.length - 1] === '' && paths.pop();
  const mockRequestType = paths.length ? 'http' : 'rpc';
  const apiAlbumPath = paths.length ? paths.join('.') : mockApiPath;

  assert(mockApiPath, 'apiPath is required');
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
  const res = await writeObjectToJsonFile(path.join(projectRootDir, 'mock', apiAlbumPath, 'baseConf.json'), param);
  assert(res, 'save mockItem failed');
  return true;
};

// 删除mockItem
export const handleDeleteMockItem = async (param: { id: string }): Promise<any> => {
  const { id } = param;
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  delete memoryMockConf[id];
  await fse.remove(path.join(projectRootDir, 'mock', memoryMockConf.id2ApiAndType[id][0]));
  const i = memoryMockItemIdAndApiPairList.findIndex((item) => item.id === id);
  i > -1 && memoryMockItemIdAndApiPairList.splice(i, 1);
  await writeObjectToJsonFile(path.join(projectRootDir, 'mock', 'mockConf.json'), memoryMockConf);
  return true;
};

// 添加或修改mockItem的scene
export const handleAddOrUpdateSceneItem = async (param: SceneItemParam): Promise<any> => {
  const { id, name = '新场景', param: sceneReqParam = '{}', responseConf, mockItemId } = param;
  const mockApiPath = memoryMockConf.id2ApiAndType[mockItemId][0];
  const scenesConf = await getMockItemSceneListConf(mockApiPath);
  const sceneItemIdAndInfoPairList = memoryMockItemAndSceneItemListPair[mockItemId] || [];
  if (!scenesConf[id]) {
    sceneItemIdAndInfoPairList.unshift({ id, name, param: sceneReqParam });
  }
  scenesConf[id] = { name, param: sceneReqParam };
  const writeSceneConfRes = await writeObjectToJsonFile(path.join(projectRootDir, 'mock', mockApiPath, 'scenesConf.json'), scenesConf);
  await fse.outputFile(path.join(projectRootDir, 'mock', mockApiPath, 'scenes', `${id}.ts`), responseConf ?? '');
  assert(writeSceneConfRes, 'save sceneItem failed');
  return sceneItemIdAndInfoPairList;
};

// 删除mockItem的scene
export const handleDeleteSceneItem = async (param: { sceneId: string, mockItemId: string }): Promise<any> => {
  const { mockItemId, sceneId } = param;
  const mockApiPath = memoryMockConf.id2ApiAndType[mockItemId][0];
  const sceneItemIdAndInfoPairList = memoryMockItemAndSceneItemListPair[mockItemId];
  const scenesConf = await getMockItemSceneListConf(mockApiPath);
  const apiPath = memoryMockConf.id2ApiAndType[mockItemId][0];
  assert(apiPath, 'not fond apiPath in dir');
  const writeSceneConfRes = await writeObjectToJsonFile(path.join(projectRootDir, 'mock', mockApiPath, 'scenesConf.json'), scenesConf);
  assert(writeSceneConfRes, 'save sceneItem failed');
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  delete scenesConf[sceneId];
  const i = sceneItemIdAndInfoPairList.findIndex((item) => item.id === sceneId);
  sceneItemIdAndInfoPairList.splice(i, 1);
  await fse.remove(path.join(projectRootDir, 'mock', apiPath, 'scenes', `${sceneId}.ts`));
  return sceneItemIdAndInfoPairList;
};

// 获取SceneItem的返回值配置
export const getSceneItemResponseConf = async (param: { mockItemId: string, sceneId: string }): Promise<string> => {
  const { mockItemId, sceneId } = param;
  const apiPath = memoryMockConf.id2ApiAndType[mockItemId][0];
  const file = await readLocalFile(path.join(projectRootDir, 'mock', apiPath, 'scenes', `${sceneId}.ts`));
  return file;
};