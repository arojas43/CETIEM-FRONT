import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Upload } from "lucide-react";
import Link from "next/link";
import { DocumentListPaginated } from "@/components/document-list-paginated";

export default async function DocumentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/5">
        <div>
          <h1 className="font-heading font-bold text-2xl text-white">Mis empresas</h1>
          <p className="text-cetiem-gray text-sm mt-0.5">Gestiona tu biblioteca documental</p>
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
        <div className="bg-cetiem-card border border-white/5 rounded-2xl p-6">
          <DocumentListPaginated />
        </div>

        {/* Info cards */}
        <div className="grid md:grid-cols-3 gap-4 mt-6">
          {[
            { title: "PageIndex", color: "cetiem-green", desc: "Analiza la estructura jerárquica de documentos PDF. Detecta capítulos, secciones y crea índices navegables." },
            { title: "Cognee", color: "cetiem-teal", desc: "Extrae entidades y relaciones del texto. Identifica normas, requisitos, empresas y fechas importantes." },
            { title: "FalkorDB", color: "cetiem-lime", desc: "Base de datos de grafos que almacena el conocimiento extraído. Permite consultas complejas de relaciones." },
          ].map(card => (
            <div key={card.title} className="bg-cetiem-card border border-white/5 rounded-xl p-4">
              <h3 className={`font-heading font-semibold text-sm mb-2 text-${card.color}`}>{card.title}</h3>
              <p className="text-cetiem-gray text-xs leading-relaxed">{card.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
