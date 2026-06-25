import { Readable } from 'stream';

export interface PrivateStoragePutResult {
  storageProvider: string;
  bucket: string;
  storageKey: string;
}

export abstract class PrivateStorageService {
  abstract uploadPrivateFile(
    bucket: string,
    storageKey: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<PrivateStoragePutResult>;

  abstract readPrivateFile(
    bucket: string,
    storageKey: string,
  ): Promise<Readable>;

  abstract deletePrivateFile(bucket: string, storageKey: string): Promise<void>;

  abstract exists(bucket: string, storageKey: string): Promise<boolean>;
}
