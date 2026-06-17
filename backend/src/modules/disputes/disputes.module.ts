import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Dispute, DisputeSchema } from './schemas/dispute.schema';

export const disputeModels = MongooseModule.forFeature([
  { name: Dispute.name, schema: DisputeSchema },
]);

@Module({
  imports: [disputeModels],
  exports: [disputeModels],
})
export class DisputesModule {}
