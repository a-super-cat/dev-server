import type { ServerResponse, IncomingMessage } from 'http';

export const handleSystemRequest = (apiPath: string, requestData: any, res: ServerResponse<IncomingMessage>):any => {
  console.log('handleSystemRequest', apiPath, requestData);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.write('hello world');
  res.statusCode = 200;
  res.end();
};