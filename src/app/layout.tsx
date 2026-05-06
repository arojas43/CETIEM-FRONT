import type { Metadata, Viewport } from "next";
import { Inter, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#00D47A",
};

export const metadata: Metadata = {
  title: "CETIEM · Agile Audit Hub — Certificación ESG",
  description: "Plataforma de certificación ESG con IA — CETIEM S.C. powered by CIPRE HOLDING",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-MX" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} ${bricolage.variable} font-sans antialiased bg-[#0A0A0A]`}>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
