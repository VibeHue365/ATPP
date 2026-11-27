import JSZip from 'jszip';
import { API_BASE_URL } from '../config/env';

const resolveDownloadUrl = (rawUrl: string): string => {
  if (!rawUrl) return rawUrl;
  if (
    rawUrl.startsWith('http://') ||
    rawUrl.startsWith('https://') ||
    rawUrl.startsWith('data:') ||
    rawUrl.startsWith('blob:')
  ) {
    return rawUrl;
  }
  const base = API_BASE_URL.replace(/\/+$/, '');
  const path = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
  return `${base}${path}`;
};

export const downloadSinglePhoto = async (photoUrl: string, fileName: string) => {
  const resolvedUrl = resolveDownloadUrl(photoUrl);
  try {
    const res = await fetch(resolvedUrl);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch (_err) {
    window.open(resolvedUrl, '_blank');
  }
};

export const downloadPhotosAsZip = async (
  photos: string[],
  zipFilename: string = 'anh_chup_ket_qua.zip',
  toast?: any,
) => {
  if (!photos || photos.length === 0) return;

  if (toast) toast.info(`⏳ Đang đóng gói ${photos.length} hình ảnh thành tệp ZIP...`);

  try {
    const zip = new JSZip();
    const folder = zip.folder('anh_chup');

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const photoUrl = resolveDownloadUrl(photo);
      try {
        const response = await fetch(photoUrl);
        const blob = await response.blob();
        let ext = 'jpg';
        if (photoUrl.toLowerCase().includes('.png')) ext = 'png';
        else if (photoUrl.toLowerCase().includes('.webp')) ext = 'webp';

        folder?.file(`anh_${i + 1}.${ext}`, blob);
      } catch (err) {
        console.error(`Lỗi nén ảnh #${i + 1}:`, err);
      }
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const blobUrl = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = zipFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);

    if (toast) toast.success(`🎉 Đã tải tệp ${zipFilename} thành công!`);
  } catch (error: any) {
    console.error('Lỗi nén tệp ZIP:', error);
    if (toast) toast.error('Không thể tạo tệp ZIP. Vui lòng thử lại sau.');
  }
};
