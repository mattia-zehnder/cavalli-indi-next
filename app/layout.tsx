import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const display = Barlow_Condensed({
  variable: "--font-display",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
});

const serif = Playfair_Display({
  variable: "--font-serif",
  weight: ["600", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Casino Campari Night - Bar Indipendenza",
  description: "Le corse dei camparini all'Ippodromo del Bar Indipendenza, Broni.",
};

export const viewport: Viewport = {
  themeColor: "#05080a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${display.variable} ${serif.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
