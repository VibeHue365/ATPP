import { virtualTryOn2DService } from './virtualTryOn2DService';
import type { TryOn2DParams, TryOn2DResult } from './virtualTryOn2DService';

export const virtualTryOn3DService = {
  getApiUrl(): string {
    return virtualTryOn2DService.getApiUrl();
  },

  setApiUrl(url: string) {
    virtualTryOn2DService.setApiUrl(url);
  },

  async convertUrlToFile(imageUrl: string, filename: string = 'cloth.jpg'): Promise<File> {
    return virtualTryOn2DService.convertUrlToFile(imageUrl, filename);
  },

  async generate2D(params: TryOn2DParams): Promise<TryOn2DResult> {
    return virtualTryOn2DService.generate2D(params);
  },

  async generate3D(params: any): Promise<{ glbBlobUrl: string; glbBlob: Blob }> {
    const res = await virtualTryOn2DService.generate2D(params);
    return { glbBlobUrl: res.imageUrl, glbBlob: res.imageBlob };
  }
};

export { virtualTryOn2DService };
export type { TryOn2DParams, TryOn2DResult };
