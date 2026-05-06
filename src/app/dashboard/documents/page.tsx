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

  const colorBarraSubidos = pctSubidos === 100 ? "bg-economia-success" : pctSubidos >= 60 ? "bg-economia-guinda" : pctSubidos >= 30 ? "bg-economia-warning" : "bg-economia-error";

  return (
    <div className="mb-6 bg-card border border-border rounded-2xl p-5">
      {/* Título */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading font-semibold text-foreground text-sm">Expediente ESG</h2>
        <span className="text-[10px] text-muted-foreground/60 font-medium tracking-wide">Impulsado por NVIDIA</span>
      </div>

      {/* Dos etapas: subida + análisis IA */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        {/* Subida */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-muted-foreground">Documentos subidos</span>
            <span className={cn("font-bold", pctSubidos === 100 ? "text-economia-success" : pctSubidos >= 60 ? "text-economia-guinda" : "text-economia-warning")}>
              {totalSubidos}/{TOTAL_REQUERIDOS}
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className={cn("h-full rounded-full transition-all", colorBarraSubidos)} style={{ width: `${pctSubidos}%` }} />
          </div>
        </div>

        {/* Análisis IA */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-muted-foreground">Análisis IA completado</span>
            <span className={cn("font-bold", pctAnalizados === 100 ? "text-economia-success" : pctAnalizados > 0 ? "text-economia-info" : "text-muted-foreground")}>
              {totalAnalizados}/{totalSubidos || "—"}
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", pctAnalizados === 100 ? "bg-economia-success" : "bg-economia-info")}
              style={{ width: `${pctAnalizados}%` }}
            />
          </div>
        </div>
      </div>

      {enProceso > 0 && (
        <div className="flex items-center gap-2 mb-4 text-xs text-economia-warning bg-economia-warning/5 border border-economia-warning/15 rounded-lg px-3 py-2">
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
                ? "bg-economia-success/5 border-economia-success/20"
                : completa
                  ? "bg-economia-info/5 border-economia-info/10"
                  : "bg-muted border-border"
            )}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 min-w-0">
                {completa && analizadosCat === total ? (
                  <CheckCircle2 className="h-3 w-3 text-economia-success shrink-0" />
                ) : subidos === 0 ? (
                  <FileWarning className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                ) : (
                  <Clock className="h-3 w-3 text-economia-warning shrink-0" />
                )}
                <span className={cn("truncate text-[11px]", completa ? CATEGORIAS[cat].color : "text-muted-foreground")}>
                  {CATEGORIAS[cat].label}
                </span>
              </div>
              <span className={cn("font-medium shrink-0 ml-1 text-[11px]", completa ? "text-economia-success" : subidos > 0 ? "text-foreground" : "text-muted-foreground")}>
                {subidos}/{total}
              </span>
            </div>
            {/* Mini barra de análisis */}
            {subidos > 0 && (
              <div className="h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-economia-info rounded-full"
                  style={{ width: `${Math.round((analizadosCat / subidos) * 100)}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {pctSubidos < 100 && (
        <p className="text-[11px] text-muted-foreground mt-3 text-center">
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
      <div className="flex items-center justify-between px-8 py-5 border-b border-border">
        <div>
          <h1 className="font-heading font-bold text-2xl text-foreground">
            {isCompany ? "Mis Documentos" : "Fondo Documental"}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {isCompany
              ? `Sube los ${TOTAL_REQUERIDOS} documentos requeridos para tu certificación ESG.`
              : "Biblioteca documental global — todos los documentos del sistema."}
          </p>
        </div>
        {isCompany && (
          <Link
            href="/dashboard/upload"
            className="flex items-center gap-2 bg-economia-guinda hover:bg-economia-guinda/90 text-primary-foreground text-sm font-medium px-4 py-2 rounded-xl transition-colors"
          >
            <Upload className="h-4 w-4" />
            Subir Documento
          </Link>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 p-8 overflow-auto">
        {/* Progreso del expediente (solo empresa) */}
        {isCompany && <DocumentProgress userId={session.user.id!} />}

        <div className="bg-card border border-border rounded-2xl p-6">
          <DocumentListPaginated />
        </div>
      </div>
    </div>
  );
}
