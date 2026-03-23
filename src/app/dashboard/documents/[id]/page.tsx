import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { FileText, Brain, MessageSquare, Network, ChevronRight, ArrowLeft } from "lucide-react";
import Link from "next/link";
import ProcessDocumentButton from "./process-button";

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user) redirect("/auth/signin");

  const document = await prisma.document.findUnique({
    where: { id },
    include: { pageIndices: { orderBy: { level: "asc" }, take: 10 } },
  });

  if (!document || document.userId !== session.user.id) redirect("/dashboard/documents");

  const totalSections = await prisma.pageIndex.count({ where: { documentId: id } });

  const statusColor: Record<string, string> = {
    ANALYZED: "text-cetiem-lime",
    INDEXED:  "text-cetiem-teal",
    FAILED:   "text-cetiem-red",
    PROCESSING:"text-cetiem-amber",
    PENDING:  "text-cetiem-gray",
  };

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center gap-4 px-8 py-5 border-b border-white/5">
        <Link href="/dashboard/documents" className="text-cetiem-gray hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-heading font-bold text-xl text-white truncate">{document.name}</h1>
          <p className="text-cetiem-gray text-sm">
            <span className={statusColor[document.status] || "text-cetiem-gray"}>{document.status}</span>
            {" · "}{totalSections} secciones
          </p>
        </div>
      </div>

      <div className="flex-1 p-8 overflow-auto">
        {/* Action cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <ProcessDocumentButton
            documentId={id}
            currentDomain={document.domain || "LEGAL"}
            currentStatus={document.status}
          />

          <Link href={`/dashboard/documents/${id}/qa`}>
            <div className="bg-cetiem-card border border-cetiem-teal/20 rounded-2xl p-5 hover:border-cetiem-teal/40 transition-colors cursor-pointer h-full">
              <div className="h-10 w-10 bg-cetiem-teal/10 rounded-xl flex items-center justify-center mb-3">
                <MessageSquare className="h-5 w-5 text-cetiem-teal" />
              </div>
              <h3 className="font-heading font-semibold text-white mb-1">Preguntar al Documento</h3>
              <p className="text-cetiem-gray text-xs mb-4">Haz preguntas específicas sobre el contenido</p>
              <div className="flex items-center gap-1 text-cetiem-teal text-sm font-medium">
                Iniciar Q&A <ChevronRight className="h-4 w-4" />
              </div>
            </div>
          </Link>

          <Link href={`/dashboard/documents/${id}/content`}>
            <div className="bg-cetiem-card border border-white/5 rounded-2xl p-5 hover:border-cetiem-green/20 transition-colors cursor-pointer h-full">
              <div className="h-10 w-10 bg-cetiem-green/10 rounded-xl flex items-center justify-center mb-3">
                <FileText className="h-5 w-5 text-cetiem-green" />
              </div>
              <h3 className="font-heading font-semibold text-white mb-1">Ver Contenido</h3>
              <p className="text-cetiem-gray text-xs mb-4">Explora el texto extraído y secciones</p>
              <div className="flex items-center gap-1 text-cetiem-green text-sm font-medium">
                Ver Texto <ChevronRight className="h-4 w-4" />
              </div>
            </div>
          </Link>

          <Link href={`/dashboard/documents/${id}/graph`}>
            <div className="bg-cetiem-card border border-white/5 rounded-2xl p-5 hover:border-cetiem-lime/20 transition-colors cursor-pointer h-full">
              <div className="h-10 w-10 bg-cetiem-lime/10 rounded-xl flex items-center justify-center mb-3">
                <Network className="h-5 w-5 text-cetiem-lime" />
              </div>
              <h3 className="font-heading font-semibold text-white mb-1">Grafo de Conocimiento</h3>
              <p className="text-cetiem-gray text-xs mb-4">Entidades y relaciones extraídas</p>
              <div className="flex items-center gap-1 text-cetiem-lime text-sm font-medium">
                Ver Grafo <ChevronRight className="h-4 w-4" />
              </div>
            </div>
          </Link>
        </div>

        {/* Document info */}
        <div className="bg-cetiem-card border border-white/5 rounded-2xl p-6 mb-4">
          <h2 className="font-heading font-semibold text-white mb-4">Información del Documento</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              ["Nombre", document.name],
              ["Estado", document.status],
              ["Tamaño", `${(document.size / 1024 / 1024).toFixed(2)} MB`],
              ["Fecha de subida", new Date(document.createdAt).toLocaleDateString('es-ES')],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-cetiem-gray mb-0.5">{label}</p>
                <p className={`font-medium text-sm ${label === "Estado" ? (statusColor[document.status] || "text-white") : "text-white"}`}>
                  {value}
                </p>
              </div>
            ))}
            {document.description && (
              <div className="md:col-span-2">
                <p className="text-xs text-cetiem-gray mb-0.5">Descripción</p>
                <p className="font-medium text-sm text-white">{document.description}</p>
              </div>
            )}
          </div>
        </div>

        {/* Sections preview */}
        {document.pageIndices.length > 0 && (
          <div className="bg-cetiem-card border border-white/5 rounded-2xl p-6 mb-4">
            <h2 className="font-heading font-semibold text-white mb-1">Vista Previa de Secciones</h2>
            <p className="text-cetiem-gray text-xs mb-4">
              Primeras {document.pageIndices.length} secciones de {totalSections}
            </p>
            <div className="space-y-2">
              {document.pageIndices.map((index) => (
                <div key={index.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                  <div className="h-7 w-7 bg-cetiem-green/10 rounded-lg flex items-center justify-center">
                    <span className="text-xs font-bold text-cetiem-green">{index.level}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white text-sm truncate">{index.title}</p>
                    {index.page && <p className="text-xs text-cetiem-gray">Página {index.page}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info box */}
        <div className="bg-cetiem-green/5 border border-cetiem-green/10 rounded-2xl p-5">
          <h3 className="font-heading font-semibold text-cetiem-green text-sm mb-3 flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Integración PageIndex + Cognee + FalkorDB
          </h3>
          <div className="space-y-1.5 text-sm text-cetiem-gray">
            <p><strong className="text-white">PageIndex:</strong> Extrajo la estructura jerárquica del documento ({totalSections} secciones)</p>
            <p><strong className="text-white">Cognee:</strong> Extrae entidades y relaciones del texto del documento</p>
            <p><strong className="text-white">FalkorDB:</strong> Almacena el grafo de conocimiento aislado por documento</p>
          </div>
        </div>
      </div>
    </div>
  );
}
