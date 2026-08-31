/**
 * Service ket noi truc tiep voi Kaggle AI Server cho tinh nang Thu Do Ao Dai 3D
 */

const DEFAULT_API_URL = 'https://dynamic-market-alerts-holding.trycloudflare.com';
const STORAGE_KEY = 'atpp_tryon_3d_api_url';

export const virtualTryOn3DService = {
  /**
   * Lay URL API hien tai (uu tien tu localStorage hoac env)
   */
  getApiUrl(): string {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved.trim()) return saved.trim().replace(/\/+$/, '');
    const envUrl = (import.meta as any).env?.VITE_TRYON_3D_API_URL;
    if (envUrl && envUrl.trim()) return envUrl.trim().replace(/\/+$/, '');
    return DEFAULT_API_URL;
  },

  /**
   * Luu URL API moi (khi nguoi dung doi phien Kaggle moi)
   */
  setApiUrl(url: string) {
    localStorage.setItem(STORAGE_KEY, url.trim().replace(/\/+$/, ''));
  },

  /**
   * Chuyen doi URL anh san pham tren web thanh doi tuong File/Blob de gui len AI Server
   */
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

  /**
   * Goi API chay Virtual Try-On 3D day du
   */
  async generate3D(params: {
    personFile: File | Blob;
    clothFile: File | Blob;
    category?: 'one-pieces' | 'tops' | 'bottoms';
    quality?: 'turbo' | 'hd';
  }): Promise<{ glbBlobUrl: string; glbBlob: Blob }> {
    const apiUrl = this.getApiUrl();
    const formData = new FormData();

    formData.append('person_image', params.personFile, 'person.jpg');
    formData.append('cloth_image', params.clothFile, 'cloth.jpg');
    formData.append('category', params.category || 'one-pieces');

    if (params.quality === 'turbo') {
      formData.append('sparse_steps', '8');
      formData.append('slat_steps', '8');
    } else {
      formData.append('sparse_steps', '12');
      formData.append('slat_steps', '12');
    }

    const response = await fetch(`${apiUrl}/api/v1/tryon-3d`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      let errorMsg = 'Lỗi máy chủ AI khi sinh mô hình 3D';
      try {
        const errJson = await response.json();
        if (errJson.detail) errorMsg = errJson.detail;
      } catch (_) {}
      throw new Error(errorMsg);
    }

    const glbBlob = await response.blob();
    const glbBlobUrl = URL.createObjectURL(glbBlob);

    return { glbBlobUrl, glbBlob };
  }
};
