import jsonFile from 'jsonfile';
import type { JsonObj } from '@/types/basic';
import type { JFWriteOptions } from 'jsonfile';
import { touchFile } from '@/utils/fileUtils';

// 从json文件中读取对象 
export const readObjectFromJsonFile = (filePath): JsonObj => {
  touchFile(filePath, '{}');
  return jsonFile.readFileSync(filePath) || {};
};

// 将对象写入json文件
export const writeObjectToJsonFile = (filePath, obj, option: JFWriteOptions = { spaces: 2 }):boolean => {
  touchFile(filePath, '{}');
  jsonFile.writeFileSync(filePath, obj, option);
  return true;
};