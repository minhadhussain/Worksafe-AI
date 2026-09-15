import type { Metadata } from "next";

import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "VIGIL OS | Worker Safety", template: "%s | VIGIL OS" },
  description: "Motion-based fall detection for worker safety.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded focus:bg-primary focus:p-3 focus:text-primary-foreground"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
