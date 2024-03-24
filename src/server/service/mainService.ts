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
import type { 
  MockConfigObj, 
  JsonObj, 
  MemoryMockItemAndSceneItemConfType, 
  AppMockConfType, 
  MockItemBaseInfoType,
  SceneItemBaseInfoType,
} from '@/types/basic';
import { type SceneItemParam, type MockItemParam } from '@/types/requestTypes';
import _ from 'lodash';

const memoryData = {
  memoryMockConf: {} as any as MockConfigObj,
  memoryMockItemIdAndApiPairList: [] as JsonObj[],
  memoryMockItemAndSceneItemListPair: {} satisfies Record<string, SceneItemBaseInfoType[]>,
  memoryMockItemAndSceneItemConf: {} as any as MemoryMockItemAndSceneItemConfType,  // 这个是给worker线程用，用来获取匹配的参数
  appMockConf: [] as AppMockConfType,
};

export type MemoryDataType = typeof memoryData;

export const getMemoryData = (): MemoryDataType => memoryData;

// 获取mockItem配置数据
export const getMockItemConfData = async ():Promise<[MockConfigObj, JsonObj[]]> => {
  const [mockItemIdAndApiPairList, mockConf] = await initMockConf();
  if(Object.keys(memoryData.memoryMockConf).length === 0) {
    memoryData.memoryMockConf = _.cloneDeep(mockConf);
    memoryData.memoryMockItemIdAndApiPairList = _.cloneDeep(mockItemIdAndApiPairList);
  }
  return [ memoryData.memoryMockConf, memoryData.memoryMockItemIdAndApiPairList ];
};

await getMockItemConfData();

// 获取mock的全量配置（搜索建立在此基础上）
export const getAppMockConf = async (): Promise<any> => {
  await getMockItemConfData();
  const listForWeb = await Promise.all(memoryData.memoryMockItemIdAndApiPairList.map(async (item) => {
    const { apiPath: mockApiPath } = item;
    // 获取mockItem的scene列表的配置
    const scenesConf = await getMockItemSceneListConf(mockApiPath);
    // 获取mockItem的scene文件列表
    const scenesFileList = await getDirSubList(path.join(projectRootDir, 'mock', mockApiPath, 'scenes'), { onlyFile: true });
    // 获取mockItem的基本信息
    const mockItemBaseInfo = await readObjectFromJsonFile(path.join(projectRootDir, 'mock', mockApiPath, 'baseConf.json')) as MockItemBaseInfoType;
    const scenesBaseInfoList = scenesFileList.map(fileName => {
      const sceneId = fileName.replace(/.ts$/, '');
      return { id: sceneId, ...scenesConf[sceneId] };
    });
    const mockItemSelectedSceneId = memoryData.memoryMockConf.api2IdAndCheckedScene[mockApiPath]?.selectedSceneId || '';
    return {
      basicInfo: {
        ...mockItemBaseInfo,
        selectedSceneId: mockItemSelectedSceneId,
      },
      scenesList: scenesBaseInfoList,
    };
  }));

  memoryData.appMockConf = listForWeb;

  listForWeb.forEach((next) => {
    memoryData.memoryMockItemAndSceneItemListPair[next.basicInfo.id] = next.scenesList;
  });

  memoryData.memoryMockItemAndSceneItemConf = listForWeb.reduce((mockItemRes, next) => {
    const { api: apiDirName, type: mockType } = memoryData.memoryMockConf.id2ApiAndType[next.basicInfo.id];
    if (!mockItemRes[mockType]) {
      mockItemRes[mockType] = {};
    }
    mockItemRes[mockType][apiDirName] = next.scenesList.reduce((sceneRes, next) => {
      sceneRes[next.id] = next;
      return sceneRes;
    }, {});
    return mockItemRes;
  }, {});

  return {
    listForWeb,
    memoryMockItemAndSceneItemListPair: memoryData.memoryMockItemAndSceneItemListPair,
    memoryMockItemAndSceneItemConf: memoryData.memoryMockItemAndSceneItemConf,
  };
};

export const getMockItemAndSceneItemConf = async ():Promise<MemoryMockItemAndSceneItemConfType> => {
  await getAppMockConf();
  return memoryData.memoryMockItemAndSceneItemConf;
};

