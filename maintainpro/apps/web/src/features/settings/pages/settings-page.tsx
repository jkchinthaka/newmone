import { useState } from "react";

import { LanguageSwitcher } from "@/components/common/language-switcher";
import { PageHeader } from "@/components/common/page-header";
import { QrDisplay } from "@/components/common/qr-display";
import { QrScanner } from "@/components/common/qr-scanner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { firebaseApp } from "@/lib/firebase";

export const SettingsPage = () => {
  const [scannedValue, setScannedValue] = useState<string>("No QR scan yet");
  const [scannerVisible, setScannerVisible] = useState(false);

  return (
    <div>
      <PageHeader title="Settings" description="Manage localization, integrations, and QR-based workflows." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="text-base font-semibold text-slate-900">Language</h3>
          <p className="mt-1 text-sm text-slate-600">Switch localized labels for multi-site teams.</p>
          <div className="mt-4">
            <LanguageSwitcher />
          </div>
        </Card>

        <Card>
          <h3 className="text-base font-semibold text-slate-900">Firebase Status</h3>
          <p className="mt-1 text-sm text-slate-600">Used for push notifications and mobile synchronization.</p>
          <p className="mt-4 text-sm font-medium text-slate-700">
            {firebaseApp ? "Firebase initialized" : "Firebase disabled (set VITE_FIREBASE_* env vars)"}
          </p>
        </Card>

        <Card>
          <h3 className="text-base font-semibold text-slate-900">QR Payload</h3>
          <p className="mt-1 text-sm text-slate-600">Generate QR payloads for asset tagging and quick lookup.</p>
          <div className="mt-4">
            <QrDisplay value={scannedValue} />
          </div>
        </Card>

        <Card>
          <h3 className="text-base font-semibold text-slate-900">QR Scanner</h3>
          <p className="mt-1 text-sm text-slate-600">Read QR tags from equipment labels.</p>
          <div className="mt-4">
            <Button variant="secondary" onClick={() => setScannerVisible((value) => !value)}>
              {scannerVisible ? "Hide Scanner" : "Open Scanner"}
            </Button>
          </div>
          {scannerVisible ? (
            <div className="mt-4">
              <QrScanner onResult={setScannedValue} />
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
};
