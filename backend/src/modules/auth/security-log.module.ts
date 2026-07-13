import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  AdminAuditLog,
  AdminAuditLogSchema,
} from './schemas/admin-audit-log.schema';
import {
  SecurityEvent,
  SecurityEventSchema,
} from './schemas/security-event.schema';
import { SecurityLogService } from './services/security-log.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AdminAuditLog.name, schema: AdminAuditLogSchema },
      { name: SecurityEvent.name, schema: SecurityEventSchema },
    ]),
  ],
  providers: [SecurityLogService],
  exports: [SecurityLogService],
})
export class SecurityLogModule {}
