import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/ToastContainer";

export const metadata: Metadata = {
  title: { default: "Foreman", template: "%s | Foreman" },
  description: "Field service management for general contractors",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
