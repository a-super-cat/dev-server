import jsonFile from 'jsonfile';
import { 
  touchFile,
  getMockApiSubDirList,
  isDirectory,
  projectRootDir,
} from '@/utils/fileUtils';
import type { MockConfigObj, JsonObj } from '@/types/basic';
import type { JFWriteOptions } from 'jsonfile';
import type { RequestItemLocalConf } from '@/types/requestTypes';
import path from 'path';
import { v4 as uuid } from 'uuid';

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

// 初始化 请求的配置(api和id的对应关系)
export const initExistedRequests = async (serverType = 'http'):Promise<[RequestItemLocalConf[], MockConfigObj]> => {
  let isNeedStoreApiConf = false;
  const configPath = path.join(projectRootDir, 'mock', serverType, 'mockConf.json');
  const httpMockConf = await readObjectFromJsonFile(configPath) as MockConfigObj;
  if(Object.keys(httpMockConf).length === 0) {
    httpMockConf.id2Api = {};
    httpMockConf.api2Id = {};
  }
  const mockApiDirList = await getMockApiSubDirList(serverType);
  const apiAndIdPair = mockApiDirList
    .filter(orgPath => isDirectory(path.join(projectRootDir, 'mock', serverType, orgPath)))
    .map(apiPath => {
      if(httpMockConf.api2Id[apiPath]) {
        return { apiPath, uuid: httpMockConf.api2Id[apiPath] };
      } else {
        isNeedStoreApiConf = true;
        const apiId = uuid();
        httpMockConf.api2Id[apiPath] = apiId;
        httpMockConf.id2Api[apiId] = apiPath;
        return { apiPath, uuid: apiId };
      }
    });

  if(isNeedStoreApiConf) {
    await writeObjectToJsonFile(configPath, httpMockConf);
  }
  isNeedStoreApiConf = false;
  return [apiAndIdPair, httpMockConf];
};


export const httpMockConf = initExistedRequests('http');
export const rpcMockConf = initExistedRequests('rpc');