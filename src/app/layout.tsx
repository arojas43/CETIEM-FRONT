import type { Metadata } from "next";
import { Inter, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { RoleProvider } from "@/lib/role-context";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap", preload: false });
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  weight: ["400", "600", "700", "800"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "Sistema de Certificación Empresarial",
  description: "Plataforma de certificación con agentes de IA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${inter.variable} ${bricolage.variable} font-sans`}>
        <RoleProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </RoleProvider>
      </body>
    </html>
  );
}
