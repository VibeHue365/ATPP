import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { virtualTryOn2DService } from '../src/services/virtualTryOn2DService';

// default AI server since the code of 18/11/2026 (Hugging Face space instead of a temporary Cloudflare tunnel)
const DEFAULT_URL = 'https://kianalover-tago-tryon-api.hf.space';
const person = new Blob(['person'], { type: 'image/jpeg' });
const cloth = new Blob(['cloth'], { type: 'image/jpeg' });

const ok = (body: Blob | object) => ({
  ok: true,
  status: 200,
  blob: () => Promise.resolve(body as Blob),
  json: () => Promise.resolve(body),
});
const fail = (status = 500, body: object | null = null) => ({
  ok: false,
  status,
  json: () => (body ? Promise.resolve(body) : Promise.reject(new Error('no json'))),
});

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  URL.createObjectURL = vi.fn(() => 'blob:tryon-result');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('UC-25 Virtual Try-On (DaiBLL)', () => {
  it('UT-25 UTCID01 uses the default AI server when no address is configured', () => {
    vi.stubEnv('VITE_TRYON_2D_API_URL', '');
    vi.stubEnv('VITE_TRYON_3D_API_URL', '');

    expect(virtualTryOn2DService.getApiUrl()).toBe(DEFAULT_URL);
  });

  it('UT-25 UTCID02 saves the AI server address without spaces or trailing slashes', () => {
    virtualTryOn2DService.setApiUrl('  https://tryon.example.com///  ');

    expect(virtualTryOn2DService.getApiUrl()).toBe('https://tryon.example.com');
    expect(localStorage.getItem('atpp_tryon_3d_api_url')).toBe('https://tryon.example.com');
  });

  // since the code of 18/11/2026 an old temporary tunnel address (trycloudflare.com) saved earlier is ignored
  it('UT-25 UTCID03 ignores an old temporary tunnel address and uses the default AI server', () => {
    vi.stubEnv('VITE_TRYON_2D_API_URL', '');
    vi.stubEnv('VITE_TRYON_3D_API_URL', '');
    localStorage.setItem('atpp_tryon_2d_api_url', 'https://old-tunnel.trycloudflare.com/');

    expect(virtualTryOn2DService.getApiUrl()).toBe(DEFAULT_URL);
  });

  it('UT-25 UTCID04 sends the person and outfit photos as a one-piece garment with 10 steps', async () => {
    virtualTryOn2DService.setApiUrl('https://tryon.example.com');
    const result = new Blob(['result'], { type: 'image/png' });
    fetchMock.mockResolvedValueOnce(ok(result));

    await expect(virtualTryOn2DService.generate2D({ personFile: person, clothFile: cloth })).resolves.toMatchObject({
      imageUrl: 'blob:tryon-result',
      imageBlob: result,
    });
    const [url, init] = fetchMock.mock.calls[0];
    const form = init.body as FormData;
    expect(url).toBe('https://tryon.example.com/api/v1/tryon-2d');
    expect(form.get('category')).toBe('one-pieces');
    expect(form.get('num_timesteps')).toBe('10');
    expect(form.get('person_image')).toBeInstanceOf(Blob);
    expect(form.get('cloth_image')).toBeInstanceOf(Blob);
  });

  it('UT-25 UTCID05 forwards a chosen garment category and number of steps', async () => {
    fetchMock.mockResolvedValueOnce(ok(new Blob(['result'])));

    await virtualTryOn2DService.generate2D({ personFile: person, clothFile: cloth, category: 'tops', timesteps: 30 });

    const form = fetchMock.mock.calls[0][1].body as FormData;
    expect(form.get('category')).toBe('tops');
    expect(form.get('num_timesteps')).toBe('30');
  });

  it('UT-25 UTCID06 retries the JSON endpoint and decodes the base64 image when the image endpoint fails', async () => {
    const decoded = new Blob(['decoded']);
    fetchMock
      .mockResolvedValueOnce(fail(502))
      .mockResolvedValueOnce(ok({ image_base64: 'data:image/png;base64,AAAA' }))
      .mockResolvedValueOnce(ok(decoded));

    await expect(virtualTryOn2DService.generate2D({ personFile: person, clothFile: cloth })).resolves.toMatchObject({
      imageBlob: decoded,
    });
    expect(fetchMock.mock.calls[1][0]).toBe(`${DEFAULT_URL}/api/v1/tryon-2d/json`);
    expect(fetchMock.mock.calls[2][0]).toBe('data:image/png;base64,AAAA');
  });

  it('UT-25 UTCID07 falls back to the older 3D server preview when both 2D endpoints fail', async () => {
    const preview = new Blob(['preview']);
    fetchMock
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(fail(500))
      .mockResolvedValueOnce(ok({ preview_2d_base64: 'data:image/png;base64,BBBB' }))
      .mockResolvedValueOnce(ok(preview));

    await expect(virtualTryOn2DService.generate2D({ personFile: person, clothFile: cloth })).resolves.toMatchObject({
      imageBlob: preview,
    });
    expect(fetchMock.mock.calls[2][0]).toBe(`${DEFAULT_URL}/api/v1/tryon-3d/json`);
  });

  it('UT-25 UTCID08 shows the error detail returned by the AI server', async () => {
    fetchMock
      .mockResolvedValueOnce(fail(500))
      .mockResolvedValueOnce(fail(500))
      .mockResolvedValueOnce(fail(422, { detail: 'Ảnh người mẫu không hợp lệ' }));

    await expect(virtualTryOn2DService.generate2D({ personFile: person, clothFile: cloth })).rejects.toThrow(
      'Ảnh người mẫu không hợp lệ',
    );
  });

  it('UT-25 UTCID09 shows a general error when the AI server fails without details', async () => {
    fetchMock.mockResolvedValueOnce(fail()).mockResolvedValueOnce(fail()).mockResolvedValueOnce(fail(503));

    await expect(virtualTryOn2DService.generate2D({ personFile: person, clothFile: cloth })).rejects.toThrow(
      'Lỗi máy chủ AI khi ghép ảnh 2D',
    );
  });

  it('UT-25 UTCID10 reports a missing result image', async () => {
    fetchMock.mockResolvedValueOnce(fail()).mockResolvedValueOnce(fail()).mockResolvedValueOnce(ok({}));

    await expect(virtualTryOn2DService.generate2D({ personFile: person, clothFile: cloth })).rejects.toThrow(
      'Không nhận được ảnh kết quả từ AI server',
    );
  });

  it('UT-25 UTCID11 reports the GPU name and mode of a reachable AI server', async () => {
    fetchMock.mockResolvedValueOnce(ok({ gpu_name: 'Tesla T4' }));

    await expect(virtualTryOn2DService.testConnection('https://tryon.example.com/')).resolves.toEqual({
      ok: true,
      gpu: 'Tesla T4',
      mode: 'SERVER_ACTIVE',
    });
    expect(fetchMock).toHaveBeenCalledWith('https://tryon.example.com/health', { method: 'GET' });
  });

  it('UT-25 UTCID12 reports an unreachable or failing AI server as not connected', async () => {
    fetchMock.mockResolvedValueOnce(fail(500)).mockRejectedValueOnce(new Error('offline'));

    await expect(virtualTryOn2DService.testConnection()).resolves.toEqual({ ok: false });
    await expect(virtualTryOn2DService.testConnection()).resolves.toEqual({ ok: false });
  });

  it('UT-25 UTCID13 converts a catalog outfit image URL into an uploadable file', async () => {
    fetchMock.mockResolvedValueOnce(ok(new Blob(['outfit'], { type: 'image/webp' })));

    const file = await virtualTryOn2DService.convertUrlToFile('https://cdn.example.com/aodai.webp', 'cloth.webp');

    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('cloth.webp');
    expect(file.type).toBe('image/webp');
  });
});
