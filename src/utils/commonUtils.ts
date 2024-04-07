import type { IncomingMessage } from 'http';
import formidable from 'formidable';

export const asyncFilter = async <T>(arr: T[], predicate: (arg: T) => Promise<boolean>): Promise<T[]>=> {
  const result: T[] = [];
  for (const item of arr) {
    if (await predicate(item)) {
      result.push(item);
    }
  }
  return result;
};

// 格式化参数（主要是字符串数字转为数字类型）
export const formatParams = (params: Record<string, any>): Record<string, any> => {
  const result = params || {};
  return Object.keys(result || {}).reduce((rsObj, key) => {
    if( typeof result[key] === 'string' && !Number.isNaN(parseFloat(result[key])) && `${parseFloat(result[key])}`.length === result[key].length) {
      rsObj[key] = parseFloat(result[key]);
    } else {
      if (typeof result[key] === 'object') {
        rsObj[key] = formatParams(result[key]);
      } else {
        rsObj[key] = result[key];
      }
    }
    return rsObj;
  }, {});
};

// 一个工具函数用来根据不同的请求头解析请求体
export const parseBody = async (req: IncomingMessage): Promise<any> => {
  const contentType = req.headers['content-type'];
  
  return await new Promise((resolve, reject) => {
    let result;
    if (contentType?.startsWith('multipart/form-data')) {
      const form = formidable({});
      try {
        form.parse(req, (err, fields, files) => {
          if(err) {
            console.error('formidable parse error: ', err);
          }
          const parseFields = ({ ...fields, ...fields });
          result = Object.keys(parseFields).reduce((r, next) => {
            r[next] = parseFields[next].length === 1 ? parseFields[next][0] : parseFields[next];
            return r;
          }, {});
          resolve(formatParams(result));
        });
      } catch (error) {
        console.error('parse body err: ', error);
      }
    } else {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });

      req.on('end', () => {
        try {
          if (contentType?.startsWith('application/json') ?? contentType?.startsWith('text/plain')) {
            result = JSON.parse(body);
          }
          if (contentType?.startsWith('application/x-www-form-urlencoded')) {
            result = body.split('&').reduce((rsObj, item) => {
              const [key, value] = item.split('=');
              rsObj[key] = value;
              return rsObj;
            }, {});
          }
          resolve(formatParams(result));
        } catch (error) {
          console.log('parse body error: ', error);
          resolve({});
        }
      });
    }
  });
};
