import type { Metadata, Viewport } from "next";

import { ServiceWorkerRegistrar } from "../components/pwa/service-worker-registrar";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "../lib/branding";
import { PWA_ICON_PATHS, PWA_THEME_COLOR } from "../lib/pwa-metadata";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: PRODUCT_NAME,
    template: `%s | ${PRODUCT_NAME}`
  },
  description: PRODUCT_TAGLINE,
  applicationName: PRODUCT_NAME,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: PRODUCT_NAME
  },
  other: {
    "mobile-web-app-capable": "yes"
  },
  icons: {
    icon: PWA_ICON_PATHS.favicon,
    apple: PWA_ICON_PATHS.icon192
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: PWA_THEME_COLOR,
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
