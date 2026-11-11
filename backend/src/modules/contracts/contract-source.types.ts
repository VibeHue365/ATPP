import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Connection, Types } from 'mongoose';

export interface BookingSource {
  _id: Types.ObjectId;
  bookingCode: string;
  bookingType: 'AODAI_RENTAL' | 'COMBO' | 'PHOTOGRAPHY';
  status: string;
  contractFlowVersion?: 2 | null;
  customerId: Types.ObjectId;
  providerIds: Types.ObjectId[];
  pricingSummary: Record<string, number>;
  voucherSnapshot?: Record<string, unknown> | null;
  holdExpiresAt?: Date | null;
  updatedAt?: Date;
}

export interface RentalItemSource {
  _id: Types.ObjectId;
  bookingId: Types.ObjectId;
  providerId: Types.ObjectId;
  itemType: string;
  productId?: Types.ObjectId | null;
  priceVersionId: Types.ObjectId;
  unitPrice: number;
  depositAmount: number;
  replacementValue?: number | null;
  quantity: number;
  rentalFrom?: Date | null;
  rentalTo?: Date | null;
  selectedSize?: string | null;
  selectedColor?: string | null;
  pickupReturnLocationSnapshot?: Record<string, unknown> | null;
  comboDiscountAmount?: number;
  shopVoucherDiscountAmount?: number;
  platformVoucherDiscountAmount?: number;
  priceBreakdown?: Record<string, unknown>[];
  updatedAt?: Date;
}

export function contractDb(connection: Connection) {
  if (!connection.db)
    throw new ServiceUnavailableException('CONTRACT_DB_UNAVAILABLE');
  return connection.db;
}

export function contractObjectId(id: string | Types.ObjectId): Types.ObjectId {
  if (id instanceof Types.ObjectId) return id;
  if (!id || typeof id !== 'string' || !Types.ObjectId.isValid(id))
    throw new BadRequestException('INVALID_CONTRACT_ID');
  return new Types.ObjectId(id);
}

export function sameContractId(
  left: Types.ObjectId,
  right: Types.ObjectId,
): boolean {
  return left.toString() === right.toString();
}

/**
 * Strict validator and normalizer for product replacement value (Giá trị bồi hoàn).
 * - Accepts strictly positive finite integers: number > 0.
 * - Accepts strictly validated numeric strings: e.g. "200000" or formatted "200.000".
 * - Strictly REJECTS: null, undefined, empty string, zero, negative numbers,
 *   NaN, Infinity, strings with non-digits (e.g. "abc", "200k", "-100", "0").
 * - Does NOT allow bypassing Contract Guard under any circumstances.
 */
export function parseValidReplacementValue(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return null;
    const rounded = Math.round(value);
    return rounded > 0 ? rounded : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    // Reject explicitly invalid numbers: negative, zero, non-digits, NaN, Infinity
    if (trimmed === '0' || trimmed.startsWith('-')) return null;

    // Pattern 1: Pure digits positive integer (e.g. "200000")
    if (/^[1-9]\d*$/.test(trimmed)) {
      const num = Number(trimmed);
      return Number.isFinite(num) && num > 0 ? Math.round(num) : null;
    }

    // Pattern 2: VND formatted with thousand dots (e.g. "200.000", "2.000.000")
    if (/^[1-9]\d{0,2}(\.\d{3})+$/.test(trimmed)) {
      const unformatted = trimmed.replace(/\./g, '');
      const num = Number(unformatted);
      return Number.isFinite(num) && num > 0 ? Math.round(num) : null;
    }
  }

  return null;
}
