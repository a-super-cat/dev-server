import ts from 'typescript';
import path from 'node:path';
import fs from 'node:fs';
import assert from 'assert';
import JSON5 from 'json5';
import { projectRootDir, mockDirName } from '@/utils/fileUtils';
import type { MemoryDataType } from '@/server/service/mainService';

const getSceneItemResponseConf = (apiSceneConfObj: any, param: any): string => {
  const requestParamKeys = Object.keys(param || {});
  const sceneScoreList = Object.values(apiSceneConfObj || {}).map((sceneConf: any) => {
    const { param: sceneParam, id } = sceneConf;
    const sceneParamObj = JSON5.parse(sceneParam);
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
  console.log('sceneScoreList', sceneScoreList);
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
    // eslint-disable-next-line no-eval
    const funcFromFile = eval(funcStr);
    const responseData = funcFromFile(param);
    process.send?.({ messageId, data: responseData, mockItemId: currentMatchedMockItem.id, matchedScene: matchedSceneItem?.name, success: true });
  } catch(e) {
    console.log('http worker err: ', e);
    process.send?.({ messageId, data: e.toString(), mockItemId: currentMatchedMockItem?.id, matchedScene: '--', success: false });
  }
});
