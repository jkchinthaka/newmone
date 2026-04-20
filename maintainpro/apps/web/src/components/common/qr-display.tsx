import QRCode from "react-qr-code";

import { Card } from "@/components/ui/card";

interface QrDisplayProps {
  value: string;
}

export const QrDisplay = ({ value }: QrDisplayProps) => {
  return (
    <Card className="flex items-center justify-center">
      <QRCode value={value} size={160} bgColor="#ffffff" fgColor="#0f172a" />
    </Card>
  );
};
