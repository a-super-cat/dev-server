import jsonFile from 'jsonfile';
import { 
  touchFile,
  getMockApiSubDirList,
  projectRootDir,
  mockDirName,
} from '@/utils/fileUtils';
import type { MockConfigObj, JsonObj } from '@/types/basic';
import type { JFWriteOptions } from 'jsonfile';
import type { RequestItemLocalConf } from '@/types/requestTypes';
import path from 'path';

// 从json文件中读取对象 
export const readObjectFromJsonFile = async (filePath: string): Promise<JsonObj> => {
  await touchFile(filePath);
  try {
    return jsonFile.readFileSync(filePath) || {};
  } catch {
    return {};
  }
};

// 将对象写入json文件
export const writeObjectToJsonFile = async (filePath: string, obj: any, option: JFWriteOptions = { spaces: 2 }):Promise<boolean> => {
  try {
    await touchFile(filePath);
    jsonFile.writeFileSync(filePath, obj, option);
    return true;
  } catch {
    return false;
  }
};

// 初始化 请求的配置(api和id以及api类型的对应关系)
export const initMockConf = async ():Promise<[RequestItemLocalConf[], MockConfigObj]> => {
  const configPath = path.join(projectRootDir, mockDirName, 'mockConf.json');
  const mockConf = await readObjectFromJsonFile(configPath) as MockConfigObj;
  if(Object.keys(mockConf).length === 0) {
    mockConf.id2ApiAndType = {};
    mockConf.api2IdAndCheckedScene = {};
  }
  const mockApiDirList = await getMockApiSubDirList();

  const apiAndIdPair = [] as RequestItemLocalConf[];
  mockApiDirList.forEach(apiPath => {
    if(mockConf.api2IdAndCheckedScene[apiPath].id) {
      apiAndIdPair.push({ apiPath, id: mockConf.api2IdAndCheckedScene?.[apiPath]?.id, type: mockConf.id2ApiAndType[mockConf.api2IdAndCheckedScene[apiPath].id][1] });
    } else {
      throw new Error(`${apiPath} not register in mockConf.json`);
    }
  });

  return [apiAndIdPair, mockConf];
};

// 获取具体mockItem项的scene列表的配置（key为sceneId，value为对象包含scene的名称及参数）
export const getMockItemSceneListConf = async (apiPath: string ): Promise<JsonObj> => {
  return await readObjectFromJsonFile(path.join(projectRootDir, mockDirName, apiPath, 'scenesConf.json'));
};