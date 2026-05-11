import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  FileText, Brain, MessageSquare, ChevronRight,
  ArrowLeft, CheckCircle, XCircle, Flag, AlertCircle, Clock,
  Award, ShieldOff,
} from "lucide-react";
import Link from "next/link";
import ProcessDocumentButton from "./process-button";
import { cn } from "@/lib/utils";
import { KillSwitchButton } from "./kill-switch-button";
import { PdfInlineViewer } from "@/components/pdf-inline-viewer";

const statusColor: Record<string, string> = {
  ANALYZED:   "text-economia-success",
  INDEXED:    "text-economia-info",
  FAILED:     "text-economia-error",
  PROCESSING: "text-economia-warning",
  PENDING:    "text-muted-foreground",
};

const severityColor: Record<string, string> = {
  LOW:      "bg-economia-info/20 text-economia-info",
  MEDIUM:   "bg-economia-warning/20 text-economia-warning",
  HIGH:     "bg-economia-error/20 text-economia-error",
  CRITICAL: "bg-economia-error/40 text-economia-error font-bold",
};

const findingTypeColor: Record<string, string> = {
  COMPLIANCE:     "text-economia-success",
  NON_COMPLIANCE: "text-economia-error",
  OBSERVATION:    "text-economia-warning",
  RECOMMENDATION: "text-economia-info",
};

const findingTypeLabel: Record<string, string> = {
  COMPLIANCE:     "Cumplimiento",
  NON_COMPLIANCE: "No Conformidad",
  OBSERVATION:    "Observación",
  RECOMMENDATION: "Recomendación",
};

const certStatusIcon: Record<string, React.ElementType> = {
  APPROVED:   CheckCircle,
  REJECTED:   XCircle,
  IN_REVIEW:  Clock,
  DRAFT:      AlertCircle,
  REVOKED:    ShieldOff,
  CAPA_OPEN:  AlertCircle,
};

const certStatusColor: Record<string, string> = {
  APPROVED:   "text-economia-success",
  REJECTED:   "text-economia-error",
  IN_REVIEW:  "text-economia-warning",
  DRAFT:      "text-muted-foreground",
  REVOKED:    "text-economia-error",
  CAPA_OPEN:  "text-economia-warning",
};

const certStatusLabel: Record<string, string> = {
  APPROVED:   "Aprobado",
  REJECTED:   "Rechazado",
  IN_REVIEW:  "En revisión",
  DRAFT:      "Borrador",
  REVOKED:    "Revocado",
  CAPA_OPEN:  "CAPA Abierta",
};

