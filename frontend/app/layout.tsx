import type { Metadata } from "next";

import "@tabler/icons-webfont/dist/tabler-icons.min.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "TASAP — Training Attendance, Stipend & Audit Platform",
  description: "Workforce programme management for the South African learnership ecosystem.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
