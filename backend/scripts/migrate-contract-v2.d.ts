export interface LegacyContractRow {
  _id?: unknown;
  bookingId?: unknown;
  providerId?: unknown;
  customerId?: unknown;
  contractCode?: string;
  flowVersion?: number;
  scope?: string;
  approvalMode?: string;
  status?: string;
  updatedAt?: Date;
}

export interface LegacyBookingRow {
  bookingType?: string;
  customerId?: unknown;
  providerIds?: unknown[];
  contractId?: unknown;
}

export function classifyLegacyContract(
  contract: LegacyContractRow,
  booking: LegacyBookingRow | null,
  productItemCount: number,
): 'MARK_LEGACY' | 'LEGACY_ALREADY_MARKED' | 'V2_UNCHANGED';

export function assertTestApplyTarget(
  targetUri: string,
  databaseName: string,
  args: string[],
  applicationUri: string | null,
): void;

export function fingerprintContracts(rows: LegacyContractRow[]): string;
