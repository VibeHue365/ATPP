import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateProfileDto } from './update-profile.dto';

async function errorFields(
  payload: Record<string, unknown>,
): Promise<string[]> {
  const errors = await validate(plainToInstance(UpdateProfileDto, payload));
  return errors.map((error) => error.property).sort();
}

describe('UpdateProfileDto (UC-13 Update Profile)', () => {
  it('UT-13 UTCID14 accepts the maximum full name and phone lengths', async () => {
    await expect(
      errorFields({
        fullName: 'a'.repeat(120),
        phone: '0'.repeat(20),
        address: 'x'.repeat(500),
      }),
    ).resolves.toEqual([]);
  });

  it('UT-13 UTCID15 rejects full name and phone values one character above the limit', async () => {
    await expect(
      errorFields({ fullName: 'a'.repeat(121), phone: '0'.repeat(21) }),
    ).resolves.toEqual(['fullName', 'phone']);
  });

  it('UT-13 UTCID16 rejects an unsupported gender and a malformed date of birth', async () => {
    await expect(
      errorFields({ gender: 'UNKNOWN', dateOfBirth: '20/05/2000' }),
    ).resolves.toEqual(['dateOfBirth', 'gender']);
  });
});
