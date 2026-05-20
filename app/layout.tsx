import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { getAppBaseUrl } from "@/lib/deployment/config";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap"
});

export const metadata: Metadata = {
  metadataBase: new URL(getAppBaseUrl()),
  title: {
    default: "SHASTORE AI",
    template: "%s | SHASTORE AI"
  },
  description: "AI copy and template-based ecommerce landing pages for products.",
  applicationName: "SHASTORE AI",
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: "SHASTORE AI",
    description: "AI copy and template-based ecommerce landing pages for products.",
    siteName: "SHASTORE AI",
    type: "website",
    url: "/"
  },
  robots: {
    follow: true,
    index: true
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
