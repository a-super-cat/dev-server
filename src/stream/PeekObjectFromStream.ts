import { Transform } from 'stream';
import type { TransformCallback } from 'node:stream';

export class PeekObjectFromStream extends Transform {
  private chunkStr = '';
  constructor() {
    super({ objectMode: true });
    this.chunkStr = '';
    this.on('end', () => {
      let rs;
      try {
        rs = JSON.parse(this.chunkStr ?? '{}');
      } catch (error) {
        rs = {};
      }
      this.emit('parsed', rs);
    });
  }

  _transform(chunk: any, encoding: BufferEncoding, callback: TransformCallback): void{
    this.chunkStr += chunk.toString();
    this.push(chunk, encoding);
    callback();
  }

  _flush(callback: TransformCallback): void {
    // 当输入流中的所有数据都被读取完毕后，调用该方法
    callback();
  }
}

// // 创建一个读取文件流
// const readStream = // 创建读取文件流的逻辑

// // 创建一个写入文件流
// const writeStream = // 创建写入文件流的逻辑

// // 创建转换流对象
// const transformStream = new MyTransformStream();

// // 将读取文件流的数据通过转换流进行转换，并将转换后的数据写入写入文件流
// readStream.pipe(transformStream).pipe(writeStream);