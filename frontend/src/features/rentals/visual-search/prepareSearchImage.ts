/** CLIP looks at 224px, so 512px keeps detail while the upload stays far below the 1MB body limit. */
export const SEARCH_IMAGE_MAX_SIDE = 512;
export const SEARCH_IMAGE_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const SEARCH_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface PreparedSearchImage {
  base64: string;
  mimeType: 'image/jpeg';
  previewUrl: string;
}

export function validateSearchImage(file: File): string | null {
  if (!SEARCH_IMAGE_TYPES.includes(file.type)) {
    return 'Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.';
  }
  if (file.size > SEARCH_IMAGE_MAX_FILE_BYTES) {
    return 'Ảnh quá lớn, vui lòng chọn ảnh dưới 10MB.';
  }
  return null;
}

export function scaleToFit(width: number, height: number, maxSide = SEARCH_IMAGE_MAX_SIDE) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Shrinks the photo in the browser and re-encodes it as JPEG for the search request. */
export async function prepareSearchImage(file: File): Promise<PreparedSearchImage> {
  const image = await loadImage(file);
  const size = scaleToFit(image.naturalWidth, image.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Trình duyệt không hỗ trợ xử lý ảnh.');
  // Transparent PNG areas would turn black in JPEG; white is closer to a studio backdrop.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, size.width, size.height);
  context.drawImage(image, 0, 0, size.width, size.height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  return { base64: dataUrl.split(',')[1], mimeType: 'image/jpeg', previewUrl: dataUrl };
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Không đọc được ảnh.'));
    };
    image.src = url;
  });
}
