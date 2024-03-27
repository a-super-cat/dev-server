import {
  getAppMockConf,
  handleAddOrUpdateMockItemConf,
  handleDeleteMockItem,
  handleAddOrUpdateSceneItem,
  handleDeleteSceneItem,
  getSceneItemResponseConf,
  handleSelectSceneItem,
  handleSaveIterationList,
  handleGetIterationList,
  changeIsCreateMockItemFromRequestStatus,
  getFlagForIsCreateMockItemFromRequest,
} from '@/server/service/mainService';
import type { ServerResponse, IncomingMessage } from 'http';
import type { AppMockConfType } from '@/types/basic';

// 搜索用的分页信息
const pageInfo = {
  current: 1,
  size: 10,
  total: 0,
};

// 搜索条件
const searchParam = {
  searchText: '',
  iteration: '',
};


// 搜索mockItem
const handleSearch = async (param: any):Promise<any> => {
  const { current, size, searchText, iteration } = param || {};
  pageInfo.current = current || 1;
  pageInfo.size = size || 10;
  searchParam.searchText = searchText || '';
  searchParam.iteration = iteration || '';
  const { listForWeb }: { listForWeb: AppMockConfType } = await getAppMockConf();

  const filteredList = listForWeb
    .filter(item => !searchText || item.basicInfo.name.includes(searchText) || item.basicInfo.path.includes(searchText) || item.basicInfo.remarks.includes(searchText))
    .map(item => ({ basicInfo: item.basicInfo, scenesList: iteration ? item.scenesList.filter(scene => scene.iteration === iteration) : item.scenesList }));

  pageInfo.total = filteredList.length;
  const res = filteredList.slice((pageInfo.current - 1) * pageInfo.size, pageInfo.current * pageInfo.size);
  return {
    list: res,
    pageInfo,
  };
};

const handleMockItemOperation = async (operation: string, param: any):Promise<any> => {
  switch (operation) {
    case 'list':
      return await handleSearch(param);
    case 'save':
      return await handleAddOrUpdateMockItemConf(param);
    case 'delete':
      return await handleDeleteMockItem(param);
  }
};

const handleSceneItemOperation = async (operation: string, param: any):Promise<any> => {
  switch (operation) {
    case 'save':
    {
      const res = await handleAddOrUpdateSceneItem(param);
      return res.filter(item => !searchParam.iteration || item.iteration === searchParam.iteration);
    }
    case 'one':
      return await getSceneItemResponseConf(param);
    case 'delete':
    {
      const res = await handleDeleteSceneItem(param);
      return res.filter(item => !searchParam.iteration || item.iteration === searchParam.iteration);
    }
    case 'select':
      return await handleSelectSceneItem(param);
  }
};

// 分发请求
const dispatchRequest = async (apiPath: string, param: any):Promise<any> => {
  switch (apiPath) {
    // 是否从请求中创建mockItem
    case '/mock-system/isCreateMockItemFromRequest':
      return changeIsCreateMockItemFromRequestStatus();
    case '/mock-system/flagForIsCreateMockItemFromRequest':
      return getFlagForIsCreateMockItemFromRequest();
    // 搜索mockItem
    case '/mock-system/search':
      return await handleSearch(param);
    // 迭代期操作
    case '/mock-system/saveIterationList':
      return await handleSaveIterationList(param);
    case '/mock-system/getIterationList':
      return await handleGetIterationList();
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
    case '/mock-system/selectSceneItem':
      return await handleSceneItemOperation('select', param);
  }
};


export const handleSystemRequest = (apiPath: string, requestData: any, res: ServerResponse<IncomingMessage>):any => {
  dispatchRequest(apiPath, requestData).then((data) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.write(JSON.stringify({ code: 200, data, msg: 'success' }));
    res.statusCode = 200;
    res.end();
  }).catch((err) => {
    console.log('handleSystemRequest error:', apiPath, err);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.write(JSON.stringify({ code: 500, msg: 'error', data: err }));
    res.statusCode = 500;
    res.end();
  });
  
};