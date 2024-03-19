import path from 'node:path';
import fs from 'node:fs';
import ts from 'typescript';
import {
  projectRootDir,
} from '@/utils/fileUtils';
import {
  handleSearchMockItem,
  handleAddOrUpdateMockItemConf,
  handleDeleteMockItem,
  handleAddOrUpdateSceneItem,
  handleDeleteSceneItem,
  getSceneItemResponseConf,
} from '@/server/service/mainService';
import type { ServerResponse, IncomingMessage } from 'http';

// 搜索mockItem
const handleSearch = async (param: any):Promise<any> => {
  const filePath = path.join(projectRootDir, 'mock', 'api.test.v1', 'scenes', 'b45b9d3a-1850-45ab-b1f5-82f0976e4ac0.ts');
  const res = ts.transpileModule(fs.readFileSync(filePath, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES5,
    },
  });
  const parsedText = res.outputText;
  let funcStr = '';
  if(parsedText.includes('export default')) {
    funcStr = parsedText.replace('export default', '');
  } else {
    funcStr = `(${parsedText})`;
  }
  console.log('origin: ', parsedText);
  console.log('some111111', funcStr);
  const funcFromFile = eval(funcStr);
  const responseData = funcFromFile({name: 'niupi', age: 20});
  return responseData;
  // const script = new vm.Script(res.outputText, { filename: path.basename(filePath) });

};

const handleMockItemOperation = async (operation: string, param: any):Promise<any> => {
  switch (operation) {
    case 'list':
      return await handleSearchMockItem();
    case 'save':
      return await handleAddOrUpdateMockItemConf(param);
    case 'delete':
      return await handleDeleteMockItem(param);
  }
};

const handleSceneItemOperation = async (operation: string, param: any):Promise<any> => {
  switch (operation) {
    case 'save':
      return await handleAddOrUpdateSceneItem(param);
    case 'one':
      return await getSceneItemResponseConf(param);
    case 'delete':
      return await handleDeleteSceneItem(param);
  }
};

// 分发请求
const dispatchRequest = async (apiPath: string, param: any):Promise<any> => {
  try {
    switch (apiPath) {
      // 搜索mockItem
      case '/mock-system/search':
        return await handleSearch(param);
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
    throw err;
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