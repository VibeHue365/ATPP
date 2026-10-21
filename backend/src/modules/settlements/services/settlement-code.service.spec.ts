import { SettlementCodeService } from './settlement-code.service';

describe('SettlementCodeService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('generates a date-based code when the candidate is unique', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-28T12:00:00Z'));
    jest.spyOn(Math, 'random').mockReturnValue(0.123456);
    const model = { exists: jest.fn().mockResolvedValue(false) };
    const service = new SettlementCodeService(model as never);

    await expect(service.generateSettlementCode()).resolves.toBe(
      'STL-20260928-123456',
    );
    expect(model.exists).toHaveBeenCalledWith({
      settlementCode: 'STL-20260928-123456',
    });
    jest.useRealTimers();
  });

  it('retries a collision and returns the next available code', async () => {
    jest
      .spyOn(Math, 'random')
      .mockReturnValueOnce(0.111111)
      .mockReturnValueOnce(0.222222);
    const model = {
      exists: jest
        .fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false),
    };
    const code = await new SettlementCodeService(
      model as never,
    ).generateSettlementCode();
    expect(code).toMatch(/-222222$/);
    expect(model.exists).toHaveBeenCalledTimes(2);
  });

  it('fails after three collisions', async () => {
    const model = { exists: jest.fn().mockResolvedValue(true) };
    await expect(
      new SettlementCodeService(model as never).generateSettlementCode(),
    ).rejects.toThrow('SETTLEMENT_CODE_GENERATION_FAILED');
    expect(model.exists).toHaveBeenCalledTimes(3);
  });
});
