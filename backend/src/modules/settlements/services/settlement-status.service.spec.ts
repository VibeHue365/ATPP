import { BadRequestException } from '@nestjs/common';
import { SettlementStatus } from '../constants/settlement-status.enum';
import { SettlementStatusService } from './settlement-status.service';

describe('SettlementStatusService', () => {
  const service = new SettlementStatusService();

  it('allows holding only a ready settlement', () => {
    expect(() =>
      service.assertCanHold(SettlementStatus.ReadyToSettle),
    ).not.toThrow();
    expect(() => service.assertCanHold(SettlementStatus.Settled)).toThrow(
      BadRequestException,
    );
  });

  it('allows releasing only an on-hold settlement', () => {
    expect(() =>
      service.assertCanRelease(SettlementStatus.OnHold),
    ).not.toThrow();
    expect(() =>
      service.assertCanRelease(SettlementStatus.ReadyToSettle),
    ).toThrow(BadRequestException);
  });

  it('requires ready status and a positive payable amount before settlement', () => {
    expect(() =>
      service.assertCanMarkSettled(SettlementStatus.ReadyToSettle, 1),
    ).not.toThrow();
    expect(() =>
      service.assertCanMarkSettled(SettlementStatus.ReadyToSettle, 0),
    ).toThrow(BadRequestException);
    expect(() =>
      service.assertCanMarkSettled(SettlementStatus.OnHold, 1000),
    ).toThrow(BadRequestException);
  });
});
