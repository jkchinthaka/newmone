import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MaintainPro Platform",
  description: "Enterprise Asset, Fleet, Utility and Service Management"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
