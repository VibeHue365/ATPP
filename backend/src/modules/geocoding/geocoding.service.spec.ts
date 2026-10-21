/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadGatewayException } from '@nestjs/common';
import { GeocodingService } from './geocoding.service';

describe('GeocodingService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function response(ok: boolean, payload: unknown, status = 200): Response {
    return {
      ok,
      status,
      json: jest.fn().mockResolvedValue(payload),
    } as unknown as Response;
  }

  it('returns Nominatim results and caches them case-insensitively', async () => {
    const results = [
      { place_id: 1, display_name: 'Huế', lat: '16.4', lon: '107.5' },
    ];
    global.fetch = jest.fn().mockResolvedValue(response(true, results));
    const service = new GeocodingService();

    await expect(service.search('Huế')).resolves.toEqual(results);
    await expect(service.search('HUẾ')).resolves.toEqual(results);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('nominatim.openstreetmap.org'),
      expect.objectContaining({
        headers: expect.objectContaining({ 'User-Agent': expect.any(String) }),
      }),
    );
  });

  it('falls back to Photon and normalizes valid features', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(response(false, {}, 503))
      .mockResolvedValueOnce(
        response(true, {
          features: [
            {
              properties: {
                osm_id: 22,
                name: 'Đại Nội',
                city: 'Huế',
                country: 'Việt Nam',
              },
              geometry: { coordinates: [107.578, 16.469] },
            },
            { properties: { name: 'Invalid' }, geometry: { coordinates: [] } },
          ],
        }),
      );

    await expect(new GeocodingService().search('Đại Nội')).resolves.toEqual([
      {
        place_id: 22,
        display_name: 'Đại Nội, Huế, Việt Nam',
        lat: '16.469',
        lon: '107.578',
      },
    ]);
  });

  it('returns a controlled error when both providers fail', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('network unavailable'));
    await expect(new GeocodingService().search('Huế')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
