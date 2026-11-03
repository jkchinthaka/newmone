"use client";

import { formatDateTime } from "@/lib/localization";
import { TableLoadingRows } from "@/components/ui/loading";
import { ErrorState } from "@/components/ui/page-state";
import { useQuery } from "@tanstack/react-query";

import { FarmListPage } from "@/components/farm/farm-list-page";
import { Section, StatCard } from "@/components/farm/farm-ui";
import { farmGet } from "@/lib/farm-api";

type Weather = {
  id: string;
  recordedAt: string;
  temperatureC?: number | null;
  rainfallMm?: number | null;
  humidityPct?: number | null;
  condition?: string | null;
  source: string;
  alertTriggered: boolean;
  alertType?: string | null;
};

export default function FarmWeatherPage() {
  const alerts = useQuery({ queryKey: ["farm-weather-alerts"], queryFn: () => farmGet<Weather[]>("/farm/weather/alerts") });

  return (
    <div className="space-y-6">
      <Section title="Active alerts">
        {alerts.isLoading ? (
          <TableLoadingRows rows={3} label="Loading" />
        ) : alerts.isError ? (
          <ErrorState error={alerts.error} onRetry={() => void alerts.refetch()} />
        ) : alerts.data && alerts.data.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {alerts.data.slice(0, 6).map((a) => (
              <StatCard
                key={a.id}
                label={a.alertType ?? "WEATHER_ALERT"}
                value={a.condition ?? "—"}
                hint={`${formatDateTime(a.recordedAt)} · ${a.temperatureC ?? "—"}°C · ${a.rainfallMm ?? 0}mm`}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No active alerts.</p>
        )}
      </Section>

      <FarmListPage<Weather>
        eyebrow="Climate"
        title="Weather Logs"
        description="Manual entries plus auto-polled OpenWeather records, with frost/rain alerting."
        endpoint="/farm/weather"
        queryKey="farm-weather"
        columns={[
          { key: "recordedAt", label: "When", render: (r) => formatDateTime(r.recordedAt) },
          { key: "temperatureC", label: "°C" },
          { key: "rainfallMm", label: "Rain (mm)" },
          { key: "humidityPct", label: "Humidity %" },
          { key: "condition", label: "Condition" },
          { key: "source", label: "Source" },
          {
            key: "alertTriggered",
            label: "Alert",
            render: (r) => (r.alertTriggered ? r.alertType ?? "ALERT" : "—")
          }
        ]}
        fields={[
          { name: "recordedAt", label: "Recorded at", type: "datetime-local" },
          { name: "temperatureC", label: "Temperature (°C)", type: "number", step: "0.1" },
          { name: "rainfallMm", label: "Rainfall (mm)", type: "number", step: "0.1" },
          { name: "humidityPct", label: "Humidity (%)", type: "number", step: "0.1" },
          { name: "windSpeedKmh", label: "Wind (km/h)", type: "number", step: "0.1" },
          { name: "condition", label: "Condition" }
        ]}
      />
    </div>
  );
}
