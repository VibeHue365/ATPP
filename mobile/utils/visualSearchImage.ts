import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/** Same rule as the web: CLIP looks at 224px, 512px keeps detail and stays far below the 1MB body limit. */
export const SEARCH_IMAGE_MAX_SIDE = 512;
/** Scores from 0.80 up mean "this very design"; below that it is a look-alike. */
export const VERY_SIMILAR_SCORE = 0.8;

export interface PreparedSearchImage {
  base64: string;
  mimeType: 'image/jpeg';
  uri: string;
}

/** Resize target for the longest side, or null when the photo is already small enough. */
export function resizeTarget(width: number, height: number, maxSide = SEARCH_IMAGE_MAX_SIDE) {
  if (Math.max(width, height) <= maxSide) return null;
  return width >= height ? { width: maxSide } : { height: maxSide };
}

/** Headline over the results: an exact design was found, or only look-alikes (same rule as the web). */
export function describeResults(scores: number[]): { exactMatch: boolean; title: string; subtitle: string | null } {
  const exactMatch = scores.some((score) => score >= VERY_SIMILAR_SCORE);
  return exactMatch
    ? { exactMatch, title: 'Tìm thấy mẫu rất giống đang cho thuê', subtitle: null }
    : {
        exactMatch,
        title: 'Chưa có đúng mẫu này trên nền tảng',
        subtitle: `Dưới đây là ${scores.length} mẫu tương tự đang cho thuê.`,
      };
}

export function similarityLabel(score: number) {
  return `${score >= VERY_SIMILAR_SCORE ? 'Rất giống' : 'Tương tự'} ${Math.round(score * 100)}%`;
}

/** Shrinks a picked or captured photo and re-encodes it as JPEG for the search request. */
export async function prepareSearchImage(asset: { uri: string; width: number; height: number }): Promise<PreparedSearchImage> {
  const context = ImageManipulator.manipulate(asset.uri);
  const target = resizeTarget(asset.width, asset.height);
  if (target) context.resize(target);
  const image = await context.renderAsync();
  const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85, base64: true });
  if (!result.base64) throw new Error('Không thể đọc dữ liệu ảnh đã chọn');
  return { base64: result.base64, mimeType: 'image/jpeg', uri: result.uri };
}
