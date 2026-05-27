import type { Metadata, Viewport } from "next";

import { ServiceWorkerRegistrar } from "../components/pwa/service-worker-registrar";
import "./globals.css";

export const metadata: Metadata = {
  title: "MaintainPro Platform",
  description: "Enterprise Asset, Fleet, Utility and Service Management",
  applicationName: "MaintainPro",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MaintainPro"
  },
  other: {
    "mobile-web-app-capable": "yes"
  },
  icons: {
    icon: "/favicon.svg",
    apple: "/pwa-192x192.svg"
  }
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  colorScheme: "light"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  );
}
