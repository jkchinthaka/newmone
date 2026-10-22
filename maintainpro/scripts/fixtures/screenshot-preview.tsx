import { createRoot } from "react-dom/client";

import { PageShell } from "@/components/ui/dashboard";
import { colomboDateTimeToIso, colomboNowTime, colomboTodayYmd } from "@/lib/colombo-datetime";
import {
  HIGH_USAGE_COPY,
  averageDailyUse,
  formatMeterQuantity,
  formatRecorded,
  formatSignedUse,
  lastSevenSpark,
  meterLine,
  sinceLastLabel,
  usagePreview
} from "@/lib/meter-readings-display";
import { meterFractionDigits } from "@/lib/meter-reading-input";
import { RecordView } from "@/components/utilities/meter-readings/record-view";
import { SearchView } from "@/components/utilities/meter-readings/search-view";
import type { MeterRecord, ReadingRecord, RecentReadingRow } from "@/components/utilities/meter-readings/types";

const meters: MeterRecord[] = [
  { id: "m1", meterNumber: "M-MVAEQRXN", description: "Main Gate Water Pump", location: "Gate · Nelna Farm", type: "ELECTRICITY", unit: "kWh", isActive: true },
  { id: "m2", meterNumber: "M-WTR-0007", description: "Factory water line", location: "Block B", type: "WATER", unit: "m3", isActive: true },
  { id: "m3", meterNumber: "M-GEN-0002", description: "Standby generator", location: "Power house", type: "Run hours", unit: "h", isActive: true }
];

function historyFor(meterId: string, latest: number, step: number): ReadingRecord[] {
  return Array.from({ length: 7 }, (_, index) => {
    const when = new Date(Date.now() - index * 86_400_000);
    const consumption = index === 0 ? step : 160 + index * 4;
    return {
      id: `${meterId}-${index}`,
      meterId,
      readingValue: latest - index * step,
      readingDate: when.toISOString(),
      consumption,
      notes: index === 0 ? "[by:user]" : ""
    };
  });
}

const history = historyFor("m1", 45210, 180);

function searchReadings(): RecentReadingRow[] {
  return [
    { id: "a", meterNumber: "M-MVAEQRXN", meterLine: "Main Gate Water Pump · Gate", reading: formatMeterQuantity(45210, "kWh") ?? "", used: formatSignedUse(182, "kWh"), recorded: formatRecorded(new Date().toISOString()) ?? "", status: "SAVED" },
    { id: "b", meterNumber: "M-WTR-0007", meterLine: "Factory water line · Block B", reading: formatMeterQuantity(8904, "m3") ?? "", used: formatSignedUse(36, "m3"), recorded: formatRecorded(new Date(Date.now() - 86_400_000).toISOString()) ?? "", status: "SAVED" },
    { id: "c", meterNumber: "M-GEN-0002", meterLine: "Standby generator · Power house", reading: formatMeterQuantity(1286.5, "h") ?? "", used: formatSignedUse(4, "h"), recorded: formatRecorded(new Date(Date.now() - 86_400_000).toISOString()) ?? "", status: "HIGH_USAGE" }
  ];
}

function latestMap() {
  const map = new Map<string, ReadingRecord>();
  map.set("m1", history[0]);
  map.set("m2", { id: "w", meterId: "m2", readingValue: 8904, readingDate: new Date(Date.now() - 86_400_000).toISOString(), consumption: 36 });
  map.set("m3", { id: "g", meterId: "m3", readingValue: 1286.5, readingDate: new Date(Date.now() - 2 * 86_400_000).toISOString(), consumption: 4 });
  return map;
}

function RecordPreview({ warning }: { warning: boolean }) {
  const meter = meters[0];
  const fractionDigits = meterFractionDigits(meter.unit, meter.type);
  const draft = warning ? "46020" : "45392";
  const preview = usagePreview(draft, fractionDigits, history[0], history);
  const average = averageDailyUse(history);
  return (
    <div className="min-w-0 space-y-2 bg-brand-50 p-3 sm:p-4">
      <p className="text-sm text-slate-600">
        <span className="font-medium text-brand-800">Meter Readings</span>
        <span> / {meter.meterNumber}</span>
      </p>
      <PageShell
        title="Record reading"
        actions={<button className="hidden min-h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold min-[641px]:inline-flex" type="button">Change meter</button>}
      >
        <RecordView
          meter={meter}
          history={history}
          historyState="ready"
          historyError=""
          onRetryHistory={() => undefined}
          value={draft}
          onValueChange={() => undefined}
          fractionDigits={fractionDigits}
          draftError=""
          valueHintId="reading-hint"
          valueRef={() => undefined}
          usageText={preview ? formatSignedUse(preview.consumption, meter.unit) : null}
          usageTone={preview?.warning ? "high" : preview ? "normal" : null}
          sinceLast={sinceLastLabel(history[0].readingDate)}
          averageText={average == null ? null : formatMeterQuantity(average, meter.unit)}
          spark={lastSevenSpark(history)}
          readingCount="50+ saved"
          readingAt={colomboDateTimeToIso(colomboTodayYmd(), colomboNowTime())}
          onReadingAt={() => undefined}
          reset={false}
          onReset={() => undefined}
          resetReason=""
          onResetReason={() => undefined}
          note=""
          onNote={() => undefined}
          warning={warning ? preview?.warning || HIGH_USAGE_COPY : ""}
          message={warning ? "" : "Reading saved for M-WTR-0007 · 8,904 m³ · Yesterday 17:10"}
          error=""
          saving={false}
          submitDisabled={false}
          onSubmit={(event) => event.preventDefault()}
          onChangeMeter={() => undefined}
          onScanNext={() => undefined}
        />
      </PageShell>
    </div>
  );
}

function SearchPreview() {
  return (
    <div className="min-w-0 bg-brand-50 p-3 sm:p-4">
      <PageShell title="Meter Readings" subtitle="Record the number on the meter. Search, scan, or pick a recent meter.">
        <SearchView
          query=""
          onQueryChange={() => undefined}
          onSearch={(event) => event?.preventDefault()}
          onScan={() => undefined}
          recent={meters}
          onPick={() => undefined}
          meters={meters}
          latestByMeter={latestMap()}
          metersState="ready"
          metersError=""
          onRetryMeters={() => undefined}
          readings={searchReadings()}
          readingsState="ready"
          readingsError=""
          onRetryReadings={() => undefined}
          notice=""
          filtered={false}
        />
      </PageShell>
      <p className="sr-only">{meterLine("Main Gate Water Pump", "Gate")}</p>
    </div>
  );
}

const state = (window as unknown as { __meterState?: string }).__meterState ?? "search";
createRoot(document.getElementById("root")!).render(state === "search" ? <SearchPreview /> : <RecordPreview warning={state === "warning"} />);
