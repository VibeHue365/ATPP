import { Injectable } from '@nestjs/common';
import { HeritageSpotSpaceType } from '../schemas/heritage-spot.schema';
import { AstronomicalCalculatorService } from './astronomical-calculator.service';
import { HourlyWeatherMetric } from './open-meteo-client.service';

export interface HourlyScoredWeather extends HourlyWeatherMetric {
  isGoldenHour: boolean;
  isBlueHour: boolean;
  hourlyScore: number;
  isRedAlert: boolean;
  overlapMinutes?: number;
}

export type WeatherConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface SlotAssessmentResult {
  date: string;
  timeSlot: string;
  spaceType: HeritageSpotSpaceType;
  slotScore: number;
  isRedAlert: boolean;
  confidence: WeatherConfidence;
  advisoryTitle: string;
  recommendation: string;
  hourlyBreakdown: HourlyScoredWeather[];
  canRescheduleFree: boolean;
}

@Injectable()
export class HeritageScoringService {
  constructor(
    private readonly astronomicalService: AstronomicalCalculatorService,
  ) {}

  /**
   * Calculates ShootScore [0.0 - 10.0] for a single hour based on weather metrics and space type.
   * Conforms strictly to PO Invariant Issue 06 (INDOOR_STUDIO = 10.0/10) and TDD-01.
   */
  calculateHourlyScore(
    metric: HourlyWeatherMetric,
    spaceType: HeritageSpotSpaceType,
    isGoldenHour: boolean,
    isBlueHour: boolean,
  ): number {
    // 1. Phim trường trong nhà (INDOOR_STUDIO): Không chịu tác động thời tiết
    if (spaceType === HeritageSpotSpaceType.INDOOR_STUDIO) {
      return 10.0;
    }

    let penalty = 0.0;
    let bonus = 0.0;

    // 2. Điểm trừ Mưa tức thời (Precipitation)
    if (metric.precipitationMm >= 2.0) {
      penalty += spaceType === HeritageSpotSpaceType.OUTDOOR ? 6.0 : 3.0;
    } else if (metric.precipitationMm >= 0.5) {
      penalty += spaceType === HeritageSpotSpaceType.OUTDOOR ? 3.0 : 1.5;
    } else if (metric.precipitationMm >= 0.1) {
      penalty += spaceType === HeritageSpotSpaceType.OUTDOOR ? 1.5 : 0.5;
    }

    // 3. Điểm trừ Xác suất mưa (POP)
    if (metric.precipitationProbability >= 70) {
      penalty += spaceType === HeritageSpotSpaceType.OUTDOOR ? 3.0 : 1.5;
    } else if (metric.precipitationProbability >= 50) {
      penalty += spaceType === HeritageSpotSpaceType.OUTDOOR ? 1.5 : 0.5;
    } else if (metric.precipitationProbability >= 30) {
      penalty += spaceType === HeritageSpotSpaceType.OUTDOOR ? 0.5 : 0.0;
    }

    // 4. Điểm trừ Giông sét (Thunderstorm WMO 95-99)
    if (metric.weatherCode >= 95 && metric.weatherCode <= 99) {
      penalty += spaceType === HeritageSpotSpaceType.OUTDOOR ? 7.0 : 4.0;
    }

    // 5. Điểm trừ Nhiệt độ oi bức & UV (Apparent Temperature per TDD-01)
    const isHot = metric.apparentTemperature >= 34.0;
    const isHighUv = metric.uvIndex >= 8.0;
    if (isHot && isHighUv) {
      penalty += 2.0;
    } else if (isHot || isHighUv) {
      penalty += 1.0;
    }

    // 6. Điểm trừ Gió lớn (Wind Speed)
    if (metric.windSpeedKmH >= 35.0) {
      penalty += spaceType === HeritageSpotSpaceType.OUTDOOR ? 2.5 : 1.5;
    } else if (metric.windSpeedKmH >= 25.0) {
      penalty += spaceType === HeritageSpotSpaceType.OUTDOOR ? 1.0 : 0.5;
    }

    // 7. Điểm trừ Tích lũy Ẩm ướt / Bùn đất (Wet/Mud Accumulation)
    if (metric.past2hPrecipitationMm >= 10.0) {
      penalty += spaceType === HeritageSpotSpaceType.OUTDOOR ? 2.0 : 1.0;
    } else if (metric.past2hPrecipitationMm >= 3.0) {
      penalty += spaceType === HeritageSpotSpaceType.OUTDOOR ? 1.0 : 0.0;
    }

    // 8. Điểm cộng Khung giờ Vàng / Khung giờ Xanh (Chỉ cộng khi không mưa & không giông)
    const isCleanWeather =
      metric.precipitationMm < 0.1 &&
      (metric.weatherCode < 95 || metric.weatherCode > 99);
    if (isCleanWeather) {
      if (isGoldenHour) {
        bonus += spaceType === HeritageSpotSpaceType.OUTDOOR ? 1.0 : 0.5;
      } else if (isBlueHour) {
        bonus += spaceType === HeritageSpotSpaceType.OUTDOOR ? 0.5 : 0.25;
      }
    }

    // Clamping trong khoảng [0.0, 10.0]
    const finalScore = 10.0 - penalty + bonus;
    return Math.max(0.0, Math.min(10.0, Math.round(finalScore * 10) / 10));
  }

