import { Writable } from 'stream';
export class DoNothingWriteAbleStream extends Writable {
  _write(chunk: any, encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    callback();
  }
}