import 'reflect-metadata';
import { validate } from 'class-validator';
import { SmartTagDecisionAction } from '../constants/smart-tag.constants';
import { SmartTagDecisionDto, SmartTagSelectionDto } from './smart-tag.dto';

describe('smart tag DTOs', () => {
  it('requires a reason when rejecting or removing a tag', async () => {
    const dto = Object.assign(new SmartTagDecisionDto(), {
      action: SmartTagDecisionAction.Reject,
      expectedDecisionVersion: 1,
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'reason')).toBe(true);
  });

  it('rejects duplicate codes in a selection', async () => {
    const dto = Object.assign(new SmartTagSelectionDto(), {
      activeTagCodes: ['TRUYEN_THONG', 'TRUYEN_THONG'],
      expectedDecisionVersion: 0,
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'activeTagCodes')).toBe(
      true,
    );
  });
});
