import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  FileText, Brain, MessageSquare, Network, ChevronRight,
  ArrowLeft, CheckCircle, XCircle, Flag, AlertCircle, Clock,
  Award, ShieldOff,
} from "lucide-react";
import Link from "next/link";
import ProcessDocumentButton from "./process-button";
import { cn } from "@/lib/utils";
import { KillSwitchButton } from "./kill-switch-button";
import { PdfInlineViewer } from "@/components/pdf-inline-viewer";

const statusColor: Record<string, string> = {
  ANALYZED:   "text-cetiem-lime",
  INDEXED:    "text-cetiem-teal",
  FAILED:     "text-cetiem-red",
  PROCESSING: "text-cetiem-amber",
  PENDING:    "text-cetiem-gray",
};

const severityColor: Record<string, string> = {
  LOW:      "bg-cetiem-teal/20 text-cetiem-teal",
  MEDIUM:   "bg-cetiem-amber/20 text-cetiem-amber",
  HIGH:     "bg-cetiem-red/20 text-cetiem-red",
  CRITICAL: "bg-cetiem-red/40 text-cetiem-red font-bold",
};

const findingTypeColor: Record<string, string> = {
  COMPLIANCE:     "text-cetiem-lime",
  NON_COMPLIANCE: "text-cetiem-red",
  OBSERVATION:    "text-cetiem-amber",
  RECOMMENDATION: "text-cetiem-teal",
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
  APPROVED:   "text-cetiem-lime",
  REJECTED:   "text-cetiem-red",
  IN_REVIEW:  "text-cetiem-amber",
  DRAFT:      "text-cetiem-gray",
  REVOKED:    "text-cetiem-red",
  CAPA_OPEN:  "text-cetiem-amber",
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
      <div className="flex items-center gap-4 px-8 py-5 border-b border-white/5">
        {fromReview && companyId ? (
          <Link href={`/dashboard/review/company/${companyId}`} className="flex items-center gap-1.5 text-cetiem-gray hover:text-white transition-colors text-sm">
            <ArrowLeft className="h-4 w-4" /> Cola
          </Link>
        ) : (
          <Link href="/dashboard/documents" className="text-cetiem-gray hover:text-white transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="font-heading font-bold text-xl text-white truncate">{document.name}</h1>
          <p className="text-cetiem-gray text-sm">
            <span className={statusColor[document.status] || "text-cetiem-gray"}>{document.status}</span>
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
              className="flex items-center gap-2 px-4 py-2 bg-cetiem-lime/10 border border-cetiem-lime/30 hover:border-cetiem-lime/60 text-cetiem-lime rounded-xl text-sm transition-colors"
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
            <div className="bg-cetiem-card border border-white/5 rounded-2xl p-6">
              <h2 className="font-heading font-semibold text-white mb-4">Información</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  ["Estado", <span className={statusColor[document.status] || "text-white"}>{document.status}</span>],
                  ["Tamaño", `${(document.size / 1024 / 1024).toFixed(2)} MB`],
                  ["Dominio", document.domain?.toLowerCase() || "—"],
                  ["Subido", new Date(document.createdAt).toLocaleDateString("es-MX")],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <p className="text-xs text-cetiem-gray mb-0.5">{label}</p>
                    <p className="font-medium text-white">{value}</p>
                  </div>
                ))}
                {document.description && (
                  <div className="col-span-2">
                    <p className="text-xs text-cetiem-gray mb-0.5">Descripción</p>
                    <p className="font-medium text-white">{document.description}</p>
                  </div>
                )}
              </div>
            </div>

            {/* AI analysis status — no AI tech jargon for company */}
            <div className={cn(
              "border rounded-2xl p-5",
              document.status === "ANALYZED"
                ? "bg-cetiem-lime/5 border-cetiem-lime/20"
                : document.status === "INDEXED"
                ? "bg-cetiem-teal/5 border-cetiem-teal/20"
                : document.status === "FAILED"
                ? "bg-cetiem-red/5 border-cetiem-red/20"
                : "bg-white/3 border-white/5"
            )}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Brain className={cn("h-4 w-4",
                    document.status === "ANALYZED" ? "text-cetiem-lime" :
                    document.status === "INDEXED"   ? "text-cetiem-teal" :
                    document.status === "FAILED"    ? "text-cetiem-red"  : "text-cetiem-gray"
                  )} />
                  <h3 className="font-heading font-semibold text-white text-sm">Revisión IA</h3>
                </div>
                <span className="text-[10px] text-cetiem-gray/40 font-medium tracking-wide">NVIDIA NIM</span>
              </div>
              {document.status === "ANALYZED" ? (
                <p className="text-cetiem-gray text-sm">
                  Documento procesado y listo para revisión por el Assessor ESG.
                </p>
              ) : document.status === "INDEXED" ? (
                <p className="text-cetiem-gray text-sm">
                  Procesamiento completado. En espera de análisis completo.
                </p>
              ) : document.status === "FAILED" ? (
                <p className="text-cetiem-gray text-sm">
                  Ocurrió un error durante el procesamiento. El equipo será notificado.
                </p>
              ) : document.status === "PROCESSING" ? (
                <p className="text-cetiem-gray text-sm">Análisis en curso, por favor espera...</p>
              ) : (
                <p className="text-cetiem-gray text-sm">
                  En espera de procesamiento. Se revisará en breve.
                </p>
              )}
            </div>

            {/* Assessor feedback */}
            {latestCert ? (
              <div className={cn(
                "border rounded-2xl p-5 space-y-3",
                latestCert.status === "APPROVED"  ? "bg-cetiem-lime/5 border-cetiem-lime/20" :
                latestCert.status === "REJECTED"  ? "bg-cetiem-red/5 border-cetiem-red/20" :
                                                    "bg-cetiem-amber/5 border-cetiem-amber/20"
              )}>
                <div className="flex items-center gap-2">
                  {(() => {
                    const Icon = certStatusIcon[latestCert.status] ?? AlertCircle;
                    return <Icon className={cn("h-4 w-4", certStatusColor[latestCert.status])} />;
                  })()}
                  <h3 className="font-heading font-semibold text-white text-sm">
                    Assessor ESG — {certStatusLabel[latestCert.status] ?? latestCert.status}
                  </h3>
                </div>

                {/* Assessor notes */}
                {(latestCert.requirements as any)?.notes && (
                  <div className="bg-white/5 border-l-2 border-cetiem-amber/40 rounded-r-xl px-4 py-3">
                    <p className="text-[10px] text-cetiem-gray/50 mb-1 uppercase tracking-wider">Nota del Assessor</p>
                    <p className="text-white text-sm italic">"{(latestCert.requirements as any).notes}"</p>
                  </div>
                )}

                {/* Findings */}
                {latestCert.findings?.length > 0 ? (
                  <div className="space-y-2">
                    {latestCert.findings.map((f) => (
                      <div key={f.id} className="bg-white/5 rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={cn("text-[10px] font-medium", findingTypeColor[f.type] ?? "text-cetiem-gray")}>
                            {findingTypeLabel[f.type] ?? f.type}
                          </span>
                          <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full", severityColor[f.severity] ?? "bg-white/10 text-cetiem-gray")}>
                            {f.severity}
                          </span>
                        </div>
                        <p className="text-white text-xs font-medium">{f.title}</p>
                        {f.description && <p className="text-cetiem-gray/70 text-[11px] mt-0.5 leading-relaxed">{f.description}</p>}
                        {f.recommendation && (
                          <p className="text-cetiem-teal/80 text-[11px] mt-1">
                            <strong>Recomendación:</strong> {f.recommendation}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-cetiem-gray text-sm">Sin hallazgos específicos en este documento.</p>
                )}
              </div>
            ) : (
              <div className="bg-white/3 border border-white/5 rounded-2xl p-5 flex items-start gap-3">
                <Clock className="h-5 w-5 text-cetiem-gray/40 shrink-0 mt-0.5" />
                <div>
                  <p className="text-white text-sm font-medium">Pendiente de revisión</p>
                  <p className="text-cetiem-gray/60 text-xs mt-1">
                    Un Assessor ESG revisará tu expediente una vez que el análisis IA esté completo.
                  </p>
                </div>
              </div>
            )}

            {/* CAPA tickets for this document */}
            {capaTickets.length > 0 && (
              <div className="bg-cetiem-amber/5 border border-cetiem-amber/20 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-cetiem-amber" />
                    <h3 className="font-heading font-semibold text-white text-sm">
                      Acciones correctivas ({capaTickets.length})
                    </h3>
                  </div>
                  <a href="/dashboard/capa" className="text-xs text-cetiem-amber hover:underline">Gestionar →</a>
                </div>
                <div className="space-y-2">
                  {capaTickets.map(ticket => {
                    const daysLeft = Math.ceil((new Date(ticket.dueDate).getTime() - Date.now()) / 86400000);
                    const isOverdue = daysLeft < 0;
                    return (
                      <div key={ticket.id} className="bg-white/5 rounded-xl p-3 flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-xs font-medium">{ticket.title}</p>
                          <p className="text-cetiem-gray/60 text-[11px] mt-0.5 line-clamp-2">{ticket.description}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full",
                            ticket.status === "CLOSED"      ? "bg-cetiem-lime/10 text-cetiem-lime" :
                            isOverdue                       ? "bg-cetiem-red/15 text-cetiem-red" :
                            ticket.status === "IN_PROGRESS" ? "bg-cetiem-teal/10 text-cetiem-teal" :
                                                              "bg-cetiem-amber/10 text-cetiem-amber"
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
                <div className="bg-cetiem-card border border-cetiem-teal/20 rounded-2xl p-5 hover:border-cetiem-teal/40 transition-colors cursor-pointer h-full">
                  <div className="h-10 w-10 bg-cetiem-teal/10 rounded-xl flex items-center justify-center mb-3">
                    <MessageSquare className="h-5 w-5 text-cetiem-teal" />
                  </div>
                  <h3 className="font-heading font-semibold text-white mb-1">Preguntar al Documento</h3>
                  <p className="text-cetiem-gray text-xs mb-4">Haz preguntas sobre el contenido</p>
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
                  <p className="text-cetiem-gray text-xs mb-4">Texto extraído y secciones</p>
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
                  <p className="text-cetiem-gray text-xs mb-4">Entidades y relaciones</p>
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
                  ["Nombre",          document.name],
                  ["Estado",          document.status],
                  ["Tamaño",          `${(document.size / 1024 / 1024).toFixed(2)} MB`],
                  ["Fecha de subida", new Date(document.createdAt).toLocaleDateString("es-ES")],
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
                  Primeras {document.pageIndices.length} de {totalSections} secciones
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

            {/* Assessor findings */}
            {latestCert && (
              <div className="bg-cetiem-card border border-white/5 rounded-2xl p-6 mb-4">
                <div className="flex items-center gap-2 mb-4">
                  <Flag className="h-4 w-4 text-cetiem-amber" />
                  <h2 className="font-heading font-semibold text-white">
                    Dictamen — {certStatusLabel[latestCert.status] ?? latestCert.status}
                  </h2>
                </div>
                {latestCert.findings?.length > 0 ? (
                  <div className="space-y-2">
                    {latestCert.findings.map((f) => (
                      <div key={f.id} className="flex items-start gap-3 p-3 bg-white/5 rounded-xl">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={cn("text-[10px] font-medium", findingTypeColor[f.type] ?? "text-cetiem-gray")}>
                              {findingTypeLabel[f.type] ?? f.type}
                            </span>
                            <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full", severityColor[f.severity] ?? "")}>
                              {f.severity}
                            </span>
                          </div>
                          <p className="text-white text-sm font-medium">{f.title}</p>
                          {f.description && <p className="text-cetiem-gray/70 text-xs mt-0.5">{f.description}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-cetiem-gray text-sm">Sin hallazgos registrados.</p>
                )}
              </div>
            )}

            {/* AI info */}
            <div className="bg-cetiem-green/5 border border-cetiem-green/10 rounded-2xl p-5">
              <h3 className="font-heading font-semibold text-cetiem-green text-sm mb-3 flex items-center gap-2">
                <Brain className="h-4 w-4" />
                Integración PageIndex + Cognee + FalkorDB
              </h3>
              <div className="space-y-1.5 text-sm text-cetiem-gray">
                <p><strong className="text-white">PageIndex:</strong> {totalSections} secciones extraídas</p>
                <p><strong className="text-white">Cognee:</strong> Extrae entidades y relaciones del texto</p>
                <p><strong className="text-white">FalkorDB:</strong> Grafo de conocimiento aislado por documento</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
