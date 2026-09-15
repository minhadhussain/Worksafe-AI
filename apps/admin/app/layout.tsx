import type { Metadata } from "next";

import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "VIGIL OS | Industrial Safety Intelligence", template: "%s | VIGIL OS" },
  description: "Unify computer vision, worker telemetry, and machine monitoring into one real-time safety intelligence system.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className="min-h-screen font-sans antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded focus:bg-primary focus:p-3 focus:text-primary-foreground">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