// 保存迭代列表
export const handleSaveIterationList = async (param: string[]): Promise<boolean> => {
  const tmp = await readObjectFromJsonFile(path.join(projectRootDir, 'mock', 'mockConf.json'));
  tmp.iterationList = param;
  return await writeObjectToJsonFile(path.join(projectRootDir, 'mock', 'mockConf.json'), tmp);
};
// 获取迭代列表
export const handleGetIterationList = async (): Promise<string[]> => {
  const tmp = await readObjectFromJsonFile(path.join(projectRootDir, 'mock', 'mockConf.json'));
  return tmp.iterationList || [];
};

// 搜索mockItem
export const handleSearchMockItem = async (param?: any): Promise<AppMockConfType> => {
  await getAppMockConf();
  return memoryData.appMockConf;
};

// 添加或修改mockItem
export const handleAddOrUpdateMockItemConf = async (param: MockItemParam): Promise<any> => {
  const { id, path: mockApiPath, remarks, mockPattern, type: mockRequestType } = param;
  const paths: string[] = mockApiPath.split('/');
  paths[0] === '' && paths.shift();
  paths[paths.length - 1] === '' && paths.pop();
  const apiAlbumPath = paths.length ? paths.join('.') : mockApiPath;

  assert(mockApiPath, 'apiPath is required');
  const originPath = memoryData.memoryMockConf.id2ApiAndType[id]?.api || '';
  // 匹配以下情况则说明是新mockItem或者id对应的apiPath已经发生改变，需要进行mockConf的持久化
  if (originPath !== apiAlbumPath) {
    
    // 如果id存在，且id对应的apiPath不是当前的apiPath，则移动文件
    if (originPath) {
      const whichChange = memoryData.memoryMockItemIdAndApiPairList.findIndex((item) => item.id === id);
      console.log('whichChange', whichChange, param, memoryData.memoryMockItemIdAndApiPairList);
      assert(whichChange !== -1, 'mockItem id not found');
      memoryData.memoryMockItemIdAndApiPairList[whichChange].apiPath = apiAlbumPath;
      await move(path.join(projectRootDir, 'mock', originPath), path.join(projectRootDir, 'mock', apiAlbumPath));
    } else {
      memoryData.memoryMockItemIdAndApiPairList.unshift({ id, apiPath: apiAlbumPath, type: mockRequestType });
    }

    // 更新内存中的mockConf
    const oldConf = memoryData.memoryMockConf.api2IdAndCheckedScene?.[originPath] ?? {};
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete memoryData.memoryMockConf.api2IdAndCheckedScene[originPath];
    memoryData.memoryMockConf.id2ApiAndType[id] = { api: apiAlbumPath, type: mockRequestType };
    memoryData.memoryMockConf.api2IdAndCheckedScene[apiAlbumPath] = { ...oldConf, id, remarks, mockPattern };
    // 当mockConf发生变化时，memoryMockItemIdAndApiPairList也要进行更新
    await writeObjectToJsonFile(path.join(projectRootDir, 'mock', 'mockConf.json'), memoryData.memoryMockConf);
  }
  const res = await writeObjectToJsonFile(path.join(projectRootDir, 'mock', apiAlbumPath, 'baseConf.json'), param);
  assert(res, 'save mockItem failed');
  return true;
};

// 删除mockItem
export const handleDeleteMockItem = async (param: { id: string }): Promise<any> => {
  const { id } = param;
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  delete memoryData.memoryMockConf[id];
  await fse.remove(path.join(projectRootDir, 'mock', memoryData.memoryMockConf.id2ApiAndType[id].api));
  const i = memoryData.memoryMockItemIdAndApiPairList.findIndex((item) => item.id === id);
  i > -1 && memoryData.memoryMockItemIdAndApiPairList.splice(i, 1);
  console.log('some 555555555', memoryData.memoryMockConf);
  await writeObjectToJsonFile(path.join(projectRootDir, 'mock', 'mockConf.json'), memoryData.memoryMockConf);
  return true;
};

