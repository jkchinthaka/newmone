import { useEffect, useMemo } from "react";

import { Html5QrcodeScanner } from "html5-qrcode";

import { Card } from "@/components/ui/card";

interface QrScannerProps {
  onResult: (value: string) => void;
}

export const QrScanner = ({ onResult }: QrScannerProps) => {
  const scannerElementId = useMemo(() => `maintainpro-qr-${Math.random().toString(36).slice(2, 9)}`, []);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      scannerElementId,
      {
        fps: 10,
        qrbox: {
          width: 220,
          height: 220
        }
      },
      false
    );

    scanner.render(
      (decodedText) => {
        onResult(decodedText);
      },
      () => {
        return;
      }
    );

    return () => {
      void scanner.clear().catch(() => undefined);
    };
  }, [scannerElementId, onResult]);

  return (
    <Card>
      <div id={scannerElementId} />
    </Card>
  );
};