export default async function DocumentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  const session = await auth();
  const { id } = await params;
  const sp = searchParams ? await searchParams : {};
  const fromReview  = sp?.from === "review";
  const companyId   = sp?.companyId ?? "";

  if (!session?.user) redirect("/auth/signin");

  const role = (session.user.role as string | undefined)?.toLowerCase() ?? "company";
  const isCompany = role === "company";

  const document = await prisma.document.findUnique({
    where: { id },
    include: {
      pageIndices: { orderBy: { level: "asc" }, take: 10 },
      certifications: { orderBy: { createdAt: "desc" }, include: { findings: { orderBy: { createdAt: "asc" } } } },
    },
  });

  // Companies can only see their own documents
  if (!document || (isCompany && document.userId !== session.user.id)) {
    redirect("/dashboard/documents");
  }

  const totalSections = await prisma.pageIndex.count({ where: { documentId: id } });
  const latestCert = document.certifications?.[0] ?? null;

  // CAPA tickets for this document (company only sees their own)
  const capaTickets = isCompany
    ? await prisma.capaTicket.findMany({
        where: { documentId: id, userId: session.user.id! },
        select: { id: true, title: true, description: true, status: true, dueDate: true },
        orderBy: { createdAt: 'desc' },
      })
    : [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-4 px-8 py-5 border-b border-border">
        {fromReview && companyId ? (
          <Link href={`/dashboard/review/company/${companyId}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm">
            <ArrowLeft className="h-4 w-4" /> Cola
          </Link>
        ) : (
          <Link href="/dashboard/documents" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="font-sans font-bold text-xl text-foreground truncate">{document.name}</h1>
          <p className="text-muted-foreground text-sm">
            <span className={statusColor[document.status] || "text-muted-foreground"}>{document.status}</span>
            {totalSections > 0 && <>{" · "}{totalSections} secciones</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Certificate download (if approved) */}
          {latestCert?.status === "APPROVED" && (
            <a
              href={`/api/documents/${id}/certificate`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-economia-success/10 border border-economia-success/30 hover:border-economia-success/60 text-economia-success rounded-xl text-sm transition-colors"
            >
              <Award className="h-4 w-4" />
              Certificado ESG
            </a>
          )}
          {/* Kill-switch (admin only) */}
          {role === "admin" && latestCert?.status === "APPROVED" && (
            <KillSwitchButton documentId={id} />
          )}
        </div>
      </div>

      <div className="flex-1 p-8 overflow-auto">

        {/* PDF inline viewer — visible for all roles */}
        {document.mimeType === "application/pdf" && (
          <div className="mb-6">
            <PdfInlineViewer url={document.storageUrl} />
          </div>
        )}

        {/* ── COMPANY VIEW ─────────────────────────────── */}
        {isCompany ? (
          <div className="max-w-2xl space-y-5">

            {/* Document info */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <h2 className="font-sans font-semibold text-foreground mb-4">Información</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  ["Estado", <span className={statusColor[document.status] || "text-foreground"}>{document.status}</span>],
                  ["Tamaño", `${(document.size / 1024 / 1024).toFixed(2)} MB`],
                  ["Dominio", document.domain?.toLowerCase() || "—"],
                  ["Subido", new Date(document.createdAt).toLocaleDateString("es-MX")],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                    <p className="font-medium text-foreground">{value}</p>
                  </div>
                ))}
                {document.description && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground mb-0.5">Descripción</p>
                    <p className="font-medium text-foreground">{document.description}</p>
                  </div>
                )}
              </div>
            </div>

            {/* AI analysis status — no AI tech jargon for company */}
            <div className={cn(
              "border rounded-2xl p-5",
              document.status === "ANALYZED"
                ? "bg-economia-success/5 border-economia-success/20"
                : document.status === "INDEXED"
                ? "bg-economia-info/5 border-economia-info/20"
                : document.status === "FAILED"
                ? "bg-economia-error/5 border-economia-error/20"
                : "bg-muted/50 border-border"
            )}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Brain className={cn("h-4 w-4",
                    document.status === "ANALYZED" ? "text-economia-success" :
                    document.status === "INDEXED"   ? "text-economia-info" :
                    document.status === "FAILED"    ? "text-economia-error"  : "text-muted-foreground"
                  )} />
                  <h3 className="font-sans font-semibold text-foreground text-sm">Revisión IA</h3>
                </div>
                <span className="text-[10px] text-muted-foreground/40 font-medium tracking-wide">Impulsado por NVIDIA</span>
              </div>
              {document.status === "ANALYZED" ? (
                <p className="text-muted-foreground text-sm">
                  Documento procesado y listo para revisión por el Assessor ESG.
                </p>
              ) : document.status === "INDEXED" ? (
                <p className="text-muted-foreground text-sm">
                  Procesamiento completado. En espera de análisis completo.
                </p>
              ) : document.status === "FAILED" ? (
                <p className="text-muted-foreground text-sm">
                  Ocurrió un error durante el procesamiento. El equipo será notificado.
                </p>
              ) : document.status === "PROCESSING" ? (
                <p className="text-muted-foreground text-sm">Análisis en curso, por favor espera...</p>
              ) : (
                <p className="text-muted-foreground text-sm">
                  En espera de procesamiento. Se revisará en breve.
                </p>
              )}
            </div>

            {/* Assessor feedback */}
            {latestCert ? (
              <div className={cn(
                "border rounded-2xl p-5 space-y-3",
                latestCert.status === "APPROVED"  ? "bg-economia-success/5 border-economia-success/20" :
                latestCert.status === "REJECTED"  ? "bg-economia-error/5 border-economia-error/20" :
                                                    "bg-economia-warning/5 border-economia-warning/20"
              )}>
                <div className="flex items-center gap-2">
                  {(() => {
                    const Icon = certStatusIcon[latestCert.status] ?? AlertCircle;
                    return <Icon className={cn("h-4 w-4", certStatusColor[latestCert.status])} />;
                  })()}
                  <h3 className="font-sans font-semibold text-foreground text-sm">
                    Assessor ESG — {certStatusLabel[latestCert.status] ?? latestCert.status}
                  </h3>
                </div>

                {/* Assessor notes */}
                {(latestCert.requirements as any)?.notes && (
                  <div className="bg-muted border-l-2 border-economia-warning/40 rounded-r-xl px-4 py-3">
                    <p className="text-[10px] text-muted-foreground/50 mb-1 uppercase tracking-wider">Nota del Assessor</p>
                    <p className="text-foreground text-sm italic">"{(latestCert.requirements as any).notes}"</p>
                  </div>
                )}

                {/* Findings */}
                {latestCert.findings?.length > 0 ? (
                  <div className="space-y-2">
                    {latestCert.findings.map((f) => (
                      <div key={f.id} className="bg-muted rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={cn("text-[10px] font-medium", findingTypeColor[f.type] ?? "text-muted-foreground")}>
                            {findingTypeLabel[f.type] ?? f.type}
                          </span>
                          <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full", severityColor[f.severity] ?? "bg-muted text-muted-foreground")}>
                            {f.severity}
                          </span>
                        </div>
                        <p className="text-foreground text-xs font-medium">{f.title}</p>
                        {f.description && <p className="text-muted-foreground/70 text-[11px] mt-0.5 leading-relaxed">{f.description}</p>}
                        {f.recommendation && (
                          <p className="text-economia-info/80 text-[11px] mt-1">
                            <strong>Recomendación:</strong> {f.recommendation}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Sin hallazgos específicos en este documento.</p>
                )}
              </div>
            ) : (
              <div className="bg-muted/50 border border-border rounded-2xl p-5 flex items-start gap-3">
                <Clock className="h-5 w-5 text-muted-foreground/40 shrink-0 mt-0.5" />
                <div>
                  <p className="text-foreground text-sm font-medium">Pendiente de revisión</p>
                  <p className="text-muted-foreground/60 text-xs mt-1">
                    Un Assessor ESG revisará tu expediente una vez que el análisis IA esté completo.
                  </p>
                </div>
              </div>
            )}

            {/* CAPA tickets for this document */}
            {capaTickets.length > 0 && (
              <div className="bg-economia-warning/5 border border-economia-warning/20 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-economia-warning" />
                    <h3 className="font-sans font-semibold text-foreground text-sm">
                      Acciones correctivas ({capaTickets.length})
                    </h3>
                  </div>
                  <a href="/dashboard/capa" className="text-xs text-economia-warning hover:underline">Gestionar →</a>
                </div>
                <div className="space-y-2">
                  {capaTickets.map(ticket => {
                    const daysLeft = Math.ceil((new Date(ticket.dueDate).getTime() - Date.now()) / 86400000);
                    const isOverdue = daysLeft < 0;
                    return (
                      <div key={ticket.id} className="bg-muted rounded-xl p-3 flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-foreground text-xs font-medium">{ticket.title}</p>
                          <p className="text-muted-foreground/60 text-[11px] mt-0.5 line-clamp-2">{ticket.description}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full",
                            ticket.status === "CLOSED"      ? "bg-economia-success/10 text-economia-success" :
                            isOverdue                       ? "bg-economia-error/15 text-economia-error" :
                            ticket.status === "IN_PROGRESS" ? "bg-economia-info/10 text-economia-info" :
                                                              "bg-economia-warning/10 text-economia-warning"
                          )}>
                            {ticket.status === "CLOSED" ? "Cerrado" : isOverdue ? "Vencido" : ticket.status === "IN_PROGRESS" ? "En proceso" : `${daysLeft}d`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

        ) : (
        /* ── ASSESSOR / ADMIN VIEW ──────────────────────── */
          <>
            {/* Action cards */}
            <div className="grid md:grid-cols-4 gap-4 mb-6">
              <ProcessDocumentButton
                documentId={id}
                currentDomain={document.domain || "INDUSTRIA"}
                currentStatus={document.status}
              />

              <Link href={`/dashboard/documents/${id}/qa`}>
                <div className="bg-card border border-economia-info/20 rounded-2xl p-5 hover:border-economia-info/40 transition-colors cursor-pointer h-full">
                  <div className="h-10 w-10 bg-economia-info/10 rounded-xl flex items-center justify-center mb-3">
                    <MessageSquare className="h-5 w-5 text-economia-info" />
                  </div>
                  <h3 className="font-sans font-semibold text-foreground mb-1">Preguntar al Documento</h3>
                  <p className="text-muted-foreground text-xs mb-4">Haz preguntas sobre el contenido</p>
                  <div className="flex items-center gap-1 text-economia-info text-sm font-medium">
                    Iniciar Q&A <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
              </Link>

              <Link href={`/dashboard/documents/${id}/content`}>
                <div className="bg-card border border-border rounded-2xl p-5 hover:border-[#00D47A]/20 transition-colors cursor-pointer h-full">
                  <div className="h-10 w-10 bg-[#00D47A]/10 rounded-xl flex items-center justify-center mb-3">
                    <FileText className="h-5 w-5 text-[#00D47A]" />
                  </div>
                  <h3 className="font-sans font-semibold text-foreground mb-1">Ver Contenido</h3>
                  <p className="text-muted-foreground text-xs mb-4">Texto extraído y secciones</p>
                  <div className="flex items-center gap-1 text-[#00D47A] text-sm font-medium">
                    Ver Texto <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
              </Link>

              <Link href={`/dashboard/review/company/${document.userId}`}>
                <div className="bg-card border border-border rounded-2xl p-5 hover:border-economia-success/20 transition-colors cursor-pointer h-full">
                  <div className="h-10 w-10 bg-economia-success/10 rounded-xl flex items-center justify-center mb-3">
                    <Brain className="h-5 w-5 text-economia-success" />
                  </div>
                  <h3 className="font-sans font-semibold text-foreground mb-1">Dictamen IA</h3>
                  <p className="text-muted-foreground text-xs mb-4">Análisis VLAP + hallazgos IA</p>
                  <div className="flex items-center gap-1 text-economia-success text-sm font-medium">
                    Ver Dictamen <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
              </Link>
            </div>

            {/* Document info */}
            <div className="bg-card border border-border rounded-2xl p-6 mb-4">
              <h2 className="font-sans font-semibold text-foreground mb-4">Información del Documento</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {[
                  ["Nombre",          document.name],
                  ["Estado",          document.status],
                  ["Tamaño",          `${(document.size / 1024 / 1024).toFixed(2)} MB`],
                  ["Fecha de subida", new Date(document.createdAt).toLocaleDateString("es-ES")],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                    <p className={`font-medium text-sm ${label === "Estado" ? (statusColor[document.status] || "text-foreground") : "text-foreground"}`}>
                      {value}
                    </p>
                  </div>
                ))}
                {document.description && (
                  <div className="md:col-span-2">
                    <p className="text-xs text-muted-foreground mb-0.5">Descripción</p>
                    <p className="font-medium text-sm text-foreground">{document.description}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Sections preview */}
            {document.pageIndices.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-6 mb-4">
                <h2 className="font-sans font-semibold text-foreground mb-1">Vista Previa de Secciones</h2>
                <p className="text-muted-foreground text-xs mb-4">
                  Primeras {document.pageIndices.length} de {totalSections} secciones
                </p>
                <div className="space-y-2">
                  {document.pageIndices.map((index) => (
                    <div key={index.id} className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                      <div className="h-7 w-7 bg-[#00D47A]/10 rounded-lg flex items-center justify-center">
                        <span className="text-xs font-bold text-[#00D47A]">{index.level}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground text-sm truncate">{index.title}</p>
                        {index.page && <p className="text-xs text-muted-foreground">Página {index.page}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Assessor findings */}
            {latestCert && (
              <div className="bg-card border border-border rounded-2xl p-6 mb-4">
                <div className="flex items-center gap-2 mb-4">
                  <Flag className="h-4 w-4 text-economia-warning" />
                  <h2 className="font-sans font-semibold text-foreground">
                    Dictamen — {certStatusLabel[latestCert.status] ?? latestCert.status}
                  </h2>
                </div>
                {latestCert.findings?.length > 0 ? (
                  <div className="space-y-2">
                    {latestCert.findings.map((f) => (
                      <div key={f.id} className="flex items-start gap-3 p-3 bg-muted rounded-xl">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={cn("text-[10px] font-medium", findingTypeColor[f.type] ?? "text-muted-foreground")}>
                              {findingTypeLabel[f.type] ?? f.type}
                            </span>
                            <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full", severityColor[f.severity] ?? "")}>
                              {f.severity}
                            </span>
                          </div>
                          <p className="text-foreground text-sm font-medium">{f.title}</p>
                          {f.description && <p className="text-muted-foreground/70 text-xs mt-0.5">{f.description}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Sin hallazgos registrados.</p>
                )}
              </div>
            )}

            {/* AI info */}
            <div className="bg-[#00D47A]/5 border border-[#00D47A]/10 rounded-2xl p-5">
              <h3 className="font-sans font-semibold text-[#00D47A] text-sm mb-3 flex items-center gap-2">
                <Brain className="h-4 w-4" />
                Análisis de IA — Impulsado por NVIDIA
              </h3>
              <div className="space-y-1.5 text-sm text-muted-foreground">
                <p><strong className="text-foreground">Estructura:</strong> {totalSections} secciones extraídas del documento</p>
                <p><strong className="text-foreground">Entidades:</strong> Conceptos y relaciones identificados por IA</p>
                <p><strong className="text-foreground">Grafo:</strong> Mapa de conocimiento persistente y consultable</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
