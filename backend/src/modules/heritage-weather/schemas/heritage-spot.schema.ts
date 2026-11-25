import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type HeritageSpotDocument = HydratedDocument<HeritageSpot>;

export enum HeritageSpotSpaceType {
  OUTDOOR = 'OUTDOOR', // Ngoài trời: Đại Nội, Lăng Tự Đức, Đồi Vọng Cảnh
  SEMI_INDOOR = 'SEMI_INDOOR', // Bán trong nhà/Mái che: Cung Diên Thọ, Cung An Định, Lăng Khải Định
  INDOOR_STUDIO = 'INDOOR_STUDIO', // Phim trường/Studio kín: Phim trường Cổ Trang Cố Đô
}

export interface GeoJSONPoint {
  type: 'Point';
  coordinates: [number, number]; // [Kinh độ (Longitude), Vĩ độ (Latitude)]
}

@Schema({ collection: 'heritage_spots', timestamps: true })
export class HeritageSpot {
  @Prop({ required: true, trim: true, unique: true, index: true })
  name: string;

  @Prop({ required: true, trim: true, unique: true, index: true })
  slug: string;

  @Prop({
    type: String,
    enum: Object.values(HeritageSpotSpaceType),
    required: true,
    index: true,
  })
  spaceType: HeritageSpotSpaceType;

  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [lng, lat]
      required: true,
    },
  })
  location: GeoJSONPoint;

  @Prop({ required: true, trim: true })
  address: string;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({
    type: {
      openTime: { type: String, required: true },
      closeTime: { type: String, required: true },
    },
    required: true,
  })
  operatingHours: {
    openTime: string;
    closeTime: string;
  };

  @Prop({ type: Number, default: 0 })
  standardAdmissionFee: number; // Giá vé tham khảo tại quầy vé

  @Prop({ type: Number, default: 0 })
  baseTravelFee: number; // Mức phụ phí di chuyển tiêu chuẩn tính từ trung tâm TP Huế (VNĐ per AD-01)

  @Prop({ type: [String], default: [] })
  bestOutfitCategories: string[];

  @Prop({ type: [String], default: [] })
  samplePhotos: string[];

  @Prop({ type: String, default: null, trim: true })
  description?: string;

  @Prop({ type: Boolean, default: true, index: true })
  isActive: boolean;
}

export const HeritageSpotSchema = SchemaFactory.createForClass(HeritageSpot);

// Chỉ mục địa không gian 2D Sphere bắt buộc cho các truy vấn tìm điểm chụp gần nhất
HeritageSpotSchema.index({ location: '2dsphere' });
