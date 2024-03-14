export type JsonObj = Record<string, any>;

export type MockConfigObj = {
  // id对应的apiPath和api类型
  id2ApiAndType: Record<string, string[]>;
  api2Id: JsonObj;
};