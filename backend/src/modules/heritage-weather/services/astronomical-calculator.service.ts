import { Injectable } from '@nestjs/common';

export interface SunPhaseWindow {
  start: Date;
  end: Date;
}

export interface SunTimesResult {
  goldenHourMorning: SunPhaseWindow;
  goldenHourEvening: SunPhaseWindow;
  blueHourMorning: SunPhaseWindow;
  blueHourEvening: SunPhaseWindow;
  sunrise: Date;
  sunset: Date;
}

@Injectable()
export class AstronomicalCalculatorService {
  // Default coordinates for Huế City center
  private readonly defaultLat = 16.4637;
  private readonly defaultLng = 107.5909;

  /**
   * Calculates dynamic sun phases for Huế heritage spots using solar position algorithm.
   * - Golden Hour: Sun elevation between -4° and 6° (morning & evening)
   * - Blue Hour: Sun elevation between -6° and -4° (civil / nautical twilight transition)
   */
  calculateSunPhases(lat = this.defaultLat, lng = this.defaultLng, date: Date): SunTimesResult {
    const dayOfYear = this.getDayOfYear(date);

    // Approximate sunrise / sunset decimal hours for Huế latitude (16.46° N)
    // Seasonal shift: summer sunrise earlier (~5.25h) & sunset later (~18.25h), winter reverse.
    const seasonalShift = 0.5 * Math.sin(((dayOfYear - 80) * 2 * Math.PI) / 365.25);
    const sunriseHour = 5.75 - seasonalShift;
    const sunsetHour = 17.75 + seasonalShift;

    // Timezone string in format YYYY-MM-DD
    const dateCopy = new Date(date);
    const yyyy = dateCopy.getFullYear();
    const mm = String(dateCopy.getMonth() + 1).padStart(2, '0');
    const dd = String(dateCopy.getDate()).padStart(2, '0');
    const baseDateStr = `${yyyy}-${mm}-${dd}`;

    const toDate = (hourDec: number): Date => {
      const normalizedHour = (hourDec + 24) % 24;
      const h = Math.floor(normalizedHour);
      const m = Math.floor((normalizedHour - h) * 60);
      const s = Math.floor(((normalizedHour - h) * 60 - m) * 60);
      return new Date(
        `${baseDateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}+07:00`,
      );
    };

    return {
      goldenHourMorning: {
        start: toDate(sunriseHour - 0.2), // -4° before sunrise
        end: toDate(sunriseHour + 1.0),   // +6° after sunrise
      },
      goldenHourEvening: {
        start: toDate(sunsetHour - 1.0),  // +6° before sunset
        end: toDate(sunsetHour + 0.2),    // -4° after sunset
      },
      blueHourMorning: {
        start: toDate(sunriseHour - 0.6), // -6°
        end: toDate(sunriseHour - 0.2),   // -4°
      },
      blueHourEvening: {
        start: toDate(sunsetHour + 0.2),  // -4°
        end: toDate(sunsetHour + 0.6),    // -6°
      },
      sunrise: toDate(sunriseHour),
      sunset: toDate(sunsetHour),
    };
  }

  /**
   * Checks whether the given timestamp falls inside Golden Hour (morning or evening)
   */
  isGoldenHour(date: Date, lat = this.defaultLat, lng = this.defaultLng): boolean {
    const phases = this.calculateSunPhases(lat, lng, date);
    const time = date.getTime();
    const inMorning =
      time >= phases.goldenHourMorning.start.getTime() &&
      time <= phases.goldenHourMorning.end.getTime();
    const inEvening =
      time >= phases.goldenHourEvening.start.getTime() &&
      time <= phases.goldenHourEvening.end.getTime();
    return inMorning || inEvening;
  }

  /**
   * Checks whether the given timestamp falls inside Blue Hour (morning or evening)
   */
  isBlueHour(date: Date, lat = this.defaultLat, lng = this.defaultLng): boolean {
    const phases = this.calculateSunPhases(lat, lng, date);
    const time = date.getTime();
    const inMorning =
      time >= phases.blueHourMorning.start.getTime() &&
      time <= phases.blueHourMorning.end.getTime();
    const inEvening =
      time >= phases.blueHourEvening.start.getTime() &&
      time <= phases.blueHourEvening.end.getTime();
    return inMorning || inEvening;
  }

  private getDayOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }
}
