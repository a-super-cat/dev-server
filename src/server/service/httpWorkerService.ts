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
  const { mockItemDir, purifiedFormattedPath, param, messageId } = arg;
  const { memoryMockConf: mockConf, memoryMockItemAndSceneItemConf, memoryMockItemAndSceneItemListPair } = memoryData;

  const currentMatchedMockItem = mockConf.api2IdAndCheckedScene[mockItemDir];
  try {
    assert(currentMatchedMockItem, 'apiPath not found');
    const sceneId = currentMatchedMockItem.selectedSceneId;
    let selectedSceneId = sceneId;
    if(!sceneId) {
      selectedSceneId = getSceneItemResponseConf(memoryMockItemAndSceneItemConf?.HTTP?.[mockItemDir], param);
    }
    assert(selectedSceneId, 'scene not found');
    const matchedSceneItem = memoryMockItemAndSceneItemListPair?.[currentMatchedMockItem.id]?.find(item => item.id === selectedSceneId);

    const filePath = path.join(projectRootDir, mockDirName, mockItemDir, 'scenes', `${selectedSceneId}.ts`);
    const res = ts.transpileModule(fs.readFileSync(filePath, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ESNext,
      },
    });
    try {
      const requestPathItems: string[] = purifiedFormattedPath.split('.');
      const mockPathItems = mockItemDir.split('.');
      mockPathItems.shift();
      const pathParamsIndex: number[] = [];
      mockPathItems.forEach((item, index) => {
        if(item.startsWith('__')) {
          pathParamsIndex.push(index);
        }
      });
      const pathParams = pathParamsIndex.reduce<string[]>((rs, index) => {
        rs.push(requestPathItems[index]);
        return rs;
      }, []);
      const context = { exports: {}, pathParams } as any;
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
