import assert from 'assert';
import path from 'node:path';
import fse from 'fs-extra';
import {
  projectRootDir,
  move,
  getDirSubList,
  readLocalFile,
  mockDirName,
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
  mockPatternType,
  apiType,
  requestMethodType,
} from '@/types/basic';
import { type SceneItemParam, type MockItemParam } from '@/types/requestTypes';
import _ from 'lodash';

const memoryData = {
  isCreateMockItemFromRequest: false,
  memoryMockConf: {} as any as MockConfigObj, // 这个有改动的话要写入mockConf.json文件
  memoryMockItemIdAndApiPairList: [] as JsonObj[], // 这个只存在内存中，主要是为了给mockItem进行排序
  memoryMockItemAndSceneItemListPair: {} satisfies Record<string, SceneItemBaseInfoType[]>, // 这个是给web端用的，用来展示mockItem的scene列表
  memoryMockItemAndSceneItemConf: {} as any as MemoryMockItemAndSceneItemConfType,  // 这个是给worker线程用，与上边的区别是会使用接口类型（type）分组用来获取匹配的参数
  appMockConf: [] as AppMockConfType,
  authInfo: {} satisfies Record<string, { authType: string, auth: object | string }>,
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

export const changeIsCreateMockItemFromRequestStatus = (): boolean => {
  memoryData.isCreateMockItemFromRequest = !memoryData.isCreateMockItemFromRequest;
  return memoryData.isCreateMockItemFromRequest;
};

export const getFlagForIsCreateMockItemFromRequest = (): boolean => memoryData.isCreateMockItemFromRequest;

// 获取mock的全量配置（搜索建立在此基础上）
export const getAppMockConf = async (): Promise<any> => {
  await getMockItemConfData();
  const listForWeb = await Promise.all(memoryData.memoryMockItemIdAndApiPairList.map(async (item) => {
    const { apiPath: mockApiPath } = item;
    // 获取mockItem的scene列表的配置
    const scenesConf = await getMockItemSceneListConf(mockApiPath);
    // 获取mockItem的scene文件列表
    const scenesFileList = await getDirSubList(path.join(projectRootDir, mockDirName, mockApiPath, 'scenes'), { onlyFile: true });
    // 获取mockItem的基本信息
    const mockItemBaseInfo = await readObjectFromJsonFile(path.join(projectRootDir, mockDirName, mockApiPath, 'baseConf.json')) as MockItemBaseInfoType;
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
  const tmp = await readObjectFromJsonFile(path.join(projectRootDir, mockDirName, 'mockConf.json'));
  tmp.iterationList = param;
  return await writeObjectToJsonFile(path.join(projectRootDir, mockDirName, 'mockConf.json'), tmp);
};
// 获取迭代列表
export const handleGetIterationList = async (): Promise<string[]> => {
  const tmp = await readObjectFromJsonFile(path.join(projectRootDir, mockDirName, 'mockConf.json'));
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
    // 当mockConf发生变化时，memoryMockItemIdAndApiPairList也要进行更新
    if (originPath) {
      const whichChange = memoryData.memoryMockItemIdAndApiPairList.findIndex((item) => item.id === id);
      console.log('whichChange', whichChange, param, memoryData.memoryMockItemIdAndApiPairList);
      assert(whichChange !== -1, 'mockItem id not found');
      memoryData.memoryMockItemIdAndApiPairList[whichChange].apiPath = apiAlbumPath;
      await move(path.join(projectRootDir, mockDirName, originPath), path.join(projectRootDir, mockDirName, apiAlbumPath));
    } else {
      memoryData.memoryMockItemIdAndApiPairList.unshift({ id, apiPath: apiAlbumPath, type: mockRequestType });
    }

    // 更新内存中的mockConf
    const oldConf = memoryData.memoryMockConf.api2IdAndCheckedScene?.[originPath] ?? {};
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete memoryData.memoryMockConf.api2IdAndCheckedScene[originPath];
    memoryData.memoryMockConf.id2ApiAndType[id] = { api: apiAlbumPath, type: mockRequestType };
    memoryData.memoryMockConf.api2IdAndCheckedScene[apiAlbumPath] = { ...oldConf, id, remarks, mockPattern };
    
    await writeObjectToJsonFile(path.join(projectRootDir, mockDirName, 'mockConf.json'), memoryData.memoryMockConf);
  } else {
    // 否则只是更新内容并持久化
    memoryData.memoryMockConf.id2ApiAndType[id].type = mockRequestType;
    memoryData.memoryMockConf.api2IdAndCheckedScene[originPath] = {
      ...memoryData.memoryMockConf.api2IdAndCheckedScene[originPath],
      id, remarks, mockPattern,
    };
    await writeObjectToJsonFile(path.join(projectRootDir, mockDirName, 'mockConf.json'), memoryData.memoryMockConf);
  }

  const res = await writeObjectToJsonFile(path.join(projectRootDir, mockDirName, apiAlbumPath, 'baseConf.json'), param);
  assert(res, 'save mockItem failed');
  return true;
};

// 删除mockItem
export const handleDeleteMockItem = async (param: { id: string }): Promise<any> => {
  const { id } = param;
  const apiDirName = memoryData.memoryMockConf.id2ApiAndType[id].api;
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  delete memoryData.memoryMockConf.api2IdAndCheckedScene[apiDirName];
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  delete memoryData.memoryMockConf.id2ApiAndType[id];
  await fse.remove(path.join(projectRootDir, mockDirName, apiDirName));
  const i = memoryData.memoryMockItemIdAndApiPairList.findIndex((item) => item.id === id);
  i > -1 && memoryData.memoryMockItemIdAndApiPairList.splice(i, 1);
  await writeObjectToJsonFile(path.join(projectRootDir, mockDirName, 'mockConf.json'), memoryData.memoryMockConf);
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
  const writeSceneConfRes = await writeObjectToJsonFile(path.join(projectRootDir, mockDirName, mockApiPath, 'scenesConf.json'), scenesConf);
  await fse.outputFile(path.join(projectRootDir, mockDirName, mockApiPath, 'scenes', `${id}.ts`), responseConf ?? '');
  assert(writeSceneConfRes, 'save sceneItem failed');
  memoryData.memoryMockItemAndSceneItemListPair[mockItemId] = sceneItemIdAndInfoPairList;
  return sceneItemIdAndInfoPairList;
};

// 删除mockItem的scene
export const handleDeleteSceneItem = async (param: { sceneId: string, mockItemId: string }): Promise<SceneItemBaseInfoType[]> => {
  const { mockItemId, sceneId } = param;
  const { api: apiDirName, type: mockType } = memoryData.memoryMockConf.id2ApiAndType[mockItemId];
  const sceneItemIdAndInfoPairList = memoryData.memoryMockItemAndSceneItemListPair[mockItemId];
  assert(apiDirName, 'not fond apiPath in dir');
  const scenesConf = await getMockItemSceneListConf(apiDirName);
  // 删除scenesConf.json中该条记录
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  delete scenesConf[sceneId];
  const i = sceneItemIdAndInfoPairList.findIndex((item) => item.id === sceneId);
  sceneItemIdAndInfoPairList.splice(i, 1);
  // 同步修改到memoryData
  memoryData.memoryMockItemAndSceneItemListPair[mockItemId] = sceneItemIdAndInfoPairList;
  // 删除返回值的配置文件
  await fse.remove(path.join(projectRootDir, mockDirName, apiDirName, 'scenes', `${sceneId}.ts`));
  // 将对scenesConf.json的修改写入文件
  const writeSceneConfRes = await writeObjectToJsonFile(path.join(projectRootDir, mockDirName, apiDirName, 'scenesConf.json'), scenesConf);
  assert(writeSceneConfRes, 'delete sceneItem failed');

  // 检查该mockItem当前被选中的sceneId是不是被删除掉的sceneId， 如果是的话也修改mockConf.json文件
  const mockItemApi = memoryData.memoryMockConf.id2ApiAndType[mockItemId].api;
  if (sceneId === memoryData.memoryMockConf.api2IdAndCheckedScene[mockItemApi].selectedSceneId) {
    memoryData.memoryMockConf.api2IdAndCheckedScene[apiDirName].selectedSceneId = '';
    await writeObjectToJsonFile(path.join(projectRootDir, mockDirName, 'mockConf.json'), memoryData.memoryMockConf);
  }
  // 更新给worker线程使用的数据
  if (Object.keys(memoryData.memoryMockItemAndSceneItemConf[mockType] ?? {}).length === 0) {
    memoryData.memoryMockItemAndSceneItemConf[mockType] = {};
  }
  memoryData.memoryMockItemAndSceneItemConf[mockType][apiDirName] = sceneItemIdAndInfoPairList.reduce((tmpRes, next) => {
    tmpRes[next.id] = next;
    return tmpRes;
  }, {});
  return sceneItemIdAndInfoPairList;
};

// 获取SceneItem的返回值配置
export const getSceneItemResponseConf = async (param: { mockItemId: string, sceneId: string }): Promise<string> => {
  const { mockItemId, sceneId } = param;
  const apiPath = memoryData.memoryMockConf.id2ApiAndType[mockItemId].api;
  const file = await readLocalFile(path.join(projectRootDir, mockDirName, apiPath, 'scenes', `${sceneId}.ts`));
  return file;
};

// 选中mockItem的scene
export const handleSelectSceneItem = async (param: { mockItemId: string, sceneId: string }): Promise<any> => {
  const { mockItemId, sceneId } = param;
  const mockApiPath = memoryData.memoryMockConf.id2ApiAndType[mockItemId].api;
  memoryData.memoryMockConf.api2IdAndCheckedScene[mockApiPath].selectedSceneId = sceneId;
  return await writeObjectToJsonFile(path.join(projectRootDir, mockDirName, 'mockConf.json'), memoryData.memoryMockConf);
};

export const createMockItemAndSceneItemFromProxy = (param: {
  mockItem: { id: string, apiPath: string, mockPattern?: mockPatternType, type: apiType, requestMethod?: requestMethodType },
  sceneItem: { id: string, name: string, param: string }
}, cb?: () => void): void => {
  const { mockItem, sceneItem } = param;
  assert(mockItem.id, 'mockItem id is required');
  const { id: mockItemId, apiPath, mockPattern, type, requestMethod } = mockItem;
  const { id: sceneId, name, param: sceneParam } = sceneItem;
  // 处理mockItem不存在的情况
  if(!memoryData.memoryMockConf.id2ApiAndType[mockItem.id]) {
    const mockItemDir = apiPath.split('/').filter(Boolean).join('.');
    memoryData.memoryMockItemIdAndApiPairList.unshift({ id: mockItemId, apiPath: mockItemDir, type });
    memoryData.memoryMockConf.id2ApiAndType[mockItemId] = { api: mockItemDir, type };
    memoryData.memoryMockConf.api2IdAndCheckedScene[mockItemDir] = { id: mockItemId, mockPattern: mockPattern ?? 'mock', selectedSceneId: sceneId };
    writeObjectToJsonFile(path.join(projectRootDir, mockDirName, 'mockConf.json'), memoryData.memoryMockConf).catch(console.log);
    writeObjectToJsonFile(path.join(projectRootDir, mockDirName, mockItemDir, 'baseConf.json'), 
      { id: mockItemId, path: apiPath, name: "From Request", type, requestMethod: requestMethod ?? 'GET', mockPattern: mockPattern ?? 'mock' }).catch(console.log);
  }
  // 处理SceneItem,这个方法里都是新建sceneItem，所以不需要判断是否存在
  const dirForMockItem = memoryData.memoryMockConf.id2ApiAndType[mockItem.id].api;

  memoryData.memoryMockItemAndSceneItemListPair[mockItemId] ? 
    memoryData.memoryMockItemAndSceneItemListPair[mockItemId].unshift({ id: sceneId, name, param: sceneParam }) : 
    memoryData.memoryMockItemAndSceneItemListPair[mockItemId] = [{ id: sceneId, name, param: sceneParam }];
  _.set(memoryData.memoryMockItemAndSceneItemConf, `${type}.${dirForMockItem}`, memoryData.memoryMockItemAndSceneItemListPair[mockItemId].reduce((tmpRes: any, next: any) => {
    tmpRes[next.id] = next;
    return tmpRes;
  }, {}));

  const scenesConf = memoryData.memoryMockItemAndSceneItemListPair[mockItemId].reduce((tmpRes: any, next: any) => {
    tmpRes[next.id] = { name: next.name, param: next.param };
    return tmpRes;
  }, {});
  writeObjectToJsonFile(path.join(projectRootDir, mockDirName, dirForMockItem, 'scenesConf.json'), scenesConf).catch(console.log);

  memoryData.appMockConf = memoryData.memoryMockItemIdAndApiPairList.map((item) => {
    const { apiPath: mockApiPath } = item;
    const scenesBaseInfoList = memoryData.memoryMockItemAndSceneItemListPair[item.id].map((next) => {
      return { id: next.id, ...scenesConf[next.id] };
    });
    const mockItemBaseInfo = { id: item.id, ...memoryData.memoryMockConf.id2ApiAndType[item.id] };
    const mockItemSelectedSceneId = memoryData.memoryMockConf.api2IdAndCheckedScene[mockApiPath]?.selectedSceneId || '';
    return {
      basicInfo: {
        ...mockItemBaseInfo,
        selectedSceneId: mockItemSelectedSceneId,
      },
      scenesList: scenesBaseInfoList,
    };
  });
  cb && cb();
};

// 设置授权信息
export const setAuthInfo = (param: { prefix: string, authType: string, auth: object | string }): void => {
  const { prefix, authType, auth } = param;
  memoryData.authInfo[prefix] = { authType, auth };
};