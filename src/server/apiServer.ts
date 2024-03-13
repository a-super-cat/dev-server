import { httpApiAndIdPairObj } from '@/utils/requestUtils';
import { mkdir, projectRootDir } from '@/utils/fileUtils';
import { writeObjectToJsonFile } from '@/utils/jsonUtils';
import path from 'node:path';
import { v4 as uuid } from 'uuid';

// http请求的持久化配置路径
const httpApiConf = path.join(projectRootDir, 'mock', 'http', 'httpConf.json');

// 处理mock的http请求
export const handleHttpMockRequest = (orgPath: string):any => {
  const apiPath = orgPath.startsWith('/') ? orgPath.substring(1).replaceAll('/', '.') : orgPath.replaceAll('/', '.');
  if(httpApiAndIdPairObj[apiPath]) {
    // todo
  } else {
    httpApiAndIdPairObj[apiPath] = uuid();
    mkdir(path.join(projectRootDir, 'mock', 'http', apiPath));
    writeObjectToJsonFile(httpApiConf, httpApiAndIdPairObj);
  }
};