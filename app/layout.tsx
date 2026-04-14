import type { Metadata, Viewport } from "next";
import * as Sentry from "@sentry/nextjs";
import "./globals.css";
import { ToastProvider } from "@/components/ui/ToastContainer";
import NavigationProgress from "@/components/ui/NavigationProgress";
import RegisterSW from "@/components/pwa/RegisterSW";

export function generateMetadata(): Metadata {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://foremanapp.io";
  return {
    title: { default: "Foreman", template: "%s | Foreman" },
    description: "Field service management for general contractors",
    manifest: "/manifest.json",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: "Foreman",
    },
    openGraph: {
      title: "Foreman",
      description: "Field service management for general contractors",
      url: appUrl,
      siteName: "Foreman",
      type: "website",
    },
    twitter: {
      card: "summary",
      title: "Foreman",
      description: "Field service management for general contractors",
    },
    other: {
      ...Sentry.getTraceData(),
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#f59e0b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NavigationProgress />
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <ToastProvider>
          {children}
          <RegisterSW />
        </ToastProvider>
      </body>
    </html>
  );
}
