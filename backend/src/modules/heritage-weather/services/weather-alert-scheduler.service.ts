import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import {
  BookingSchedule,
  BookingScheduleDocument,
  BookingScheduleStatus,
  BookingScheduleType,
} from '../../bookings/schemas/booking-schedule.schema';
import {
  Booking,
  BookingDocument,
  BookingStatus,
} from '../../bookings/schemas/booking.schema';
import {
  Notification,
  NotificationDocument,
} from '../../notifications/schemas/notification.schema';
import { HeritageSpotSpaceType } from '../schemas/heritage-spot.schema';
import { OpenMeteoClientService } from './open-meteo-client.service';
import { HeritageScoringService } from './heritage-scoring.service';
import { WeatherNotificationService } from './weather-notification.service';

@Injectable()
export class WeatherAlertSchedulerService {
  private readonly logger = new Logger(WeatherAlertSchedulerService.name);
  private isScanning = false;

  constructor(
    @InjectModel(BookingSchedule.name)
    private readonly scheduleModel: Model<BookingScheduleDocument>,
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    private readonly openMeteoService: OpenMeteoClientService,
    private readonly scoringService: HeritageScoringService,
    private readonly weatherNotificationService: WeatherNotificationService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Cron job runs every 30 minutes to scan upcoming bookings at T-24h and T-3h milestones.
   * If adverse weather (RED_ALERT) is detected, proactively sends notifications and socket alerts.
   */
  @Cron('0 */30 * * * *')
  async scanWeatherAlerts(): Promise<{ t24Count: number; t3Count: number }> {
    const isEnabled = this.configService.get<string>(
      'FEATURE_WEATHER_ADVISOR_ENABLED',
      'true',
    );
    if (isEnabled === 'false') {
      this.logger.debug('Weather advisor feature flag is disabled. Skipping scan.');
      return { t24Count: 0, t3Count: 0 };
    }

    if (this.isScanning) {
      this.logger.debug('Previous weather alert scan still running. Skipping.');
      return { t24Count: 0, t3Count: 0 };
    }

    this.isScanning = true;
    let t24Count = 0;
    let t3Count = 0;

    try {
      const now = Date.now();

      // Window T-24h: photoshoot starts in [23h, 25h]
      const t24Start = new Date(now + 23 * 60 * 60 * 1000);
      const t24End = new Date(now + 25 * 60 * 60 * 1000);

      // Window T-3h: photoshoot starts in [2.5h, 3.5h]
      const t3Start = new Date(now + 2.5 * 60 * 60 * 1000);
      const t3End = new Date(now + 3.5 * 60 * 60 * 1000);

      t24Count = await this.processMilestoneWindow(t24Start, t24End, 'T-24h');
      t3Count = await this.processMilestoneWindow(t3Start, t3End, 'T-3h');

      if (t24Count > 0 || t3Count > 0) {
        this.logger.log(
          `Weather alert scan completed: ${t24Count} alert(s) sent at T-24h, ${t3Count} alert(s) sent at T-3h.`,
        );
      }
    } catch (err: any) {
      this.logger.error(`Error in scanWeatherAlerts: ${err?.message}`, err);
    } finally {
      this.isScanning = false;
    }

    return { t24Count, t3Count };
  }

  /**
   * Scans a specific time window for photoshoots and evaluates RED_ALERT
   */
  async processMilestoneWindow(
    windowStart: Date,
    windowEnd: Date,
    milestone: 'T-24h' | 'T-3h',
  ): Promise<number> {
    const schedules = await this.scheduleModel
      .find({
        scheduleType: BookingScheduleType.Photoshoot,
        status: {
          $in: [
            BookingScheduleStatus.Confirmed,
            BookingScheduleStatus.Scheduled,
          ],
        },
        startsAt: { $gte: windowStart, $lte: windowEnd },
      })
      .exec();

    let alertsSent = 0;

    for (const schedule of schedules) {
      try {
        const booking = await this.bookingModel.findById(schedule.bookingId);
        if (!booking) continue;

        // Only active bookings
        const allowedStatuses: BookingStatus[] = [
          BookingStatus.Confirmed,
          BookingStatus.DepositPaid,
        ];
        if (!allowedStatuses.includes(booking.status)) continue;

        // Skip if booking already has a pending weather action (proposal or cancellation)
        if (booking.hasPendingWeatherAction) continue;

        // Deduplication (Issue 12): Check if notification for this booking at this milestone was already sent
        const alreadySent = await this.notificationModel.findOne({
          userId: booking.customerId,
          'metadata.bookingId': booking._id.toString(),
          'metadata.milestone': milestone,
        });

        if (alreadySent) {
          continue;
        }

        // Coordinates & Space Type resolution
        let lat = 16.4637;
        let lng = 107.5909;
        const spaceType = HeritageSpotSpaceType.OUTDOOR;

        if (
          schedule.locationSnapshot?.geo?.coordinates &&
          Array.isArray(schedule.locationSnapshot.geo.coordinates) &&
          schedule.locationSnapshot.geo.coordinates.length >= 2
        ) {
          lng = schedule.locationSnapshot.geo.coordinates[0];
          lat = schedule.locationSnapshot.geo.coordinates[1];
        }

        const shootDateStr =
          schedule.providerLocalDate ||
          (schedule.startsAt ? new Date(schedule.startsAt).toISOString().split('T')[0] : '');
        const timeSlot = schedule.timeSlot || '09:00 - 11:00';
        const spotName = schedule.locationAddress || 'Di tích Huế';

        // Fetch Weather Metrics
        const metrics = await this.openMeteoService.getHourlyMetrics(lat, lng);
        const assessment = this.scoringService.assessTimeSlot(
          timeSlot,
          shootDateStr,
          metrics,
          spaceType,
          lat,
          lng,
        );

        if (assessment.isRedAlert) {
          await this.weatherNotificationService.sendWeatherRedAlert({
            booking,
            shootDate: shootDateStr,
            timeSlot,
            milestone,
            reason:
              assessment.recommendation ||
              'Dự báo có mưa to hoặc dông sét vượt ngưỡng an toàn',
            spotName,
            planBUrl: `/bookings/${booking._id.toString()}/plan-b`,
          });
          alertsSent++;
        }
      } catch (scheduleErr: any) {
        this.logger.warn(
          `Failed to process weather scan for schedule ${schedule._id}: ${scheduleErr?.message}`,
        );
      }
    }

    return alertsSent;
  }
}
