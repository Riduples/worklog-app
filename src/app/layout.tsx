import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import "./globals.css";

// The app has always asked for Inter — every layout set
// fontFamily: 'Inter','Segoe UI',... — but nothing ever shipped it, so every
// user silently fell through to Segoe UI on Windows and something else
// everywhere else. Meanwhile this file downloaded Geist, which nothing asked
// for. The spec (§4) says ship Inter; now we do, and only it.
//
// latin covers English, Afrikaans and the Nguni languages. Inter is a variable
// font here, so the 500/700/800/900 weights the app uses all come from the one
// file rather than four.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Worklog",
  description: "Bookkeeping for South African small and informal businesses",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Worklog",
  },
};

export const viewport: Viewport = {
  themeColor: "#0C4A6E",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
