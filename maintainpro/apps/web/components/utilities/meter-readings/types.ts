export type MeterRecord = {
  id: string;
  meterNumber: string;
  location?: string | null;
  description?: string | null;
  type?: string | null;
  unit?: string | null;
  isActive?: boolean;
};

export type ReadingRecord = {
  id: string;
  meterId?: string;
  readingValue: number | string;
  readingDate: string;
  notes?: string | null;
  consumption?: number | string | null;
  meter?: MeterRecord | null;
};

export type RecentReadingRow = {
  id: string;
  meterNumber: string;
  meterLine: string;
  reading: string;
  used: string | null;
  recorded: string;
  status: "SAVED" | "HIGH_USAGE";
};
