import type { Metadata, Viewport } from "next";
import { Cinzel, Nunito } from "next/font/google";
import "./globals.css";
import { PwaRegistration } from "./components/PwaRegistration";
import { StudentPortalMusic } from "./components/StudentPortalMusic";
import { ProfileButtonWrapper } from "./components/ProfileButtonWrapper";

const titleFont = Cinzel({
  variable: "--font-title",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const uiFont = Nunito({
  variable: "--font-ui",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "SolveAd",
  description: "Game-inspired thesis platform with guided onboarding and level progression.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SolveAd",
  },
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${titleFont.variable} ${uiFont.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <PwaRegistration />
        <StudentPortalMusic />
        <ProfileButtonWrapper />
        {children}
      </body>
    </html>
  );
}
