import fs from 'node:fs';
import fse from 'fs-extra';
import { open, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 项目根路径
export let projectRootDir: string = '';

// 获取项目根路径
export const findProjectRootDir = (dir = fileURLToPath(import.meta.url)):string => {
  let tmpPath: string = dir;

  while(!fse.pathExistsSync(path.join(tmpPath, 'package.json'))) {
    tmpPath = path.normalize(`${tmpPath}../`);
  }

  projectRootDir = tmpPath;
  return projectRootDir;
};

// 初始化项目根路径
findProjectRootDir();

// ---------------------文件操作-----------------------
// 判断文件是否存在
export const isFileExist = (path):boolean => {
  try {
    const state = fs.statSync(path);
    return state.isFile();
  } catch (err) {
    return false;
  }
};


// ---------------------目录操作-----------------------
// 获取目标目录下的所有一级目录
export const getMockApiDirList = async (dirPath: string):Promise<any[]> => {
  let apiDirList:string[] = [];
  try {
    apiDirList = await readdir(dirPath);
  } catch {
    await fse.ensureDir(dirPath);
  }
  return apiDirList;
};

// 获取不同类型server对应的mock文件夹列表
export const getMockApiSubDirList = async (serverType = 'http'): Promise<string[]> => {
  const dirList = await getMockApiDirList(path.join(projectRootDir, 'mock', serverType));
  return dirList;
};

// 如果文件不存在则创建文件
export const touchFile = async (filePath: string):Promise<void> => {
  await fse.ensureFile(filePath);
};

// 判断一个路径是不是文件夹
export const isDirectory = (path):boolean => {
  try {
    const res = fs.statSync(path);
    return res.isDirectory();
  } catch {
    return false;
  }
};

// 创建文件夹
export const mkdir = async (path: string):Promise<boolean> => {
  try {
    await fse.ensureDir(path);
    return true;
  } catch {
    return false;
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

// 移动、目录重命名
export const move = async (oldPath: string, newPath: string):Promise<boolean> => {
  try {
    await fse.move(oldPath, newPath);
    return true;
  } catch {
    return false;
  }
};

