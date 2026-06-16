import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditLog, AuditLogSchema } from './schemas/audit-log.schema';

export const auditModels = MongooseModule.forFeature([
  { name: AuditLog.name, schema: AuditLogSchema },
]);

@Module({
  imports: [auditModels],
  exports: [auditModels],
})
export class AuditModule {}
