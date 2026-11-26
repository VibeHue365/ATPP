import { composeLocationAddress } from './location-address';

describe('composeLocationAddress', () => {
  it('does not append structured fields already included in addressLine', () => {
    expect(
      composeLocationAddress(
        '123, Phường Hòa Hiệp Nam, Quận Liên Chiểu, Thành phố Đà Nẵng',
        'Phường Hòa Hiệp Nam',
        'Quận Liên Chiểu',
        'Thành phố Đà Nẵng',
      ),
    ).toBe(
      '123, Phường Hòa Hiệp Nam, Quận Liên Chiểu, Thành phố Đà Nẵng',
    );
  });

  it('joins separate structured address fields', () => {
    expect(
      composeLocationAddress(
        '123',
        'Phường Hòa Hiệp Nam',
        'Quận Liên Chiểu',
        'Thành phố Đà Nẵng',
      ),
    ).toBe(
      '123, Phường Hòa Hiệp Nam, Quận Liên Chiểu, Thành phố Đà Nẵng',
    );
  });
});
