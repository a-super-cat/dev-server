import ts from 'typescript';
import path from 'node:path';
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'assert';
import JSON5 from 'json5';
import { projectRootDir, mockDirName } from '@/utils/fileUtils';
import type { MemoryDataType } from '@/server/service/mainService';

const getSceneItemResponseConf = (apiSceneConfObj: any, param: any): string => {
  const requestParamKeys = Object.keys(param || {});
  assert(Object.values(apiSceneConfObj ?? {}).length > 0, 'this api does not has any scene');
  const sceneScoreList = Object.values(apiSceneConfObj || {}).map((sceneConf: any) => {
    const { param: sceneParam, id } = sceneConf;
    const sceneParamObj = JSON5.parse(sceneParam ?? '{}');
    let score = 0;
    requestParamKeys.forEach(key => {
      if(sceneParamObj[key]) {
        score++;
        // eslint-disable-next-line eqeqeq
        if(sceneParamObj[key] == param[key]) {
          score++;
        }
      }
    });
    return { id, score };
  }).sort((a, b) => b.score - a.score);
  return sceneScoreList[0].id || '';
};

process.on('message', ({ arg, memoryData } : { arg: any, memoryData: MemoryDataType }) => {
  const { apiPath, param, messageId } = arg;
  const { memoryMockConf: mockConf, memoryMockItemAndSceneItemConf, memoryMockItemAndSceneItemListPair } = memoryData;

  const currentMatchedMockItem = mockConf.api2IdAndCheckedScene[apiPath];
  try {
    assert(currentMatchedMockItem, 'apiPath not found');
    const sceneId = currentMatchedMockItem.selectedSceneId;
    let selectedSceneId = sceneId;
    if(!sceneId) {
      selectedSceneId = getSceneItemResponseConf(memoryMockItemAndSceneItemConf?.HTTP?.[apiPath], param);
    }
    assert(selectedSceneId, 'scene not found');
    const matchedSceneItem = memoryMockItemAndSceneItemListPair?.[currentMatchedMockItem.id]?.find(item => item.id === selectedSceneId);

    // const requestResponseConfFile = 
    const filePath = path.join(projectRootDir, mockDirName, apiPath, 'scenes', `${selectedSceneId}.ts`);
    const res = ts.transpileModule(fs.readFileSync(filePath, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ESNext,
      },
    });
    try {
      const context = { exports: {} } as any;
      vm.createContext(context);
      vm.runInContext(res.outputText, context);
      const responseData = context.exports.default(param);
      process.send?.({ messageId, data: responseData, mockItemId: currentMatchedMockItem.id, matchedScene: matchedSceneItem?.name, success: true });
    } catch (error) {
      console.log('run response file error: ', error);
    }
  } catch(e) {
    console.log('http worker err: ', e);
    process.send?.({ messageId, data: e.toString(), mockItemId: currentMatchedMockItem?.id, matchedScene: '--', success: false });
  }
});
