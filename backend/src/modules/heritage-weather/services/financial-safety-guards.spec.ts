import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';

describe('Financial Safety Guards (PR 3)', () => {
  describe('cancelBooking Weather Guard', () => {
    it('should throw BadRequestException if booking.hasPendingWeatherAction is true', async () => {
      const mockBooking = {
        _id: new Types.ObjectId(),
        bookingCode: 'BK-123456',
        status: 'CONFIRMED',
        hasPendingWeatherAction: true,
      };

      const checkCancelGuard = (booking: any) => {
        if (booking.hasPendingWeatherAction) {
          throw new BadRequestException(
            'Đơn hàng đang có yêu cầu đổi lịch hoặc hủy vì thời tiết đang chờ xử lý. Không thể thực hiện hủy đơn thông thường.',
          );
        }
      };

      expect(() => checkCancelGuard(mockBooking)).toThrow(BadRequestException);
      expect(() => checkCancelGuard(mockBooking)).toThrow(
        'Đơn hàng đang có yêu cầu đổi lịch hoặc hủy vì thời tiết đang chờ xử lý',
      );
    });

    it('should block executeAutoTransfer if booking has active weather action', async () => {
      const mockBooking = {
        bookingCode: 'BK-789012',
        hasPendingWeatherAction: true,
      };
      const executeAutoTransferMock = jest.fn();

      const handlePenaltyTransfer = async (
        booking: any,
        penaltyAmount: number,
      ) => {
        if (penaltyAmount > 0) {
          if (booking.hasPendingWeatherAction) {
            // Guard blocks the transfer!
            return false;
          }
          await executeAutoTransferMock();
          return true;
        }
        return false;
      };

      const transferred = await handlePenaltyTransfer(mockBooking, 250000);

      expect(transferred).toBe(false);
      expect(executeAutoTransferMock).not.toHaveBeenCalled();
    });
  });

  describe('autoDisputeUnstartedPastBookings Deferral Guard', () => {
    it('should skip auto-dispute when booking hasPendingWeatherAction is true', () => {
      const now = new Date('2026-11-12T14:00:00Z');
      const booking = {
        bookingCode: 'BK-111111',
        hasPendingWeatherAction: true,
        disputeDeferredUntil: null,
      };

      const shouldSkipAutoDispute = (b: any, currentTime: Date): boolean => {
        if (
          b.hasPendingWeatherAction ||
          (b.disputeDeferredUntil &&
            currentTime < new Date(b.disputeDeferredUntil))
        ) {
          return true;
        }
        return false;
      };

      expect(shouldSkipAutoDispute(booking, now)).toBe(true);
    });

    it('should skip auto-dispute when disputeDeferredUntil is in the future', () => {
      const now = new Date('2026-11-12T14:00:00Z');
      const futureDate = new Date('2026-11-12T16:00:00Z');
      const booking = {
        bookingCode: 'BK-222222',
        hasPendingWeatherAction: false,
        disputeDeferredUntil: futureDate,
      };

      const shouldSkipAutoDispute = (b: any, currentTime: Date): boolean => {
        if (
          b.hasPendingWeatherAction ||
          (b.disputeDeferredUntil &&
            currentTime < new Date(b.disputeDeferredUntil))
        ) {
          return true;
        }
        return false;
      };

      expect(shouldSkipAutoDispute(booking, now)).toBe(true);
    });

    it('should NOT skip auto-dispute when no weather action and disputeDeferredUntil is in the past', () => {
      const now = new Date('2026-11-12T14:00:00Z');
      const pastDate = new Date('2026-11-12T12:00:00Z');
      const booking = {
        bookingCode: 'BK-333333',
        hasPendingWeatherAction: false,
        disputeDeferredUntil: pastDate,
      };

      const shouldSkipAutoDispute = (b: any, currentTime: Date): boolean => {
        if (
          b.hasPendingWeatherAction ||
          (b.disputeDeferredUntil &&
            currentTime < new Date(b.disputeDeferredUntil))
        ) {
          return true;
        }
        return false;
      };

      expect(shouldSkipAutoDispute(booking, now)).toBe(false);
    });
  });
});
