export type RequestItemLocalConf = {
  id: string;
  apiPath: string,
  type: string | 'http' | 'rpc',
};

export type MockItemParam = {
  id: string;
  path: string;
  [k: string]: any;
};

export type SceneItemParam = {
  id: string;
  name?: string;
  param?: string;
  responseConf?: string;
  mockItemId: string;
};