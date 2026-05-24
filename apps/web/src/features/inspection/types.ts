export type InspectionSeverity = "green" | "yellow" | "red";
export type InspectionStatus = "draft" | "sent";

export interface InspectionItem {
  id: string;
  title: string;
  severity: InspectionSeverity;
  note: string | null;
  photoIds: string[];
  order: number;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface InspectionState {
  status: InspectionStatus;
  sentAt: string | null;
  viewedAt: string | null;
  items: InspectionItem[];
}

export const SEVERITY_COLORS: Record<InspectionSeverity, string> = {
  green: "green",
  yellow: "yellow",
  red: "red",
};

export const SEVERITY_LABELS: Record<InspectionSeverity, string> = {
  green: "Good",
  yellow: "Watch",
  red: "Needs work",
};
