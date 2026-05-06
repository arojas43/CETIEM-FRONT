import type { Metadata, Viewport } from "next";
import { Noto_Sans } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import Script from "next/script";

const notoSans = Noto_Sans({
  subsets: ["latin"],
  variable: "--font-noto",
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: false,
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#9d2449",
};

export const metadata: Metadata = {
  title: "SECRETARIA DE ECONOMIA — Sistema de Certificación Empresarial",
  description: "Plataforma de certificación ESG con agentes de IA — Secretaría de Economía",
  icons: {
    icon: "https://framework-gb.cdn.gob.mx/gm/v3/assets/images/favicon.ico",
    shortcut: "https://framework-gb.cdn.gob.mx/gm/v3/assets/images/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-MX" suppressHydrationWarning>
      <head>
        {/* ── gob.mx v3 CDN ─────────────────────────────────────────────── */}
        {/* 1. Gráfica Base v3 — tipografía Patria + componentes institucionales */}
        <link rel="stylesheet" href="https://framework-gb.cdn.gob.mx/gm/v3/assets/styles/main.css" />
        {/* 2. Barra de Accesibilidad WCAG 2.1 — obligatoria en sitios de gobierno */}
        <link rel="stylesheet" href="https://framework-gb.cdn.gob.mx/gm/accesibilidad/css/gobmx-accesibilidad.min.css" />
        {/* 3. Favicon institucional oficial */}
        <link rel="shortcut icon" href="https://framework-gb.cdn.gob.mx/gm/v3/assets/images/favicon.ico" />
      </head>
      <body className={`${notoSans.variable} font-sans antialiased`}>
        {/* Anti-flash: aplica dark solo si el usuario lo eligió explícitamente */}
        <script dangerouslySetInnerHTML={{
          __html: `
          try { if (localStorage.getItem('theme') === 'dark') document.documentElement.classList.add('dark'); } catch(e) {}
        ` }} />
        <ToastProvider>
          {children}
        </ToastProvider>
        {/* ── gob.mx v3 Scripts ─────────────────────────────────────────── */}
        {/* 4. JS principal Gráfica Base — debe cargarse antes de cerrarse el body */}
        <Script src="https://framework-gb.cdn.gob.mx/gm/v3/assets/js/gobmx.js" strategy="afterInteractive" />
        {/* 5. JS Barra de Accesibilidad WCAG 2.1 */}
        <Script src="https://framework-gb.cdn.gob.mx/gm/accesibilidad/js/gobmx-accesibilidad.min.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
