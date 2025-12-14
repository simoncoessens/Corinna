import type { Metadata, Viewport } from "next";
import { Instrument_Serif, DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5, // Allow users to zoom for accessibility
  viewportFit: "cover", // Enable safe area insets for devices with notches
};

export const metadata: Metadata = {
  title: "Corinna | DSA Compliance Navigator",
  description:
    "Navigate the Digital Services Act with precision. Autonomous compliance assessment for digital service providers operating in the European Union.",
  keywords: [
    "DSA",
    "Digital Services Act",
    "compliance",
    "EU regulation",
    "legal tech",
    "VLOP",
    "online platform",
  ],
  authors: [{ name: "Corinna" }],
  openGraph: {
    title: "Corinna | DSA Compliance Navigator",
    description:
      "Navigate the Digital Services Act with precision. Autonomous compliance assessment for digital service providers.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="overflow-hidden">
      <body
        className={`${instrumentSerif.variable} ${dmSans.variable} ${jetBrainsMono.variable} antialiased overflow-hidden`}
        style={{
          // Use large viewport height - stays constant even when keyboard appears
          height: "100vh", // Fallback for older browsers
          height: "100lvh", // Large viewport height - prevents shift when keyboard appears
        }}
      >
        {children}
      </body>
    </html>
  );
}
