import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  Award, CheckCircle, Calendar, Shield, Download,
  ArrowLeft, Hash, Building2, XCircle, AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const CERT_STATUS_LABEL: Record<string, string> = {
  APPROVED:  "Certificado Aprobado",
  IN_REVIEW: "En Revisión",
  CAPA_OPEN: "Acciones Correctivas Requeridas",
  REJECTED:  "No Aprobado",
  REVOKED:   "Revocado",
  DRAFT:     "Borrador",
};

const FINDING_TYPE_LABEL: Record<string, string> = {
  COMPLIANCE:     "Cumplimiento",
  NON_COMPLIANCE: "No Conformidad",
  OBSERVATION:    "Observación",
  RECOMMENDATION: "Recomendación",
};

const SEV_COLOR: Record<string, string> = {
  LOW:      "bg-economia-info/20 text-economia-info",
  MEDIUM:   "bg-economia-warning/20 text-economia-warning",
  HIGH:     "bg-economia-error/20 text-economia-error",
  CRITICAL: "bg-economia-error/40 text-economia-error font-bold",
};

const FIND_COLOR: Record<string, string> = {
  COMPLIANCE:     "text-economia-success",
  NON_COMPLIANCE: "text-economia-error",
  OBSERVATION:    "text-economia-warning",
  RECOMMENDATION: "text-economia-info",
};

