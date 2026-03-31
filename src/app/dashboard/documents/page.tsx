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
  const documentos = await prisma.document.findMany({
    where: { userId },
    select: { tipoDocumento: true, categoriaDoc: true, status: true },
  });

  const tiposSubidos = new Set(documentos.map(d => d.tipoDocumento).filter(Boolean) as string[]);
  const analizados = new Set(
    documentos.filter(d => d.status === "ANALYZED").map(d => d.tipoDocumento).filter(Boolean) as string[]
  );
  const enProceso = documentos.filter(d =>
    d.status === "PROCESSING" || d.status === "INDEXED"
  ).length;

  const totalSubidos = tiposSubidos.size;
  const totalAnalizados = analizados.size;
  const pctSubidos = Math.round((totalSubidos / TOTAL_REQUERIDOS) * 100);
  const pctAnalizados = totalSubidos > 0 ? Math.round((totalAnalizados / totalSubidos) * 100) : 0;

  // Por categoría
  const porCategoria = ORDEN_CATEGORIAS.filter(c => c !== "OTRO").map(cat => {
    const enCategoria = CATALOGO_DOCUMENTOS.filter(d => d.categoria === cat);
    const subidos = enCategoria.filter(d => tiposSubidos.has(d.id)).length;
    const analizadosCat = enCategoria.filter(d => analizados.has(d.id)).length;
    const total = enCategoria.length;
    return { cat, subidos, analizadosCat, total, completa: subidos === total };
  });

  const colorBarraSubidos = pctSubidos === 100 ? "bg-cetiem-lime" : pctSubidos >= 60 ? "bg-cetiem-green" : pctSubidos >= 30 ? "bg-cetiem-amber" : "bg-cetiem-red";

  return (
    <div className="mb-6 bg-cetiem-card border border-white/5 rounded-2xl p-5">
      {/* Título */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading font-semibold text-white text-sm">Expediente ESG</h2>
        <span className="text-[10px] text-cetiem-gray/40 font-medium tracking-wide">NVIDIA NIM</span>
      </div>

      {/* Dos etapas: subida + análisis IA */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        {/* Subida */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-cetiem-gray">Documentos subidos</span>
            <span className={cn("font-bold", pctSubidos === 100 ? "text-cetiem-lime" : pctSubidos >= 60 ? "text-cetiem-green" : "text-cetiem-amber")}>
              {totalSubidos}/{TOTAL_REQUERIDOS}
            </span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <div className={cn("h-full rounded-full transition-all", colorBarraSubidos)} style={{ width: `${pctSubidos}%` }} />
          </div>
        </div>

        {/* Análisis IA */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-cetiem-gray">Análisis IA completado</span>
            <span className={cn("font-bold", pctAnalizados === 100 ? "text-cetiem-lime" : pctAnalizados > 0 ? "text-cetiem-teal" : "text-cetiem-gray/40")}>
              {totalAnalizados}/{totalSubidos || "—"}
            </span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", pctAnalizados === 100 ? "bg-cetiem-lime" : "bg-cetiem-teal")}
              style={{ width: `${pctAnalizados}%` }}
            />
          </div>
        </div>
      </div>

      {enProceso > 0 && (
        <div className="flex items-center gap-2 mb-4 text-xs text-cetiem-amber bg-cetiem-amber/5 border border-cetiem-amber/15 rounded-lg px-3 py-2">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          {enProceso} documento{enProceso !== 1 ? 's' : ''} en procesamiento IA...
        </div>
      )}

      {/* Por categoría */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {porCategoria.map(({ cat, subidos, analizadosCat, total, completa }) => (
          <div
            key={cat}
            className={cn(
              "px-3 py-2 rounded-lg border text-xs",
              completa && analizadosCat === total
                ? "bg-cetiem-lime/5 border-cetiem-lime/20"
                : completa
                  ? "bg-cetiem-teal/5 border-cetiem-teal/10"
                  : "bg-white/[0.02] border-white/5"
            )}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 min-w-0">
                {completa && analizadosCat === total ? (
                  <CheckCircle2 className="h-3 w-3 text-cetiem-lime shrink-0" />
                ) : subidos === 0 ? (
                  <FileWarning className="h-3 w-3 text-cetiem-gray/40 shrink-0" />
                ) : (
                  <Clock className="h-3 w-3 text-cetiem-amber shrink-0" />
                )}
                <span className={cn("truncate text-[11px]", completa ? CATEGORIAS[cat].color : "text-cetiem-gray")}>
                  {CATEGORIAS[cat].label}
                </span>
              </div>
              <span className={cn("font-medium shrink-0 ml-1 text-[11px]", completa ? "text-cetiem-lime" : subidos > 0 ? "text-white" : "text-cetiem-gray/30")}>
                {subidos}/{total}
              </span>
            </div>
            {/* Mini barra de análisis */}
            {subidos > 0 && (
              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cetiem-teal rounded-full"
                  style={{ width: `${Math.round((analizadosCat / subidos) * 100)}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {pctSubidos < 100 && (
        <p className="text-[11px] text-cetiem-gray/40 mt-3 text-center">
          {TOTAL_OBLIGATORIOS} documentos obligatorios · {TOTAL_REQUERIDOS} en total
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
