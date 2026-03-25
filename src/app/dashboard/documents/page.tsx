import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Upload } from "lucide-react";
import Link from "next/link";
import { DocumentListPaginated } from "@/components/document-list-paginated";

export default async function DocumentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  const role = (session.user as any).role as string;
  const isCompany = role === "COMPANY";

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/5">
        <div>
          <h1 className="font-heading font-bold text-2xl text-white">Mis Documentos</h1>
          <p className="text-cetiem-gray text-sm mt-0.5">
            {isCompany
              ? "Sube y gestiona los documentos de tu empresa para la certificación ESG."
              : "Biblioteca documental global — todos los documentos del sistema."}
          </p>
        </div>
        <Link
          href="/dashboard/upload"
          className="flex items-center gap-2 bg-cetiem-green hover:bg-cetiem-green/90 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          <Upload className="h-4 w-4" />
          Subir Documento
        </Link>
      </div>

      {/* Content */}
      <div className="flex-1 p-8 overflow-auto">
        {/* Aviso para empresa */}
        {isCompany && (
          <div className="mb-4 px-4 py-3 bg-cetiem-teal/5 border border-cetiem-teal/10 rounded-xl text-xs text-cetiem-gray leading-relaxed">
            <strong className="text-cetiem-teal">¿Cómo funciona?</strong>{" "}
            Sube todos los documentos relevantes para tu certificación ESG (políticas, manuales, certificados, etc.).
            El sistema los analiza automáticamente con IA. Una vez que tu assessor asignado los revise,
            recibirás el dictamen y, si aplica, tu Certificado ESG.
          </div>
        )}

        <div className="bg-cetiem-card border border-white/5 rounded-2xl p-6">
          <DocumentListPaginated />
        </div>
      </div>
    </div>
  );
}
