import type { Metadata, Viewport } from "next";
import { Inter, Bricolage_Grotesque, Noto_Sans, Playfair_Display } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { ThemeProvider } from "@/components/theme-provider";

// ── CETIEM fonts ──────────────────────────────────────────────
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

// ── Institucional fonts (SE) ──────────────────────────────────
const notoSans = Noto_Sans({
  subsets: ["latin"],
  variable: "--font-noto",
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: false,
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
  preload: false,
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#00D47A" },
    { media: "(prefers-color-scheme: light)", color: "#9D2449" },
  ],
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
      <head>
        {/* gob.mx CSS — loaded for Patria font availability in institucional mode.
            All injected UI elements are hidden via globals.css. No JS scripts loaded. */}
        <link rel="stylesheet" href="https://framework-gb.cdn.gob.mx/gm/v3/assets/styles/main.css" />
      </head>
      <body
        className={`${inter.variable} ${bricolage.variable} ${notoSans.variable} ${playfair.variable} font-sans antialiased`}
      >
        <ThemeProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
