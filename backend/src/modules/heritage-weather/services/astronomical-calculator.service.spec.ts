import { AstronomicalCalculatorService } from './astronomical-calculator.service';

describe('AstronomicalCalculatorService', () => {
  let service: AstronomicalCalculatorService;

  beforeEach(() => {
    service = new AstronomicalCalculatorService();
  });

  it('should calculate sun phases for Huế coordinates with sunrise and sunset', () => {
    const testDate = new Date('2026-11-12T12:00:00+07:00');
    const phases = service.calculateSunPhases(16.4637, 107.5909, testDate);

    expect(phases.sunrise).toBeDefined();
    expect(phases.sunset).toBeDefined();

    // Morning golden hour starts before sunrise and ends after sunrise
    expect(phases.goldenHourMorning.start.getTime()).toBeLessThan(
      phases.sunrise.getTime(),
    );
    expect(phases.goldenHourMorning.end.getTime()).toBeGreaterThan(
      phases.sunrise.getTime(),
    );

    // Evening golden hour starts before sunset and ends after sunset
    expect(phases.goldenHourEvening.start.getTime()).toBeLessThan(
      phases.sunset.getTime(),
    );
    expect(phases.goldenHourEvening.end.getTime()).toBeGreaterThan(
      phases.sunset.getTime(),
    );

    // Blue hours precede morning golden hour and follow evening golden hour
    expect(phases.blueHourMorning.start.getTime()).toBeLessThan(
      phases.goldenHourMorning.start.getTime(),
    );
    expect(phases.blueHourEvening.end.getTime()).toBeGreaterThan(
      phases.goldenHourEvening.end.getTime(),
    );
  });

  it('should correctly identify golden hour timestamps', () => {
    const testDate = new Date('2026-11-12T12:00:00+07:00');
    const phases = service.calculateSunPhases(16.4637, 107.5909, testDate);

    // Midpoint of evening golden hour
    const midGoldenEvening = new Date(
      (phases.goldenHourEvening.start.getTime() +
        phases.goldenHourEvening.end.getTime()) /
        2,
    );
    expect(service.isGoldenHour(midGoldenEvening)).toBe(true);

    // Noon timestamp (12:00) should NOT be golden hour
    const noon = new Date('2026-11-12T12:00:00+07:00');
    expect(service.isGoldenHour(noon)).toBe(false);
  });

  it('should correctly identify blue hour timestamps', () => {
    const testDate = new Date('2026-11-12T12:00:00+07:00');
    const phases = service.calculateSunPhases(16.4637, 107.5909, testDate);

    // Midpoint of evening blue hour
    const midBlueEvening = new Date(
      (phases.blueHourEvening.start.getTime() +
        phases.blueHourEvening.end.getTime()) /
        2,
    );
    expect(service.isBlueHour(midBlueEvening)).toBe(true);
    expect(service.isGoldenHour(midBlueEvening)).toBe(false);
  });
});
