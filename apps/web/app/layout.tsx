import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: { default: "WorkVision | Safety Operations", template: "%s | WorkVision" },
  description: "Vision-first industrial safety. A unified foundation for worker safety and machinery health.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded focus:bg-primary focus:p-3 focus:text-primary-foreground">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
