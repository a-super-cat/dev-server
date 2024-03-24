import { 
  readLocalFile, 
  isFileExist,
  devServerRootDir,
} from '@/utils/fileUtils';
import type { ServerResponse, IncomingMessage } from 'http';
import path from 'node:path';
import mime from 'mime';

// 将请求映射到目录src/web文件夹下的文件 例如：/web/index.html -> src/web/index.html
const handleStaticResourceRequest = async (apiPath: string, res: ServerResponse<IncomingMessage>):Promise<void> => {
  const filePath = apiPath.replace(/^\/?mock-web\//, '');
  const paths = filePath.split('/');
  let data: any = null;
  if(isFileExist(path.join(devServerRootDir, 'web', ...paths))) {
    data = await readLocalFile(path.join(devServerRootDir, 'web', ...paths));
  } else {
    data = await readLocalFile(path.join(devServerRootDir, 'web', 'index.html'));
  }
  if(data) {
    res.setHeader('Content-Type', mime.getType(apiPath) ?? 'text/html;charset=utf-8');
    res.write(data);
    res.statusCode = 200;
    res.end();
  }
};

// 处理web页面请求
export const handleWebRequest = (apiPath: string, res):void => {
  handleStaticResourceRequest(apiPath, res).catch((err) => {
    console.error(err);
    res.statusCode = 404;
    res.end('Not Found');
  });
};