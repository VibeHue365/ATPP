import { TimeSlotEngineService } from './time-slot-engine.service';

describe('TimeSlotEngineService', () => {
  let engine: TimeSlotEngineService;

  beforeEach(() => {
    engine = new TimeSlotEngineService();
  });

  describe('roundUpToSlotBoundary', () => {
    it('returns exact boundary when time lands exactly on a slot boundary', () => {
      // Monday 11:00 VN
      const t11 = engine.makeVnDate(2026, 11, 16, 11, 0);
      const rounded = engine.roundUpToSlotBoundary(t11);
      const parts = engine.getVnParts(rounded);
      expect(parts.dateStr).toBe('2026-11-16');
      expect(parts.hour).toBe(11);
      expect(parts.minute).toBe(0);
    });

    it('rounds 10:15 up to 11:00', () => {
      const t = engine.makeVnDate(2026, 11, 16, 10, 15);
      const rounded = engine.roundUpToSlotBoundary(t);
      const parts = engine.getVnParts(rounded);
      expect(parts.dateStr).toBe('2026-11-16');
      expect(parts.hour).toBe(11);
      expect(parts.minute).toBe(0);
    });

    it('rounds 13:30 up to 15:00', () => {
      const t = engine.makeVnDate(2026, 11, 16, 13, 30);
      const rounded = engine.roundUpToSlotBoundary(t);
      const parts = engine.getVnParts(rounded);
      expect(parts.dateStr).toBe('2026-11-16');
      expect(parts.hour).toBe(15);
      expect(parts.minute).toBe(0);
    });

    it('returns 21:00 when landing exactly on closing 21:00', () => {
      const t21 = engine.makeVnDate(2026, 11, 16, 21, 0);
      const rounded = engine.roundUpToSlotBoundary(t21);
      const parts = engine.getVnParts(rounded);
      expect(parts.dateStr).toBe('2026-11-16');
      expect(parts.hour).toBe(21);
      expect(parts.minute).toBe(0);
    });

    it('rollovers after 21:00 to 07:00 of the next working day', () => {
      const tAfter = engine.makeVnDate(2026, 11, 16, 21, 5);
      const rounded = engine.roundUpToSlotBoundary(tAfter);
      const parts = engine.getVnParts(rounded);
      expect(parts.dateStr).toBe('2026-11-17');
      expect(parts.hour).toBe(7);
      expect(parts.minute).toBe(0);
    });

    it('rollovers across weekly off-day (Sunday) to Monday 07:00', () => {
      // 2026-11-21 is Saturday. Next day is Sunday (off). Monday is 2026-11-23.
      const tSatNight = engine.makeVnDate(2026, 11, 21, 21, 10);
      const rounded = engine.roundUpToSlotBoundary(tSatNight, {
        weeklyOffDays: [0],
      });
      const parts = engine.getVnParts(rounded);
      expect(parts.dateStr).toBe('2026-11-23');
      expect(parts.hour).toBe(7);
      expect(parts.minute).toBe(0);
    });
  });

  describe('calculateUpfrontBlock', () => {
    it('Case 1: Monday 07:00-09:00 with K=1 turnaround', () => {
      const block = engine.calculateUpfrontBlock('2026-11-16', 1, 1, 1);
      expect(block.rentalSlots).toHaveLength(1);
      expect(block.rentalSlots[0].timeSlotString).toBe('07:00-09:00');
      expect(block.turnaroundSlots).toHaveLength(1);
      expect(block.turnaroundSlots[0].timeSlotString).toBe('09:00-11:00');
      const availParts = engine.getVnParts(block.availableFrom);
      expect(availParts.dateStr).toBe('2026-11-16');
      expect(availParts.hour).toBe(11);
      expect(availParts.minute).toBe(0);
    });

    it('Case 2: Monday 17:00-19:00 with K=1 turnaround (ends at 21:00 closing)', () => {
      const block = engine.calculateUpfrontBlock('2026-11-16', 6, 1, 1);
      expect(block.rentalSlots[0].timeSlotString).toBe('17:00-19:00');
      expect(block.turnaroundSlots[0].timeSlotString).toBe('19:00-21:00');
      const availParts = engine.getVnParts(block.availableFrom);
      expect(availParts.dateStr).toBe('2026-11-16');
      expect(availParts.hour).toBe(21);
      expect(availParts.minute).toBe(0);
    });

    it('Case 3: Monday 19:00-21:00 with K=1 turnaround (rollover to Tuesday 07:00-09:00)', () => {
      const block = engine.calculateUpfrontBlock('2026-11-16', 7, 1, 1);
      expect(block.rentalSlots[0].timeSlotString).toBe('19:00-21:00');
      expect(block.turnaroundSlots[0].dateStr).toBe('2026-11-17');
      expect(block.turnaroundSlots[0].slotIndex).toBe(1);
      expect(block.turnaroundSlots[0].timeSlotString).toBe('07:00-09:00');
      const availParts = engine.getVnParts(block.availableFrom);
      expect(availParts.dateStr).toBe('2026-11-17');
      expect(availParts.hour).toBe(9);
      expect(availParts.minute).toBe(0);
    });

    it('Case 4: Saturday 19:00-21:00 with K=1, Sunday closed -> turnaround Monday 07:00-09:00', () => {
      // 2026-11-21 is Saturday, Sunday 22 is closed
      const block = engine.calculateUpfrontBlock('2026-11-21', 7, 1, 1, {
        weeklyOffDays: [0],
      });
      expect(block.turnaroundSlots[0].dateStr).toBe('2026-11-23');
      expect(block.turnaroundSlots[0].slotIndex).toBe(1);
      const availParts = engine.getVnParts(block.availableFrom);
      expect(availParts.dateStr).toBe('2026-11-23');
      expect(availParts.hour).toBe(9);
    });

    it('Case 7: Monday 07:00-09:00 with K=2 (4 hours turnaround)', () => {
      const block = engine.calculateUpfrontBlock('2026-11-16', 1, 1, 2);
      expect(block.turnaroundSlots).toHaveLength(2);
      expect(block.turnaroundSlots[0].timeSlotString).toBe('09:00-11:00');
      expect(block.turnaroundSlots[1].timeSlotString).toBe('11:00-13:00');
      const availParts = engine.getVnParts(block.availableFrom);
      expect(availParts.hour).toBe(13);
    });

    it('Case 8: Monday 15:00-17:00 with K=2 (17:00-21:00 turnaround)', () => {
      const block = engine.calculateUpfrontBlock('2026-11-16', 5, 1, 2);
      expect(block.turnaroundSlots[0].timeSlotString).toBe('17:00-19:00');
      expect(block.turnaroundSlots[1].timeSlotString).toBe('19:00-21:00');
      const availParts = engine.getVnParts(block.availableFrom);
      expect(availParts.hour).toBe(21);
    });

    it('Case 9: Monday 17:00-19:00 with K=2 (19:00-21:00 + Tuesday 07:00-09:00)', () => {
      const block = engine.calculateUpfrontBlock('2026-11-16', 6, 1, 2);
      expect(block.turnaroundSlots[0].timeSlotString).toBe('19:00-21:00');
      expect(block.turnaroundSlots[1].dateStr).toBe('2026-11-17');
      expect(block.turnaroundSlots[1].timeSlotString).toBe('07:00-09:00');
      const availParts = engine.getVnParts(block.availableFrom);
      expect(availParts.dateStr).toBe('2026-11-17');
      expect(availParts.hour).toBe(9);
    });
  });

  describe('calculateReturnAvailableFrom', () => {
    it('Case 5: Monday 07:00-09:00, returned late at 10:00 with K=1 -> availableFrom = 13:00', () => {
      const rentalTo = engine.makeVnDate(2026, 11, 16, 9, 0);
      const returnedAt = engine.makeVnDate(2026, 11, 16, 10, 0);
      const availableFrom = engine.calculateReturnAvailableFrom(
        rentalTo,
        returnedAt,
        1,
      );
      const parts = engine.getVnParts(availableFrom);
      expect(parts.dateStr).toBe('2026-11-16');
      expect(parts.hour).toBe(13);
      expect(parts.minute).toBe(0);
    });

    it('Case 6: Monday 07:00-11:00, returned early at 08:15 with K=1 -> availableFrom = 11:00', () => {
      const rentalTo = engine.makeVnDate(2026, 11, 16, 11, 0);
      const returnedAt = engine.makeVnDate(2026, 11, 16, 8, 15);
      const availableFrom = engine.calculateReturnAvailableFrom(
        rentalTo,
        returnedAt,
        1,
      );
      const parts = engine.getVnParts(availableFrom);
      expect(parts.dateStr).toBe('2026-11-16');
      expect(parts.hour).toBe(11);
      expect(parts.minute).toBe(0);
    });

    it('Case 10: Monday 09:00-11:00, returned late at 11:30 with K=1 -> availableFrom = 15:00', () => {
      const rentalTo = engine.makeVnDate(2026, 11, 16, 11, 0);
      const returnedAt = engine.makeVnDate(2026, 11, 16, 11, 30);
      const availableFrom = engine.calculateReturnAvailableFrom(
        rentalTo,
        returnedAt,
        1,
      );
      const parts = engine.getVnParts(availableFrom);
      expect(parts.dateStr).toBe('2026-11-16');
      expect(parts.hour).toBe(15);
      expect(parts.minute).toBe(0);
    });

    describe('Requirement G: turnaroundSlotsSnapshot 0, 1, 2, 3 calculations', () => {
      it('K=0: available immediately at contractual rentalTo or rounded if late', () => {
        const rentalTo = engine.makeVnDate(2026, 11, 16, 11, 0); // Monday 11:00
        // On-time return: available immediately at 11:00
        const onTime = engine.makeVnDate(2026, 11, 16, 11, 0);
        const avail0OnTime = engine.calculateReturnAvailableFrom(
          rentalTo,
          onTime,
          0,
        );
        expect(engine.getVnParts(avail0OnTime).hour).toBe(11);

        // Early return (09:30): available at contractualRentalTo 11:00
        const early = engine.makeVnDate(2026, 11, 16, 9, 30);
        const avail0Early = engine.calculateReturnAvailableFrom(
          rentalTo,
          early,
          0,
        );
        expect(engine.getVnParts(avail0Early).hour).toBe(11);

        // Late return (11:15): rounded up to next boundary 13:00
        const late = engine.makeVnDate(2026, 11, 16, 11, 15);
        const avail0Late = engine.calculateReturnAvailableFrom(
          rentalTo,
          late,
          0,
        );
        expect(engine.getVnParts(avail0Late).hour).toBe(13);
      });

      it('K=1: advances by 1 slot (2 hours) -> 13:00', () => {
        const rentalTo = engine.makeVnDate(2026, 11, 16, 11, 0);
        const returnedAt = engine.makeVnDate(2026, 11, 16, 11, 0);
        const avail = engine.calculateReturnAvailableFrom(
          rentalTo,
          returnedAt,
          1,
        );
        expect(engine.getVnParts(avail).hour).toBe(13);
      });

      it('K=2: advances by 2 slots (4 hours) -> 15:00', () => {
        const rentalTo = engine.makeVnDate(2026, 11, 16, 11, 0);
        const returnedAt = engine.makeVnDate(2026, 11, 16, 11, 0);
        const avail = engine.calculateReturnAvailableFrom(
          rentalTo,
          returnedAt,
          2,
        );
        expect(engine.getVnParts(avail).hour).toBe(15);
      });

      it('K=3: advances by 3 slots (6 hours) -> 17:00', () => {
        const rentalTo = engine.makeVnDate(2026, 11, 16, 11, 0);
        const returnedAt = engine.makeVnDate(2026, 11, 16, 11, 0);
        const avail = engine.calculateReturnAvailableFrom(
          rentalTo,
          returnedAt,
          3,
        );
        expect(engine.getVnParts(avail).hour).toBe(17);
      });
    });

    describe('Requirement H: turnaround rollover across weekly off-day and SPECIFIC_DATE', () => {
      it('rolls over Sunday weekly off-day to Monday morning', () => {
        // Saturday 2026-11-21 19:00 with K=2 (4 hours). Sunday (0) is off.
        const rentalTo = engine.makeVnDate(2026, 11, 21, 19, 0);
        const returnedAt = engine.makeVnDate(2026, 11, 21, 19, 0);
        const schedule = { weeklyOffDays: [0] }; // Sunday closed
        const avail = engine.calculateReturnAvailableFrom(
          rentalTo,
          returnedAt,
          2,
          schedule,
        );
        const parts = engine.getVnParts(avail);
        // 19:00-21:00 on Sat uses 2h. Sun is skipped. Mon 07:00 + 2h = Mon 09:00.
        expect(parts.dateStr).toBe('2026-11-23'); // Monday
        expect(parts.hour).toBe(9);
        expect(parts.minute).toBe(0);
      });

      it('rolls over SPECIFIC_DATE off-day to the next working day', () => {
        // Monday 2026-11-16 19:00 with K=2 (4 hours). Tuesday 2026-11-17 is holiday off-day.
        const rentalTo = engine.makeVnDate(2026, 11, 16, 19, 0);
        const returnedAt = engine.makeVnDate(2026, 11, 16, 19, 0);
        const schedule = { offDays: ['2026-11-17'] }; // Tuesday closed
        const avail = engine.calculateReturnAvailableFrom(
          rentalTo,
          returnedAt,
          2,
          schedule,
        );
        const parts = engine.getVnParts(avail);
        // 19:00-21:00 on Mon uses 2h. Tue 2026-11-17 is skipped. Wed 2026-11-18 07:00 + 2h = 09:00.
        expect(parts.dateStr).toBe('2026-11-18'); // Wednesday
        expect(parts.hour).toBe(9);
        expect(parts.minute).toBe(0);
      });
    });
  });
});
