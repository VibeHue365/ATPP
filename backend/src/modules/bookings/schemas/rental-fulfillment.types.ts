import { Types } from 'mongoose';

export enum TurnaroundStatus {
  None = 'NONE',
  Scheduled = 'SCHEDULED',
  InProgress = 'IN_PROGRESS',
  Releasing = 'RELEASING',
  Ready = 'READY',
  Blocked = 'BLOCKED',
}

export enum RentalFulfillmentStatus {
  Pending = 'PENDING',
  ReadyForPickup = 'READY_FOR_PICKUP',
  PickedUp = 'PICKED_UP',
  CustomerReturnRequested = 'CUSTOMER_RETURN_REQUESTED',
  Returned = 'RETURNED',
  Completed = 'COMPLETED',
  Cancelled = 'CANCELLED',
}

export enum RentalIssueStatus {
  None = 'NONE',
  Reported = 'REPORTED',
  UnderReview = 'UNDER_REVIEW',
  Resolved = 'RESOLVED',
}

export enum RentalInventoryStatus {
  Reserved = 'RESERVED',
  RentedOut = 'RENTED_OUT',
  ReturnedPendingInspection = 'RETURNED_PENDING_INSPECTION',
  Cleaning = 'CLEANING',
  Available = 'AVAILABLE',
  Maintenance = 'MAINTENANCE',
  Damaged = 'DAMAGED',
  Lost = 'LOST',
}

export enum DepositSettlementStatus {
  Held = 'HELD',
  PendingSettlement = 'PENDING_SETTLEMENT',
  FullyReleased = 'FULLY_RELEASED',
  PartiallyDeducted = 'PARTIALLY_DEDUCTED',
  FullyDeducted = 'FULLY_DEDUCTED',
}

export type RentalFulfillmentAction =
  | 'MARKED_READY'
  | 'PICKUP_EVIDENCE_SUBMITTED'
  | 'MARKED_PICKED_UP'
  | 'CUSTOMER_RETURN_REQUESTED'
  | 'MARKED_RETURNED'
  | 'MARKED_COMPLETED'
  | 'CANCELLED'
  | 'ISSUE_REPORTED'
  | 'ISSUE_UNDER_REVIEW'
  | 'ISSUE_RESOLVED'
  | 'CHARGE_PROPOSED'
  | 'CHARGE_APPROVED'
  | 'CHARGE_REJECTED'
  | 'DEPOSIT_SETTLED'
  | 'INVENTORY_UPDATED'
  | 'MIGRATED_FROM_LEGACY';

export interface RentalActorSnapshot {
  id: string;
  role: 'CUSTOMER' | 'PROVIDER' | 'ADMIN' | 'SYSTEM';
  displayName?: string;
}

export interface FulfillmentEvidence {
  files: Array<{
    fileId: string;
    type: 'IMAGE';
    uploadedAt: Date;
    uploadedBy: RentalActorSnapshot;
  }>;
  note?: string;
}

export interface RentalCharge {
  amount: number;
  status: 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'COLLECTED';
  reason: string;
  proposedBy: RentalActorSnapshot;
  proposedAt: Date;
  approvedBy?: RentalActorSnapshot;
  approvedAt?: Date;
}

export interface RentalFulfillmentHistory {
  action: RentalFulfillmentAction;
  fromStatus?: RentalFulfillmentStatus;
  toStatus?: RentalFulfillmentStatus;
  actor: RentalActorSnapshot;
  occurredAt: Date;
  note?: string;
  metadata?: Record<string, unknown>;
}

export interface RentalFulfillment {
  status: RentalFulfillmentStatus;
  pickupDueAt?: Date | null;
  returnDueAt: Date;
  readyAt?: Date | null;
  pickedUpAt?: Date | null;
  returnedAt?: Date | null;
  completedAt?: Date | null;
  cancelledAt?: Date | null;
  pickupEvidence?: FulfillmentEvidence | null;
  returnEvidence?: FulfillmentEvidence | null;
  customerReturnEvidence?: {
    files?: string[];
    returnedAt?: Date | null;
    note?: string | null;
  } | null;
  pickupConditionNote?: string | null;
  returnConditionNote?: string | null;
  issueStatus: RentalIssueStatus;
  inventoryStatus: RentalInventoryStatus;
  depositSettlementStatus: DepositSettlementStatus;
  /** Final amounts decided by Admin; used by the booking-level refund coordinator. */
  depositDeductedAmount: number;
  depositRefundAmount: number;
  charges: {
    lateFee?: RentalCharge;
    damageFee?: RentalCharge;
    compensationAmount?: RentalCharge;
  };
  history: RentalFulfillmentHistory[];

  /** Turnaround fields */
  turnaroundStatus: TurnaroundStatus;
  turnaroundSlotsSnapshot: number;
  slotLeaseRequired: boolean;
  cleaningStartedAt?: Date | null;
  availableFrom?: Date | null;
  cleaningExtendedUntil?: Date | null;
  handoverRiskStatus?: 'NONE' | 'OPEN' | 'RESOLVED';
  handoverRiskIncidentId?: Types.ObjectId | null;
}

export const createRentalFulfillment = (
  returnDueAt: Date,
  pickupDueAt: Date | null = null,
): RentalFulfillment => ({
  status: RentalFulfillmentStatus.Pending,
  pickupDueAt,
  returnDueAt,
  readyAt: null,
  pickedUpAt: null,
  returnedAt: null,
  completedAt: null,
  cancelledAt: null,
  pickupEvidence: null,
  returnEvidence: null,
  pickupConditionNote: null,
  returnConditionNote: null,
  issueStatus: RentalIssueStatus.None,
  inventoryStatus: RentalInventoryStatus.Reserved,
  depositSettlementStatus: DepositSettlementStatus.Held,
  depositDeductedAmount: 0,
  depositRefundAmount: 0,
  charges: {},
  history: [],
  turnaroundStatus: TurnaroundStatus.None,
  turnaroundSlotsSnapshot: 0,
  slotLeaseRequired: false,
  cleaningStartedAt: null,
  availableFrom: null,
  cleaningExtendedUntil: null,
  handoverRiskStatus: 'NONE',
  handoverRiskIncidentId: null,
});
