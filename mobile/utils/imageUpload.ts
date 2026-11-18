import * as ImageManipulator from 'expo-image-manipulator';
import type * as ImagePicker from 'expo-image-picker';

const ACCEPTED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export function normalizeImageMimeType(
  mimeType?: string | null,
  uri?: string | null,
): string | null {
  const raw = mimeType?.trim().toLowerCase();
  if (raw === 'image/jpg' || raw === 'image/pjpeg') return 'image/jpeg';
  if (raw && ACCEPTED_IMAGE_MIMES.has(raw)) return raw;

  const cleanPath = (uri || '').split('?')[0].toLowerCase();
  if (cleanPath.endsWith('.jpg') || cleanPath.endsWith('.jpeg')) return 'image/jpeg';
  if (cleanPath.endsWith('.png')) return 'image/png';
  if (cleanPath.endsWith('.webp')) return 'image/webp';
  return null;
}

function replaceExtension(filename: string, ext: string): string {
  const base = filename.replace(/\.[^.]+$/, '');
  return `${base || 'upload'}.${ext}`;
}

export async function prepareImageUploadPart(
  asset: ImagePicker.ImagePickerAsset,
  fallbackName = 'upload.jpg',
): Promise<Blob> {
  if (asset.file) {
    return asset.file;
  }

  const normalizedMime = normalizeImageMimeType(asset.mimeType, asset.uri);
  if (normalizedMime) {
    const ext =
      normalizedMime === 'image/png'
        ? 'png'
        : normalizedMime === 'image/webp'
          ? 'webp'
          : 'jpg';
    return {
      uri: asset.uri,
      name: replaceExtension(asset.fileName ?? fallbackName, ext),
      type: normalizedMime,
    } as unknown as Blob;
  }

  // Convert HEIC / HEIF / unlabelled camera captures into a genuine JPEG buffer
  // so backend magic-byte validation (`PublicMediaService.assertValidImage`) accepts it.
  const manipulated = await ImageManipulator.manipulateAsync(asset.uri, [], {
    compress: 0.85,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  return {
    uri: manipulated.uri,
    name: replaceExtension(asset.fileName ?? fallbackName, 'jpg'),
    type: 'image/jpeg',
  } as unknown as Blob;
}
