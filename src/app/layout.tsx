import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "react-hot-toast";

import { LanguageProvider } from "@/components/LanguageProvider";
import { directionOf } from "@/lib/i18n";
import { getLanguage } from "@/lib/language-server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Service Mobility Dashboard",
  description: "Daily service tasks and optimised vehicle routes.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Read on the server so the first HTML is already in the right language and
  // direction — a client-only preference would render LTR and flip after hydration.
  const language = await getLanguage();

  return (
    <html
      lang={language}
      dir={directionOf(language)}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LanguageProvider initialLanguage={language}>{children}</LanguageProvider>
        {/* Mounted once here so any component can call toast.error(...). The
            dashboard is read-only, so the only notifications are failures it
            cannot fix itself: the Optimization API fallback and a daily-task load
            error. react-hot-toast ships its own 'use client' directive, so
            importing <Toaster /> into this Server Component layout is safe. */}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              // Matches the dashboard's ink and hairline treatment.
              background: '#ffffff',
              color: '#0b0b0b',
              border: '1px solid rgba(11,11,11,0.10)',
              boxShadow: '0 6px 20px rgba(11,11,11,0.16)',
              fontSize: '13px',
            },
            error: { duration: 6000 },
            success: { duration: 3000 },
          }}
        />
      </body>
    </html>
  );
}
