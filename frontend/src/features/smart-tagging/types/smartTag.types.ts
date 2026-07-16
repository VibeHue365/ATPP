export type SmartTagStatus =
  | "SUGGESTED"
  | "ACTIVE"
  | "REJECTED"
  | "REMOVED"
  | "STALE";
export type SmartTagDecisionAction =
  | "ACTIVATE"
  | "REJECT"
  | "REMOVE"
  | "RESTORE";

export interface SmartTagDefinition {
  code: string;
  label: string;
  description: string;
  displayPriority: number;
  displayConfig: {
    color: string;
    backgroundColor: string;
    icon?: string | null;
  };
}

export interface SmartTagAssignment {
  _id: string;
  tagCode: string;
  status: SmartTagStatus;
  signals: Array<{
    source: "RULE" | "AI_TEXT" | "AI_IMAGE" | "MANUAL";
    confidence?: number | null;
    evidence?: { explanation?: string | null };
  }>;
  decisionReason?: string | null;
  definition: SmartTagDefinition | null;
}

export interface PublicSmartTagBadge {
  code: string;
  label: string;
  description: string;
  displayPriority: number;
  displayConfig: SmartTagDefinition["displayConfig"];
}
