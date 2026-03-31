import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Upload, CheckCircle2, Clock, FileWarning } from "lucide-react";
import Link from "next/link";
import { DocumentListPaginated } from "@/components/document-list-paginated";
import { prisma } from "@/lib/db";
import {
  CATALOGO_DOCUMENTOS,
  CATEGORIAS,
  ORDEN_CATEGORIAS,
  TOTAL_REQUERIDOS,
  TOTAL_OBLIGATORIOS,
  type CategoriaDocumento,
} from "@/lib/document-catalogue";
import { cn } from "@/lib/utils";

async function DocumentProgress({ userId }: { userId: string }) {
  // Tipos ya subidos (puede haber duplicados si subieron más de uno del mismo tipo)
  const documentos = await prisma.document.findMany({
    where: { userId },
    select: { tipoDocumento: true, categoriaDoc: true, status: true },
  });

  const tiposSubidos = new Set(documentos.map(d => d.tipoDocumento).filter(Boolean) as string[]);
  const analizados = new Set(
    documentos.filter(d => d.status === "ANALYZED").map(d => d.tipoDocumento).filter(Boolean) as string[]
  );

  const totalSubidos = tiposSubidos.size;
  const totalAnalizados = analizados.size;
  const porcentaje = Math.round((totalSubidos / TOTAL_REQUERIDOS) * 100);

  // Por categoría
  const porCategoria = ORDEN_CATEGORIAS.filter(c => c !== "OTRO").map(cat => {
    const enCategoria = CATALOGO_DOCUMENTOS.filter(d => d.categoria === cat);
    const subidos = enCategoria.filter(d => tiposSubidos.has(d.id)).length;
    const total = enCategoria.length;
    return { cat, subidos, total, completa: subidos === total };
  });

  const colorBarra = porcentaje === 100
    ? "bg-cetiem-lime"
    : porcentaje >= 60
      ? "bg-cetiem-green"
      : porcentaje >= 30
        ? "bg-cetiem-amber"
        : "bg-cetiem-red";

  return (
    <div className="mb-6 bg-cetiem-card border border-white/5 rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-heading font-semibold text-white text-sm">
            Progreso del expediente ESG
          </h2>
          <p className="text-xs text-cetiem-gray mt-0.5">
            {totalSubidos} de {TOTAL_REQUERIDOS} tipos de documento subidos
            {totalAnalizados > 0 && ` · ${totalAnalizados} analizados por IA`}
          </p>
        </div>
        <div className="text-right">
          <span className={cn(
            "text-2xl font-bold font-heading",
            porcentaje === 100 ? "text-cetiem-lime" : porcentaje >= 60 ? "text-cetiem-green" : "text-cetiem-amber"
          )}>
            {porcentaje}%
          </span>
        </div>
      </div>

      {/* Barra principal */}
      <div className="h-2.5 bg-white/5 rounded-full overflow-hidden mb-4">
        <div
          className={cn("h-full rounded-full transition-all", colorBarra)}
          style={{ width: `${porcentaje}%` }}
        />
      </div>

      {/* Por categoría */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {porCategoria.map(({ cat, subidos, total, completa }) => (
          <div
            key={cat}
            className={cn(
              "flex items-center justify-between px-3 py-2 rounded-lg border text-xs",
              completa
                ? "bg-cetiem-lime/5 border-cetiem-lime/20"
                : "bg-white/[0.02] border-white/5"
            )}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              {completa ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-cetiem-lime shrink-0" />
              ) : subidos === 0 ? (
                <FileWarning className="h-3.5 w-3.5 text-cetiem-gray/40 shrink-0" />
              ) : (
                <Clock className="h-3.5 w-3.5 text-cetiem-amber shrink-0" />
              )}
              <span className={cn(
                "truncate",
                completa ? CATEGORIAS[cat].color : "text-cetiem-gray"
              )}>
                {CATEGORIAS[cat].label}
              </span>
            </div>
            <span className={cn(
              "ml-2 font-medium shrink-0",
              completa ? "text-cetiem-lime" : subidos > 0 ? "text-white" : "text-cetiem-gray/40"
            )}>
              {subidos}/{total}
            </span>
          </div>
        ))}
      </div>

      {porcentaje < 100 && (
        <p className="text-[11px] text-cetiem-gray/50 mt-3 text-center">
          Se requieren los {TOTAL_OBLIGATORIOS} documentos obligatorios para solicitar el dictamen
        </p>
      )}
    </div>
  );
}

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
              ? `Sube los ${TOTAL_REQUERIDOS} documentos requeridos para tu certificación ESG.`
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
        {/* Progreso del expediente (solo empresa) */}
        {isCompany && <DocumentProgress userId={session.user.id!} />}

        <div className="bg-cetiem-card border border-white/5 rounded-2xl p-6">
          <DocumentListPaginated />
        </div>
      </div>
    </div>
  );
}