  /**
   * Checks if an individual hour qualifies as RED_ALERT under BR-WEATHER-01.
   * Indoor studio is immune (BR-WEATHER-02).
   */
  isHourRedAlert(
    metric: HourlyWeatherMetric,
    spaceType: HeritageSpotSpaceType,
  ): boolean {
    if (spaceType === HeritageSpotSpaceType.INDOOR_STUDIO) {
      return false;
    }
    return (
      metric.precipitationProbability >= 70 ||
      metric.precipitationMm >= 2.0 ||
      (metric.weatherCode >= 95 && metric.weatherCode <= 99)
    );
  }

  /**
   * Calculates DailyScore per AD-04:
   * Average of top 2 daytime hours within available operating range (07:00 - 18:00).
   * Fallback 1 hour = top 1, 0 hours = null (DATA_UNAVAILABLE).
   */
  calculateDailyScore(
    hourlyScores: { hour: number; score: number }[],
  ): number | null {
    const validDaytimeHours = hourlyScores.filter(
      (h) => h.hour >= 7 && h.hour <= 18,
    );

    if (validDaytimeHours.length === 0) {
      return null;
    }

    if (validDaytimeHours.length === 1) {
      return validDaytimeHours[0].score;
    }

    // Sắp xếp giảm dần theo điểm số
    validDaytimeHours.sort((a, b) => b.score - a.score);

    // AD-04: Lấy trung bình cộng của 2 giờ cao nhất
    const top1 = validDaytimeHours[0].score;
    const top2 = validDaytimeHours[1].score;
    const avg = (top1 + top2) / 2.0;

    return Math.round(avg * 10) / 10;
  }

