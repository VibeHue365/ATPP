import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron } from '@nestjs/schedule';
import {
  ProposalStatus,
  WeatherProposal,
  WeatherProposalDocument,
} from '../schemas/weather-proposal.schema';
import {
  Booking,
  BookingDocument,
} from '../../bookings/schemas/booking.schema';
import { RedisService } from '../../../common/redis/redis.service';

@Injectable()
export class WeatherProposalSupervisorService {
  private readonly logger = new Logger(WeatherProposalSupervisorService.name);

  constructor(
    @InjectModel(WeatherProposal.name)
    private readonly proposalModel: Model<WeatherProposalDocument>,
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Supervisor runs every minute to sweep expired proposals and release held slots.
   */
  @Cron('0 */1 * * * *')
  async sweepExpiredProposals(): Promise<number> {
    const now = new Date();
    let expiredCount = 0;

    try {
      // 1. Expire PENDING proposals whose proposalExpiresAt has passed
      const expiredPending = await this.proposalModel.find({
        status: ProposalStatus.PENDING,
        proposalExpiresAt: { $lt: now },
      });

      for (const proposal of expiredPending) {
        proposal.status = ProposalStatus.EXPIRED;
        if (proposal.temporaryHoldRef) {
          await this.redisService.del(proposal.temporaryHoldRef);
        }

        await this.bookingModel.updateOne(
          { _id: proposal.bookingId },
          {
            $set: {
              hasPendingWeatherAction: false,
              activeWeatherProposalId: null,
              disputeDeferredUntil: null,
            },
          },
        );

        await proposal.save();
        expiredCount++;
        this.logger.log(
          `Supervisor marked proposal ${proposal._id} as EXPIRED (Proposal TTL passed).`,
        );
      }

      // 2. Expire APPROVED_PENDING_PAYMENT proposals whose paymentExpiresAt has passed
      const expiredPayments = await this.proposalModel.find({
        status: ProposalStatus.APPROVED_PENDING_PAYMENT,
        paymentExpiresAt: { $lt: now },
      });

      for (const proposal of expiredPayments) {
        proposal.status = ProposalStatus.EXPIRED;
        if (proposal.temporaryHoldRef) {
          await this.redisService.del(proposal.temporaryHoldRef);
        }

        await this.bookingModel.updateOne(
          { _id: proposal.bookingId },
          {
            $set: {
              hasPendingWeatherAction: false,
              activeWeatherProposalId: null,
              disputeDeferredUntil: null,
            },
          },
        );

        await proposal.save();
        expiredCount++;
        this.logger.log(
          `Supervisor marked proposal ${proposal._id} as EXPIRED (Payment TTL passed).`,
        );
      }
    } catch (error: any) {
      this.logger.error(
        `Error in sweepExpiredProposals: ${error?.message}`,
        error,
      );
    }

    return expiredCount;
  }
}
