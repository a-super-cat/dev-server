import { type mockPatternList, type apiTypeList, type requestMethodList } from '@/utils/constants';

type apiType = typeof apiTypeList[number];
type mockPatternType = typeof mockPatternList[number];
type requestMethodType = typeof requestMethodList[number];

export type MockItemBaseInfoType = {
  id: string;
  path: string;
  name: string;
  remarks: string;
  requestMethod: requestMethodType;
  mockPattern: mockPatternType;
  selectedSceneId: string;
};

export type SceneItemBaseInfoType = { id: string, name: string, param: string, iteration?: string };

export type JsonObj = Record<string, any>;

export type MockConfigObj = {
  // id对应的apiPath和api类型
  id2ApiAndType: Record<string, { api: string, type: apiType }>;
  api2IdAndCheckedScene: Record<string, { id: string, selectedSceneId: string, mockPattern: mockPatternType, remarks?: string }>;
};

export type MemoryMockItemAndSceneItemConfType = Record<string, Record<string, Record<string, SceneItemBaseInfoType>>>;
// 这个是返回给前端的mockItem列表的数据结构
export type AppMockConfType = Array<{ basicInfo: JsonObj, scenesList: SceneItemBaseInfoType[] }>;