import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  UpdateProviderProfileDto,
  ProviderRentalSettingsDto,
} from './update-provider-profile.dto';

describe('UpdateProviderProfileDto - turnaroundSlots validation', () => {
  it('accepts valid turnaroundSlots (0, 1, 2, 3)', async () => {
    for (const slots of [0, 1, 2, 3]) {
      const dto = plainToInstance(UpdateProviderProfileDto, {
        rentalSettings: {
          turnaroundSlots: slots,
          useBusinessAddressForPickup: true,
        },
      });

      const errors = await validate(dto);
      const rentalErrors = errors.find((e) => e.property === 'rentalSettings');
      expect(rentalErrors).toBeUndefined();
    }
  });

  it('rejects turnaroundSlots < 0', async () => {
    const dto = plainToInstance(UpdateProviderProfileDto, {
      rentalSettings: {
        turnaroundSlots: -1,
      },
    });

    const errors = await validate(dto);
    const rentalError = errors.find((e) => e.property === 'rentalSettings');
    expect(rentalError).toBeDefined();
    const childErrors = rentalError?.children || [];
    const turnaroundError = childErrors.find((c) => c.property === 'turnaroundSlots');
    expect(turnaroundError).toBeDefined();
    expect(turnaroundError?.constraints?.min).toBeDefined();
  });

  it('rejects turnaroundSlots > 3', async () => {
    const dto = plainToInstance(UpdateProviderProfileDto, {
      rentalSettings: {
        turnaroundSlots: 4,
      },
    });

    const errors = await validate(dto);
    const rentalError = errors.find((e) => e.property === 'rentalSettings');
    expect(rentalError).toBeDefined();
    const childErrors = rentalError?.children || [];
    const turnaroundError = childErrors.find((c) => c.property === 'turnaroundSlots');
    expect(turnaroundError).toBeDefined();
    expect(turnaroundError?.constraints?.max).toBeDefined();
  });

  it('rejects non-integer turnaroundSlots', async () => {
    const dto = plainToInstance(UpdateProviderProfileDto, {
      rentalSettings: {
        turnaroundSlots: 1.5,
      },
    });

    const errors = await validate(dto);
    const rentalError = errors.find((e) => e.property === 'rentalSettings');
    expect(rentalError).toBeDefined();
    const childErrors = rentalError?.children || [];
    const turnaroundError = childErrors.find((c) => c.property === 'turnaroundSlots');
    expect(turnaroundError).toBeDefined();
    expect(turnaroundError?.constraints?.isInt).toBeDefined();
  });
});
