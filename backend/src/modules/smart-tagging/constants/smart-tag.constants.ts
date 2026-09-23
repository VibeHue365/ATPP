export enum SmartTagEntityType {
  Product = 'PRODUCT',
  Portfolio = 'PORTFOLIO',
}

export enum SmartTagDefinitionStatus {
  Active = 'ACTIVE',
  Inactive = 'INACTIVE',
}

export enum SmartTagGroup {
  Style = 'STYLE',
  Occasion = 'OCCASION',
}

export const ONBOARDING_STYLE_TAG_MAP: Readonly<Record<string, string>> = {
  TRADITIONAL: 'TRUYEN_THONG',
  MODERN: 'CACH_TAN',
  EDGY: 'PHA_CACH',
};

export const ONBOARDING_OCCASION_TAG_MAP: Readonly<Record<string, string>> = {
  WEDDING: 'PHU_HOP_LE_CUOI',
  GRADUATION: 'CHUP_ANH_KY_YEU',
  FESTIVAL: 'LE_HOI_TRUYEN_THONG',
  EVENT: 'BIEU_DIEN_SU_KIEN',
};

export enum SmartTagGenerationRunStatus {
  Processing = 'PROCESSING',
  Succeeded = 'SUCCEEDED',
  Partial = 'PARTIAL',
  Failed = 'FAILED',
  StaleInput = 'STALE_INPUT',
}

export enum SmartTagSourceStatus {
  Success = 'SUCCESS',
  Failed = 'FAILED',
  Unavailable = 'UNAVAILABLE',
  Skipped = 'SKIPPED',
}

export enum SmartTagSignalSource {
  Rule = 'RULE',
  AiText = 'AI_TEXT',
  AiImage = 'AI_IMAGE',
  Manual = 'MANUAL',
}

export enum SmartTagAssignmentStatus {
  Suggested = 'SUGGESTED',
  Active = 'ACTIVE',
  Rejected = 'REJECTED',
  Removed = 'REMOVED',
  Stale = 'STALE',
}

export enum SmartTagDecisionAction {
  Activate = 'ACTIVATE',
  Reject = 'REJECT',
  Remove = 'REMOVE',
  Restore = 'RESTORE',
  BulkSelection = 'BULK_SELECTION',
}

export enum SmartTagActorRole {
  Provider = 'PROVIDER',
  Admin = 'ADMIN',
}

export const SMART_TAG_TAXONOMY_SCOPE = 'GLOBAL';
export const SMART_TAG_PIPELINE_VERSION = 'rule-ai-text-v1';