// 添加或修改mockItem的scene
export const handleAddOrUpdateSceneItem = async (param: SceneItemParam): Promise<SceneItemBaseInfoType[]> => {
  const { id, name = '新场景', param: sceneReqParam = '{}', responseConf, mockItemId, iteration } = param;
  const { api: apiDirName, type: mockType } = memoryData.memoryMockConf.id2ApiAndType[mockItemId];
  const mockApiPath = memoryData.memoryMockConf.id2ApiAndType[mockItemId].api;
  const scenesConf = await getMockItemSceneListConf(mockApiPath);
  const sceneItemIdAndInfoPairList = memoryData.memoryMockItemAndSceneItemListPair[mockItemId] || [];
  if (!scenesConf[id]) {
    sceneItemIdAndInfoPairList.unshift({ id, name, param: sceneReqParam, iteration });
  }

  if (Object.keys(memoryData.memoryMockItemAndSceneItemConf[mockType] ?? {}).length === 0) {
    memoryData.memoryMockItemAndSceneItemConf[mockType] = {};
  }
  memoryData.memoryMockItemAndSceneItemConf[mockType][apiDirName] = sceneItemIdAndInfoPairList.reduce((tmpRes, next) => {
    tmpRes[next.id] = next;
    return tmpRes;
  }, {});

  scenesConf[id] = { name, param: sceneReqParam, iteration };
  console.log('someiiiiiiiii', memoryData.memoryMockItemAndSceneItemConf, scenesConf, sceneItemIdAndInfoPairList);
  const writeSceneConfRes = await writeObjectToJsonFile(path.join(projectRootDir, 'mock', mockApiPath, 'scenesConf.json'), scenesConf);
  await fse.outputFile(path.join(projectRootDir, 'mock', mockApiPath, 'scenes', `${id}.ts`), responseConf ?? '');
  assert(writeSceneConfRes, 'save sceneItem failed');
  memoryData.memoryMockItemAndSceneItemListPair[mockItemId] = sceneItemIdAndInfoPairList;
  return sceneItemIdAndInfoPairList;
};

// 删除mockItem的scene
export const handleDeleteSceneItem = async (param: { sceneId: string, mockItemId: string }): Promise<SceneItemBaseInfoType[]> => {
  const { mockItemId, sceneId } = param;
  const mockApiPath = memoryData.memoryMockConf.id2ApiAndType[mockItemId].api;
  const sceneItemIdAndInfoPairList = memoryData.memoryMockItemAndSceneItemListPair[mockItemId];
  const scenesConf = await getMockItemSceneListConf(mockApiPath);
  assert(mockApiPath, 'not fond apiPath in dir');
  const writeSceneConfRes = await writeObjectToJsonFile(path.join(projectRootDir, 'mock', mockApiPath, 'scenesConf.json'), scenesConf);
  assert(writeSceneConfRes, 'save sceneItem failed');
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  delete scenesConf[sceneId];
  const i = sceneItemIdAndInfoPairList.findIndex((item) => item.id === sceneId);
  sceneItemIdAndInfoPairList.splice(i, 1);
  await fse.remove(path.join(projectRootDir, 'mock', mockApiPath, 'scenes', `${sceneId}.ts`));
  return sceneItemIdAndInfoPairList;
};

// 获取SceneItem的返回值配置
export const getSceneItemResponseConf = async (param: { mockItemId: string, sceneId: string }): Promise<string> => {
  const { mockItemId, sceneId } = param;
  const apiPath = memoryData.memoryMockConf.id2ApiAndType[mockItemId].api;
  const file = await readLocalFile(path.join(projectRootDir, 'mock', apiPath, 'scenes', `${sceneId}.ts`));
  return file;
};

// 选中mockItem的scene
export const handleSelectSceneItem = async (param: { mockItemId: string, sceneId: string }): Promise<any> => {
  const { mockItemId, sceneId } = param;
  const mockApiPath = memoryData.memoryMockConf.id2ApiAndType[mockItemId].api;
  memoryData.memoryMockConf.api2IdAndCheckedScene[mockApiPath].selectedSceneId = sceneId;
  return await writeObjectToJsonFile(path.join(projectRootDir, 'mock', 'mockConf.json'), memoryData.memoryMockConf);
};