/**
 * Service ket noi truc tiep voi Kaggle AI Server cho tinh nang Thu Do Ao Dai 2D (Fashn-VTON)
 */

const DEFAULT_API_URL = 'https://deferred-particles-idaho-depends.trycloudflare.com';
const STORAGE_KEY = 'atpp_tryon_2d_api_url';

export interface TryOn2DParams {
  personFile: File | Blob;
  clothFile: File | Blob;
  category?: 'one-pieces' | 'tops' | 'bottoms';
  timesteps?: number;
}

export interface TryOn2DResult {
  imageUrl: string;
  imageBlob: Blob;
  timeSeconds?: number;
}

export const virtualTryOn2DService = {
  getApiUrl(): string {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved.trim()) return saved.trim().replace(/\/+$/, '');
    const legacySaved = localStorage.getItem('atpp_tryon_3d_api_url');
    if (legacySaved && legacySaved.trim()) return legacySaved.trim().replace(/\/+$/, '');
    
    const envUrl = (import.meta as any).env?.VITE_TRYON_2D_API_URL || (import.meta as any).env?.VITE_TRYON_3D_API_URL;
    if (envUrl && envUrl.trim()) return envUrl.trim().replace(/\/+$/, '');
    return DEFAULT_API_URL;
  },

  setApiUrl(url: string) {
    const cleanUrl = url.trim().replace(/\/+$/, '');
    localStorage.setItem(STORAGE_KEY, cleanUrl);
    localStorage.setItem('atpp_tryon_3d_api_url', cleanUrl);
  },

  async convertUrlToFile(imageUrl: string, filename: string = 'cloth.jpg'): Promise<File> {
    try {
      const response = await fetch(imageUrl, { mode: 'cors' });
      const blob = await response.blob();
      return new File([blob], filename, { type: blob.type || 'image/jpeg' });
    } catch (e) {
      console.warn('Direct fetch failed, trying canvas fallback', e);
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0);
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(new File([blob], filename, { type: 'image/jpeg' }));
            } else {
              reject(new Error('Canvas to Blob conversion failed'));
            }
          }, 'image/jpeg', 0.95);
        };
        img.onerror = (err) => reject(err);
        img.src = imageUrl;
      });
    }
  },

  async generate2D(params: TryOn2DParams): Promise<TryOn2DResult> {
    const apiUrl = this.getApiUrl();
    const formData = new FormData();

    formData.append('person_image', params.personFile, 'person.jpg');
    formData.append('cloth_image', params.clothFile, 'cloth.jpg');
    formData.append('category', params.category || 'one-pieces');
    formData.append('num_timesteps', String(params.timesteps || 10));

    const startTime = performance.now();

    // 1. Goi endpoint /api/v1/tryon-2d
    try {
      const response = await fetch(`${apiUrl}/api/v1/tryon-2d`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const imageBlob = await response.blob();
        const imageUrl = URL.createObjectURL(imageBlob);
        const timeSeconds = Math.round((performance.now() - startTime) / 100) / 10;
        return { imageUrl, imageBlob, timeSeconds };
      }
    } catch (err) {
      console.warn('Endpoint /api/v1/tryon-2d failed, trying fallback...', err);
    }

    // 2. Fallback sang /api/v1/tryon-2d/json
    try {
      const responseJson = await fetch(`${apiUrl}/api/v1/tryon-2d/json`, {
        method: 'POST',
        body: formData,
      });

      if (responseJson.ok) {
        const data = await responseJson.json();
        if (data.image_base64) {
          const res = await fetch(data.image_base64);
          const imageBlob = await res.blob();
          const imageUrl = URL.createObjectURL(imageBlob);
          const timeSeconds = Math.round((performance.now() - startTime) / 100) / 10;
          return { imageUrl, imageBlob, timeSeconds };
        }
      }
    } catch (_) {}

    // 3. Fallback sang server 3D neu may chu cu dang chay
    const responseLegacy = await fetch(`${apiUrl}/api/v1/tryon-3d/json`, {
      method: 'POST',
      body: formData,
    });

    if (!responseLegacy.ok) {
      let errorMsg = 'Lỗi máy chủ AI khi ghép ảnh 2D';
      try {
        const errJson = await responseLegacy.json();
        if (errJson.detail) errorMsg = errJson.detail;
      } catch (_) {}
      throw new Error(errorMsg);
    }

    const legacyData = await responseLegacy.json();
    if (legacyData.preview_2d_base64) {
      const res = await fetch(legacyData.preview_2d_base64);
      const imageBlob = await res.blob();
      const imageUrl = URL.createObjectURL(imageBlob);
      const timeSeconds = Math.round((performance.now() - startTime) / 100) / 10;
      return { imageUrl, imageBlob, timeSeconds };
    }

    throw new Error('Không nhận được ảnh kết quả từ AI server');
  },

  async testConnection(url?: string): Promise<{ ok: boolean; gpu?: string; mode?: string }> {
    try {
      const targetUrl = url ? url.replace(/\/+$/, '') : this.getApiUrl();
      const res = await fetch(`${targetUrl}/health`, { method: 'GET' });
      if (!res.ok) return { ok: false };
      const data = await res.json();
      return { ok: true, gpu: data.gpu_name, mode: data.mode || 'SERVER_ACTIVE' };
    } catch (_) {
      return { ok: false };
    }
  }
};

// Alias de dam bao tuong thich cu
export const virtualTryOnService = virtualTryOn2DService;
