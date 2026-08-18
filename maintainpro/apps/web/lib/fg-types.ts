export type FgEnvelope<T> = {
  data: T | null;
  meta: Record<string, unknown> | null;
  error: FgApiError | null;
};

export type FgApiError = {
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export type FgKpis = {
  todayRecords: number;
  draftInProgress: number;
  pendingSupervisor: number;
  pendingQa: number;
  completed: number;
  needsAttention: number;
};

export type FgFormCard = {
  code: string;
  title: string;
  multiplicity: "one_per_day" | "one_per_day_per_room" | string;
  requiresRoom?: boolean;
  vehicleLookup?: boolean;
  todayRecord: FgRecordSummary | null;
  statusLabel: string;
};

export type FgActor = {
  id: string;
  employeeCode: string;
  email: string;
};

export type FgRecordSummary = {
  id: string;
  status: string;
  bucket?: string | null;
  statusLabel: string;
  formCode: string;
  formTitle: string;
  batchReference: string;
  organizationCode?: string;
  recorder: FgActor | null;
  updatedAt: string | null;
  startedAt?: string | null;
  readOnly: boolean;
  printPath: string;
  supervisor?: { decision: string | null; reviewedBy: FgActor | null; reviewedAt: string | null } | null;
  qa?: { decision: string | null; reviewedBy: FgActor | null; reviewedAt: string | null } | null;
};

export type FgDashboard = {
  date: string;
  kpis: FgKpis;
  forms: FgFormCard[];
  todayRecords: FgRecordSummary[];
  coldRooms: string[];
  workflow: string[];
};

export type FgFieldOption = { value: string; label: string };

export type FgField = {
  id: string;
  code: string;
  label: string;
  helpText?: string;
  kind?: string;
  required: boolean;
  responseType: string;
  sampleIndex: number;
  fieldName: string;
  equipmentFieldName?: string | null;
  equipmentValue?: string;
  value: string;
  options: FgFieldOption[];
  isVehicleField?: boolean;
  children?: FgField[];
  sampleIndexes?: number[];
};

export type FgSection = {
  id?: string;
  title: string;
  fields?: FgField[];
  items?: Array<{ code: string; label: string; value?: string; kind?: string; children?: Array<{ code: string; label: string; value: string }> }>;
};

export type FgRecordDetail = {
  record: FgRecordSummary;
  readOnly: boolean;
  editor: {
    draftVersion: number;
    expectedDraftVersion: number;
    completeness: {
      totalItems: number;
      requiredItems: number;
      answeredItems: number;
      answeredRequiredItems: number;
      missingRequired: Array<{ id: string; code: string; label: string }>;
    };
    equipmentChoices: FgFieldOption[];
    sections: FgSection[];
  } | null;
  snapshot: FgSection[] | null;
  actions: { canEdit: boolean; canSubmit: boolean; canPrint: boolean };
};

export type FgSubmissionRow = {
  id: string;
  recordId: string;
  formCode: string;
  formTitle: string;
  batchReference: string;
  status: string;
  recorder: FgActor | null;
  submittedAt: string | null;
  submittedBy: FgActor | null;
  printPath: string;
};

export type FgVehicleResult = {
  id: string;
  registrationNo: string;
  make?: string;
  vehicleModel?: string;
  status?: string;
  assetTag?: string;
  label: string;
  unavailable?: boolean;
};
