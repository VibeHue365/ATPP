import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PermissionDocument = HydratedDocument<Permission>;

export enum PermissionStatus {
  Active = 'ACTIVE',
  Inactive = 'INACTIVE',
}

@Schema({ collection: 'permissions', timestamps: true })
export class Permission {
  @Prop({
    required: true,
    unique: true,
    index: true,
    trim: true,
  })
  code: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true, uppercase: true })
  module: string;

  @Prop({ type: String, default: null, trim: true })
  description?: string | null;

  @Prop({
    enum: PermissionStatus,
    default: PermissionStatus.Active,
    index: true,
  })
  status: PermissionStatus;
}

export const PermissionSchema = SchemaFactory.createForClass(Permission);
