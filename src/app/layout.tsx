import type { Metadata } from "next";
import { Cinzel, Nunito } from "next/font/google";
import "./globals.css";
import { StudentPortalMusic } from "./components/StudentPortalMusic";

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
  icons: {
    icon: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${titleFont.variable} ${uiFont.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <StudentPortalMusic />
        {children}
      </body>
    </html>
  );
}
