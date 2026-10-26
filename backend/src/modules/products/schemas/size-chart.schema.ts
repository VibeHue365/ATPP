import { Schema as MongoSchema, Types } from 'mongoose';
import {
  ChartSource,
  MeasurementType,
  MeasurementKey,
  SizeChartRowDto,
  GarmentFitRuleDto,
  StretchAllowanceDto,
} from '../dto/size-chart.dto';

export interface SizeChart {
  version: number;
  sourceRevision: number;
  source: ChartSource;
  measurementType: MeasurementType;
  lengthUnit: 'CM' | 'IN';
  weightUnit: 'KG' | 'LB';
  imageUrl?: string;
  rows: SizeChartRowDto[];
  requiredMeasurements: Array<Exclude<MeasurementKey, 'length'>>;
  fitRules: GarmentFitRuleDto[];
  stretchAllowanceCm?: StretchAllowanceDto;
  status: 'DRAFT' | 'CONFIRMED';
  confirmedBy?: Types.ObjectId;
  confirmedAt?: Date;
}

const range = new MongoSchema(
  {
    min: { type: Number, required: true },
    max: { type: Number, required: true },
  },
  { _id: false },
);
const row = new MongoSchema(
  {
    size: { type: String, required: true },
    chest: range,
    waist: range,
    hip: range,
    shoulder: range,
    bicep: range,
    height: range,
    weight: range,
    length: range,
  },
  { _id: false },
);
const fit = new MongoSchema(
  {
    preference: {
      type: String,
      enum: ['SLIM', 'REGULAR', 'COMFORT'],
      required: true,
    },
    chest: range,
    waist: range,
    hip: range,
    shoulder: range,
    bicep: range,
  },
  { _id: false },
);
export const SizeChartSchema = new MongoSchema(
  {
    version: { type: Number, required: true },
    sourceRevision: { type: Number, required: true },
    source: { type: String, enum: Object.values(ChartSource), required: true },
    measurementType: {
      type: String,
      enum: Object.values(MeasurementType),
      required: true,
    },
    lengthUnit: { type: String, enum: ['CM', 'IN'], required: true },
    weightUnit: { type: String, enum: ['KG', 'LB'], required: true },
    imageUrl: String,
    rows: { type: [row], default: [] },
    requiredMeasurements: { type: [String], default: [] },
    fitRules: { type: [fit], default: [] },
    stretchAllowanceCm: { chest: Number, waist: Number, hip: Number, shoulder: Number, bicep: Number },
    status: { type: String, enum: ['DRAFT', 'CONFIRMED'], required: true },
    confirmedBy: { type: MongoSchema.Types.ObjectId, ref: 'User' },
    confirmedAt: Date,
  },
  { _id: false },
);