export default async function MiCertificadoPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const role = (session.user as any).role as string;
  if (role !== "COMPANY") redirect("/dashboard");

  const userId = session.user.id!;

  const [cert, company, capaTickets] = await Promise.all([
    prisma.companyCertification.findFirst({
      where: { companyId: userId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { companyName: true, name: true, email: true, rfc: true, track: true, sprintLevel: true },
    }),
    prisma.capaTicket.findMany({
      where: { userId, status: { in: ["OPEN", "IN_PROGRESS", "OVERDUE"] } },
      select: { id: true, title: true, status: true, dueDate: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!cert) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-4 px-8 py-5 border-b border-border">
          <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-sans font-bold text-2xl text-foreground">Mi Certificado ESG</h1>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <Award className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
            <h2 className="font-sans font-semibold text-foreground text-lg mb-2">Sin dictamen emitido aún</h2>
            <p className="text-muted-foreground text-sm mb-6">
              Un Assessor ESG revisará tu expediente cuando hayas subido todos los documentos requeridos y el análisis IA esté completo.
            </p>
            <Link href="/dashboard/documents" className="inline-flex items-center gap-2 bg-[#00D47A] hover:bg-[#00D47A]/90 text-primary-foreground text-sm font-medium px-4 py-2 rounded-xl transition-colors">
              Ver mis documentos
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const req = cert.requirements as any;
  const findings = (req?.findings ?? []) as any[];
  const vlap = req?.vlap as Record<string, { value: boolean | null; confidence: number }> | undefined;
  const isApproved = cert.status === "APPROVED";
  const assessedDate = req?.assessedAt ? new Date(req.assessedAt) : cert.createdAt;

  const TRACK_LABEL: Record<string, string> = {
    A: "Track A — Industria", B: "Track B — Construcción", C: "Track C — Tecnología/Servicios",
  };

  const VLAP_META: Record<string, { label: string; hint: string }> = {
    vigencia:    { label: "Vigencia",    hint: "Documentos dentro del período de validez" },
    legibilidad: { label: "Legibilidad", hint: "Contenido claro y comprensible" },
    autoria:     { label: "Autoría",     hint: "Emisor o firmante identificado" },
    pertinencia: { label: "Pertinencia", hint: "Relevante al proceso ESG" },
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-4 px-8 py-5 border-b border-border">
        <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="font-sans font-bold text-2xl text-foreground">Mi Certificado ESG</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {isApproved ? "Certificación vigente" : CERT_STATUS_LABEL[cert.status] ?? cert.status}
          </p>
        </div>
        {isApproved && (
          <a
            href={`/api/companies/${userId}/certificate`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-economia-success hover:bg-economia-success/90 text-black font-semibold text-sm px-4 py-2 rounded-xl transition-colors"
          >
            <Download className="h-4 w-4" /> Descargar PDF
          </a>
        )}
      </div>

      <div className="flex-1 p-8 overflow-auto">
        <div className="max-w-3xl space-y-5">

          {/* Status card */}
          <div className={cn(
            "border rounded-2xl p-6",
            isApproved ? "bg-economia-success/5 border-economia-success/30" :
            cert.status === "REJECTED" ? "bg-economia-error/5 border-economia-error/20" :
            "bg-economia-warning/5 border-economia-warning/20"
          )}>
            <div className="flex items-start gap-4">
              {isApproved ? (
                <Award className="h-12 w-12 text-economia-success shrink-0" />
              ) : cert.status === "REJECTED" ? (
                <XCircle className="h-12 w-12 text-economia-error shrink-0" />
              ) : (
                <AlertCircle className="h-12 w-12 text-economia-warning shrink-0" />
              )}
              <div className="flex-1">
                <h2 className={cn("font-sans font-bold text-xl mb-1",
                  isApproved ? "text-economia-success" :
                  cert.status === "REJECTED" ? "text-economia-error" : "text-economia-warning"
                )}>
                  {CERT_STATUS_LABEL[cert.status] ?? cert.status}
                </h2>
                {cert.esgScore !== null && cert.esgScore !== undefined && (
                  <p className="text-foreground text-sm mb-2">
                    Puntuación ESG: <strong className="text-economia-success">{Math.round(cert.esgScore)}%</strong>
                  </p>
                )}
                {req?.notes && (
                  <p className="text-foreground/80 text-sm italic border-l-2 border-current/30 pl-3">
                    "{req.notes}"
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Detalles */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-sans font-semibold text-foreground text-sm mb-3 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-economia-info" /> Empresa
              </h3>
              <div className="space-y-2 text-sm">
                <div>
                  <p className="text-[10px] text-muted-foreground/50">Razón Social</p>
                  <p className="text-foreground font-medium">{company?.companyName || company?.name || company?.email}</p>
                </div>
                {company?.rfc && (
                  <div>
                    <p className="text-[10px] text-muted-foreground/50">RFC</p>
                    <p className="text-foreground font-mono text-xs">{company.rfc}</p>
                  </div>
                )}
                {company?.track && (
                  <div>
                    <p className="text-[10px] text-muted-foreground/50">Track Sectorial</p>
                    <p className="text-economia-info text-xs">{TRACK_LABEL[company.track] ?? company.track}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-sans font-semibold text-foreground text-sm mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#00D47A]" /> Dictamen
              </h3>
              <div className="space-y-2 text-sm">
                <div>
                  <p className="text-[10px] text-muted-foreground/50">Fecha</p>
                  <p className="text-foreground">{assessedDate.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}</p>
                </div>
                {req?.assessorEmail && (
                  <div>
                    <p className="text-[10px] text-muted-foreground/50">Assessor ESG</p>
                    <p className="text-foreground text-xs">{req.assessorEmail}</p>
                  </div>
                )}
                {isApproved && cert.publicToken && (
                  <div>
                    <p className="text-[10px] text-muted-foreground/50">Token de verificación</p>
                    <p className="text-economia-success font-mono text-[10px] truncate">{cert.publicToken}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* V.L.A.P. */}
          {vlap && (
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-sans font-semibold text-foreground text-sm mb-3 flex items-center gap-2">
                <Shield className="h-4 w-4 text-economia-info" /> Evaluación V.L.A.P.
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {["vigencia", "legibilidad", "autoria", "pertinencia"].map(key => {
                  const item = vlap[key];
                  const passed = item?.value === true;
                  const meta = VLAP_META[key];
                  return (
                    <div key={key} className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-xl border text-sm",
                      passed ? "bg-economia-success/5 border-economia-success/20" : "bg-muted/40 border-border"
                    )}>
                      {passed
                        ? <CheckCircle className="h-4 w-4 text-economia-success shrink-0" />
                        : <XCircle className="h-4 w-4 text-economia-error shrink-0" />
                      }
                      <div>
                        <p className="text-foreground font-medium text-xs">{meta?.label ?? key}</p>
                        <p className="text-muted-foreground/50 text-[10px]">{meta?.hint}</p>
                        {item?.confidence !== undefined && item.confidence > 0 && (
                          <p className="text-muted-foreground/40 text-[10px]">Confianza: {item.confidence}%</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Findings */}
          {findings.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-sans font-semibold text-foreground text-sm mb-3">
                Hallazgos del Assessor ({findings.length})
              </h3>
              <div className="space-y-2">
                {findings.map((f: any, i: number) => (
                  <div key={i} className="bg-muted/40 border border-border rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={cn("text-[10px] font-medium", FIND_COLOR[f.type] ?? "text-muted-foreground")}>
                        {FINDING_TYPE_LABEL[f.type] ?? f.type}
                      </span>
                      {f.severity && (
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full", SEV_COLOR[f.severity] ?? "bg-muted text-muted-foreground")}>
                          {f.severity}
                        </span>
                      )}
                    </div>
                    <p className="text-foreground text-xs font-medium">{f.title}</p>
                    {f.description && <p className="text-muted-foreground/70 text-[11px] mt-0.5">{f.description}</p>}
                    {f.recommendation && (
                      <p className="text-economia-info/80 text-[11px] mt-1">
                        <strong>Recomendación:</strong> {f.recommendation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CAPA tickets */}
          {capaTickets.length > 0 && (
            <div className="bg-economia-warning/5 border border-economia-warning/20 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-sans font-semibold text-foreground text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-economia-warning" />
                  Acciones correctivas pendientes ({capaTickets.length})
                </h3>
                <Link href="/dashboard/capa" className="text-xs text-economia-warning hover:underline">
                  Gestionar →
                </Link>
              </div>
              <div className="space-y-2">
                {capaTickets.map(ticket => {
                  const days = Math.ceil((new Date(ticket.dueDate).getTime() - Date.now()) / 86400000);
                  return (
                    <div key={ticket.id} className="flex items-center justify-between bg-muted rounded-xl p-3 text-xs">
                      <p className="text-foreground font-medium truncate">{ticket.title}</p>
                      <span className={cn("ml-3 shrink-0 font-medium",
                        days < 0 ? "text-economia-error" : days <= 5 ? "text-economia-warning" : "text-muted-foreground"
                      )}>
                        {days < 0 ? `Vencido` : `${days}d`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Verification token (if approved) */}
          {isApproved && cert.publicToken && (
            <div className="bg-[#00D47A]/5 border border-[#00D47A]/15 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Hash className="h-4 w-4 text-[#00D47A]" />
                <h3 className="font-sans font-semibold text-foreground text-sm">Verificación pública</h3>
              </div>
              <p className="text-muted-foreground text-xs mb-2">
                Este certificado puede ser verificado de forma independiente con el siguiente token único:
              </p>
              <div className="bg-muted border border-border rounded-xl px-4 py-3 font-mono text-economia-success text-sm break-all">
                {cert.publicToken}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
