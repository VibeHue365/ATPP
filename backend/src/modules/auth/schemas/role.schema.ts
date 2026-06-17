import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type RoleDocument = HydratedDocument<Role>;

export enum RoleStatus {
  Active = 'ACTIVE',
  Inactive = 'INACTIVE',
}

@Schema({ collection: 'roles', timestamps: true })
export class Role {
  @Prop({
    required: true,
    unique: true,
    index: true,
    trim: true,
    uppercase: true,
  })
  code: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: String, default: null, trim: true })
  description?: string | null;

  @Prop({ type: [String], default: [] })
  permissions: string[];

  @Prop({ enum: RoleStatus, default: RoleStatus.Active, index: true })
  status: RoleStatus;
}

export const RoleSchema = SchemaFactory.createForClass(Role);
