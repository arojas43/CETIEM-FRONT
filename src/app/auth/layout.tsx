import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Acceso — SECRETARIA DE ECONOMIA",
    description: "Acceso al sistema de certificación de la Secretaría de Economía",
};

/**
 * Layout para páginas de autenticación.
 * Solo exporta metadata — html/head/body los provee el root layout (app/layout.tsx).
 * ToastProvider, fuentes y CSS globales ya están en el root layout.
 */
export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
