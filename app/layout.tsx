import type { Metadata, Viewport } from "next";
import * as Sentry from "@sentry/nextjs";
import "./globals.css";
import { ToastProvider } from "@/components/ui/ToastContainer";
import NavigationProgress from "@/components/ui/NavigationProgress";
import RegisterSW from "@/components/pwa/RegisterSW";
import { LanguageProvider } from "@/lib/i18n";

export function generateMetadata(): Metadata {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://foremanapp.io";
  return {
    title: { default: "Foreman", template: "%s | Foreman" },
    description: "Field service management for general contractors",
    icons: {
      icon: [
        { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
        { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
        { url: "/icons/icon-256.png", sizes: "256x256", type: "image/png" },
        { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [
        { url: "/apple-touch-icon.png", sizes: "256x256", type: "image/png" },
      ],
      shortcut: "/favicon-32x32.png",
    },
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
      images: [
        {
          url: "/og-image.png",
          width: 1536,
          height: 1024,
          alt: "Foreman — Field Service Management",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Foreman",
      description: "Field service management for general contractors",
      images: ["/og-image.png"],
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
        <LanguageProvider>
          <ToastProvider>
            {children}
            <RegisterSW />
          </ToastProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
