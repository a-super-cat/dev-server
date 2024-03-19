export type JsonObj = Record<string, any>;

export type MockConfigObj = {
  // id对应的apiPath和api类型
  id2ApiAndType: Record<string, string[]>;
  api2Id: JsonObj;
};

/**
 * {
 *  "http": {
 *   "apiPath": {
 *      "sceneItemId": { id: string, name: string, param: string }
 *    }
 *  }
 * }
 */
export type MemoryMockItemAndSceneItemConfType = Record<string, Record<string, Record<string, { id: string, name: string, param: string }>>>;

export type AppMockConfType = Array<{ basicInfo: JsonObj, scenesList: Array<{ id: string, name: string, param: string }> }>;