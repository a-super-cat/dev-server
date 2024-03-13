import fs from 'node:fs';
import { open } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// http的mock接口列表
export let httpMockApiDirList: string[] = [];
// rpc的mock接口列表
export let rpcMockApiDirList: string[] = [];
// 项目根路径
export let projectRootDir: string = '';

// 获取项目根路径
export const findProjectRootDir = (dir = fileURLToPath(import.meta.url)):string => {
  let tmpPath: string = dir;

  while(!fs.existsSync(path.join(tmpPath, 'package.json'))) {
    tmpPath = path.normalize(`${tmpPath}../`);
  }

  projectRootDir = tmpPath;
  return projectRootDir;
};

// 初始化项目根路径
findProjectRootDir();

const httpMockApiDirPath = path.join(projectRootDir, 'mock', 'http');
const rpcMockApiDirPath = path.join(projectRootDir, 'mock', 'rpc');

// 获取目标目录下的所有一级目录
export const getMockApiDirList = (dirPath):any[] => {
  let apiDirList:string[] = [];
  apiDirList = fs.readdirSync(dirPath);
  return apiDirList;
};

// 获取http api对应的文件夹列表
export const getHttpMockApiDirList = (): string[] => {
  httpMockApiDirList = getMockApiDirList(httpMockApiDirPath);
  return httpMockApiDirList;
};

// 获取rpc api对应的文件夹列表
export const getRpcMockApiDirList = (): string[] => {
  rpcMockApiDirList = getMockApiDirList(rpcMockApiDirPath);
  return rpcMockApiDirList;
};

// 如果文件不存在则创建文件，可以配置初始化内容
export const touchFile = (filePath, initContent = ''):void => {
  try {
    fs.accessSync(filePath);
  } catch (err) {
    if(err.code === 'ENOENT') {
      fs.writeFileSync(filePath, initContent, { encoding: 'utf-8' });
    }
  }
};

// 判断一个路径是不是文件夹
export const isDirectory = (path):boolean => {
  const res = fs.statSync(path);
  return res.isDirectory();
};

// 判断文件是否存在
export const isFileExist = (path):boolean => {
  try {
    const state = fs.statSync(path);
    return state.isFile();
  } catch (err) {
    return false;
  }

};

// 创建文件夹
export const mkdir = (path):boolean => {
  try{
    fs.mkdirSync(path);
    return true;
  } catch (err) {
    if (err.code === 'EEXIST') {
      return true;
    } else {
      console.log(`创建文件夹：${path}失败，错误信息：`, err);
      return false;
    }
  }
};

// 读取文件内容
export const readLocalFile = async (path, resFormatte = 'string'): Promise<string> => {
  try {
    const localFile = await open(path);
    const res = await localFile.readFile();
    await localFile.close();
    return res.toString();
  } catch (err) {
    console.log(`读取文件：${path}失败，错误信息：`, err);
    return '';
  }
};

// 初始化http的mock列表
getHttpMockApiDirList();
// 初始化rpc的mock列表
getRpcMockApiDirList();

