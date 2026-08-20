import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { LanguageProvider } from "@/components/providers/language-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { MqttProvider } from "@/components/providers/mqtt-provider";
import { CompatibilityBanner } from "@/components/compatibility-banner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Timer Digital Relay v4.0 — ESP32 Control Dashboard",
  description:
    "Progressive Web App dashboard for ESP32-based 12-channel relay + 4 PIR timer system. Cloud-ready, locally autonomous, JWT-secured.",
  keywords: [
    "ESP32",
    "Timer Relay",
    "PIR Sensor",
    "IoT Dashboard",
    "Smart Home",
    "PWA",
    "DS3231",
  ],
  authors: [{ name: "Timer Relay v4.0" }],
  manifest: "/manifest.webmanifest",
  applicationName: "Timer12",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Timer12",
  },
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "Timer Digital Relay v4.0",
    description: "ESP32 12-Channel Relay + PIR Control Dashboard",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F8FAFC" },
    { media: "(prefers-color-scheme: dark)", color: "#0A0F1A" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider>
          <LanguageProvider>
            <QueryProvider>
              <MqttProvider>
                <AuthProvider>
                  <CompatibilityBanner />
                  {children}
                  <Toaster />
                  <SonnerToaster position="top-right" richColors closeButton />
                </AuthProvider>
              </MqttProvider>
            </QueryProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
