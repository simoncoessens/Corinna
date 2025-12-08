import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "snip-tool | DSA Compliance Navigator",
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
  authors: [{ name: "snip-tool" }],
  openGraph: {
    title: "snip-tool | DSA Compliance Navigator",
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
        className={`${instrumentSerif.variable} ${dmSans.variable} ${jetBrainsMono.variable} antialiased overflow-hidden h-screen`}
      >
        {children}
      </body>
    </html>
  );
}
