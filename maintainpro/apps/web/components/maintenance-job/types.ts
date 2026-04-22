export type RequestType = "VEHICLE" | "MACHINERY" | "SERVICE" | "OTHER";
export type ModuleKey = "machinery" | "service" | "vehicle";
export type JobStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED";
export type JobType = "Internal" | "External";
export type MaintenanceMode = "Regular" | "Sudden";
export type EstimateState = "Quoted" | "Approved" | "Waiting Parts" | "Vendor Review";
export type FaultCondition = "Operational" | "Minor Fault" | "Major Fault" | "Breakdown";
export type FmsRole =
  | "EXECUTIVE"
  | "MAINTENANCE_MANAGER"
  | "ASSISTANT_MANAGER"
  | "GENERAL_MANAGER"
  | "MAINTENANCE_ADMIN"
  | "VEHICLE_SPECIALIST"
  | "MACHINERY_SPECIALIST"
  | "SERVICE_SPECIALIST";

export type PendingRequest = {
  id: string;
  reqNumber: string;
  date: string;
  dueDate: string;
  assetNumber: string;
  department: string;
  requestedBy: string;
  type: RequestType;
  mainJob: string;
  subJob: string;
  narration: string;
  status: "PENDING" | "CONVERTED";
};

export type Vendor = {
  code: string;
  name: string;
  creditPayment: string;
  creditDays: number;
  settlementWindow: string;
};

export type Employee = {
  epf: string;
  name: string;
  specialty: string;
};

export type InventoryItem = {
  id: string;
  group: string;
  name: string;
  unit: string;
  unitCost: number;
};

export type RequestedItem = {
  itemId: string;
  name: string;
  group: string;
  quantity: number;
  unit: string;
  unitCost: number;
};

export type JobCosting = {
  labor: number;
  parts: number;
  vendor: number;
  total: number;
};

export type MaintenanceSchedule = {
  id: string;
  title: string;
  module: ModuleKey;
  target: string;
  dueDate: string;
  interval: string;
};

export type JobFormDraft = {
  requestDate: string;
  requestNo: string;
  requestedBy: string;
  jobNo: string;
  department: string;
  mainJob: string;
  subJob: string;
  narration: string;
};

export type MaintenanceJob = {
  id: string;
  module: ModuleKey;
  jobId: string;
  requestId?: string;
  requestNo?: string;
  requestDate?: string;
  requestedBy?: string;
  status: JobStatus;
  date: string;
  dueDate: string;
  assetNumber: string;
  department: string;
  jobType: JobType;
  jobSegment: string;
  mainJobCategory: string;
  subJobCategory: string;
  title: string;
  narration: string;
  buildingName: string;
  departmentName: string;
  sectionName: string;
  serviceJobDefinition: string;
  serviceValue: string;
  vehicleInternalName: string;
  position: string;
  subJobDefinitions: string[];
  servicePartyCode: string;
  servicePartyName: string;
  onlineOrdering: boolean;
  mainJobCode: string;
  staff: Employee[];
  workers: Employee[];
  estimateState: EstimateState;
  estimateTime: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  faultCondition: FaultCondition;
  faultNarration: string;
  previousReading: string;
  currentReading: string;
  maintenanceMode: MaintenanceMode;
  requestedItems: RequestedItem[];
  machineNumber: string;
  completionDate: string;
  completionTime: string;
  completionNotes: string;
  costing: JobCosting;
};

export type ToastNotification = {
  id: string;
  title: string;
  message: string;
  tone: "info" | "success" | "warning";
};