  /**
   * Evaluates a multi-hour photography slot (e.g. "14:00-16:00" or "14:30-16:30").
   * Adheres to Worst-case RED_ALERT and weighted average ShootScore decisions.
   */
  assessTimeSlot(
    slotStr: string,
    slotDate: string,
    metrics: HourlyWeatherMetric[],
    spaceType: HeritageSpotSpaceType,
    lat?: number,
    lng?: number,
  ): SlotAssessmentResult {
    const parsed = this.parseTimeSlot(slotStr);
    const slotStartMinutes = parsed.startHour * 60 + parsed.startMinute;
    const slotEndMinutes = parsed.endHour * 60 + parsed.endMinute;
    const totalSlotMinutes = Math.max(1, slotEndMinutes - slotStartMinutes);

    // Filter metrics for the target date
    const dateMetrics = metrics.filter((m) => {
      const d = m.hourTimestamp;
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}` === slotDate;
    });

    const hourlyBreakdown: HourlyScoredWeather[] = [];

    for (const metric of dateMetrics) {
      const hour = metric.hourTimestamp.getHours();
      const hourStartMinutes = hour * 60;
      const hourEndMinutes = (hour + 1) * 60;

      // Calculate overlap with slot
      const overlapStart = Math.max(slotStartMinutes, hourStartMinutes);
      const overlapEnd = Math.min(slotEndMinutes, hourEndMinutes);

      if (overlapEnd > overlapStart) {
        const overlapMinutes = overlapEnd - overlapStart;
        const isGolden = this.astronomicalService.isGoldenHour(
          metric.hourTimestamp,
          lat,
          lng,
        );
        const isBlue = this.astronomicalService.isBlueHour(
          metric.hourTimestamp,
          lat,
          lng,
        );
        const score = this.calculateHourlyScore(
          metric,
          spaceType,
          isGolden,
          isBlue,
        );
        const redAlert = this.isHourRedAlert(metric, spaceType);

        hourlyBreakdown.push({
          ...metric,
          isGoldenHour: isGolden,
          isBlueHour: isBlue,
          hourlyScore: score,
          isRedAlert: redAlert,
          overlapMinutes,
        });
      }
    }

    // 1. Worst-case RED_ALERT decision: Any intersecting hour triggers RED_ALERT
    const isRedAlert = hourlyBreakdown.some((h) => h.isRedAlert);

    // 2. Slot ShootScore:
    // If RED_ALERT => minimum score of intersecting hours
    // Else => weighted average based on overlap duration
    let slotScore = 10.0;
    if (hourlyBreakdown.length > 0) {
      if (isRedAlert) {
        slotScore = Math.min(...hourlyBreakdown.map((h) => h.hourlyScore));
      } else {
        const weightedSum = hourlyBreakdown.reduce(
          (sum, h) => sum + h.hourlyScore * (h.overlapMinutes ?? 60),
          0,
        );
        slotScore = Math.round((weightedSum / totalSlotMinutes) * 10) / 10;
      }
    }

    // 3. Confidence Level per BR-WEATHER-04
    const confidence = this.computeConfidence(slotDate);

    // 4. Recommendation text
    const { advisoryTitle, recommendation } = this.generateAdvisory(
      slotScore,
      isRedAlert,
      spaceType,
    );

    return {
      date: slotDate,
      timeSlot: slotStr,
      spaceType,
      slotScore,
      isRedAlert,
      confidence,
      advisoryTitle,
      recommendation,
      hourlyBreakdown,
      canRescheduleFree: isRedAlert,
    };
  }

  /**
   * Parses time slot string (e.g. "09:00-11:00", "14:30-16:30")
   */
  parseTimeSlot(slotStr: string): {
    startHour: number;
    startMinute: number;
    endHour: number;
    endMinute: number;
    totalMinutes: number;
  } {
    const defaultRes = {
      startHour: 9,
      startMinute: 0,
      endHour: 11,
      endMinute: 0,
      totalMinutes: 120,
    };

    if (!slotStr || !slotStr.includes('-')) return defaultRes;

    try {
      const [startPart, endPart] = slotStr.split('-');
      const [sH, sM] = startPart.split(':').map((v) => parseInt(v, 10));
      const [eH, eM] = endPart.split(':').map((v) => parseInt(v, 10));

      const startHour = isNaN(sH) ? 9 : sH;
      const startMinute = isNaN(sM) ? 0 : sM;
      const endHour = isNaN(eH) ? 11 : eH;
      const endMinute = isNaN(eM) ? 0 : eM;

      const totalMinutes =
        endHour * 60 + endMinute - (startHour * 60 + startMinute);

      return {
        startHour,
        startMinute,
        endHour,
        endMinute,
        totalMinutes: totalMinutes > 0 ? totalMinutes : 120,
      };
    } catch {
      return defaultRes;
    }
  }

  private computeConfidence(slotDate: string): WeatherConfidence {
    const target = new Date(`${slotDate}T12:00:00+07:00`).getTime();
    const now = Date.now();
    const diffHours = (target - now) / (1000 * 60 * 60);

    if (diffHours <= 24) return 'HIGH';
    if (diffHours <= 72) return 'MEDIUM';
    return 'LOW';
  }

  private generateAdvisory(
    score: number,
    isRedAlert: boolean,
    spaceType: HeritageSpotSpaceType,
  ): { advisoryTitle: string; recommendation: string } {
    if (isRedAlert) {
      return {
        advisoryTitle: 'Cảnh báo Thời tiết Xấu (RED_ALERT)',
        recommendation:
          'Khung giờ có nguy cơ mưa lớn hoặc dông sét. Hệ thống kích hoạt chính sách bảo vệ thời tiết miễn phí. Khuyến nghị quý khách chọn Phương án B (đổi sang địa điểm có mái che / phim trường trong nhà hoặc dời lịch).',
      };
    }

    if (spaceType === HeritageSpotSpaceType.INDOOR_STUDIO) {
      return {
        advisoryTitle: 'Không gian Phim trường Trong nhà',
        recommendation:
          'Buổi chụp được thực hiện trong nhà với hệ thống ánh sáng chuyên nghiệp, hoàn toàn không bị ảnh hưởng bởi thời tiết bên ngoài.',
      };
    }

    if (score >= 8.5) {
      return {
        advisoryTitle: 'Điều kiện Chụp ảnh Tuyệt vời',
        recommendation:
          'Ánh sáng và thời tiết rất thuận lợi để lưu giữ khoảnh khắc trang phục truyền thống tại di tích Huế.',
      };
    }

    if (score >= 6.5) {
      return {
        advisoryTitle: 'Điều kiện Chụp ảnh Khá tốt',
        recommendation:
          'Thời tiết tương đối ổn định. Nên chuẩn bị thêm ô che nắng hoặc quạt cầm tay nếu thời tiết oi bức.',
      };
    }

    return {
      advisoryTitle: 'Thời tiết Kém thuận lợi',
      recommendation:
        'Thời tiết có mây mù, gió hoặc khả năng mưa nhẹ. Hãy cân nhắc mang thêm phụ kiện chống ẩm hoặc chọn góc chụp dưới mái hiên di tích.',
    };
  }
}
