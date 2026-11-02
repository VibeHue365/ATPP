const mockPost = jest.fn();
jest.mock('@/apis/httpClient', () => ({ __esModule: true, default: { post: (...args: unknown[]) => mockPost(...args) } }));

const mockResize = jest.fn();
const mockSaveAsync = jest.fn();
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: () => ({ resize: mockResize, renderAsync: async () => ({ saveAsync: mockSaveAsync }) }),
  },
}));

import { aiApi } from '@/apis/aiApi';
import { prepareSearchImage, resizeTarget, similarityLabel } from '@/utils/visualSearchImage';

describe('visual search on mobile (VIB-93)', () => {
  beforeEach(() => {
    mockPost.mockReset();
    mockResize.mockReset();
    mockSaveAsync.mockReset().mockResolvedValue({ uri: 'file://small.jpg', base64: 'small-jpeg' });
  });

  it('shrinks the longest side to 512px and leaves small photos alone', () => {
    expect(resizeTarget(2000, 1000)).toEqual({ width: 512 });
    expect(resizeTarget(1000, 3000)).toEqual({ height: 512 });
    expect(resizeTarget(400, 300)).toBeNull();
  });

  it('labels 80% and above as very similar', () => {
    expect(similarityLabel(0.912)).toBe('Rất giống 91%');
    expect(similarityLabel(0.7)).toBe('Tương tự 70%');
  });

  it('re-encodes a large photo as a small JPEG before searching', async () => {
    await expect(prepareSearchImage({ uri: 'file://big.heic', width: 3024, height: 4032 })).resolves.toEqual({
      base64: 'small-jpeg',
      mimeType: 'image/jpeg',
      uri: 'file://small.jpg',
    });
    expect(mockResize).toHaveBeenCalledWith({ height: 512 });
    expect(mockSaveAsync).toHaveBeenCalledWith({ format: 'jpeg', compress: 0.85, base64: true });
  });

  it('does not resize a photo that is already small', async () => {
    await prepareSearchImage({ uri: 'file://small.png', width: 300, height: 400 });
    expect(mockResize).not.toHaveBeenCalled();
  });

  it('sends the image in the backend contract', async () => {
    mockPost.mockResolvedValue({ items: [], message: 'Không tìm thấy áo dài phù hợp trong ảnh.' });

    await aiApi.visualSearch('small-jpeg', 'image/jpeg');

    expect(mockPost).toHaveBeenCalledWith('/ai/visual-search/match', {
      image_base64: 'small-jpeg',
      mime_type: 'image/jpeg',
    });
  });
});
