import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  Award, CheckCircle, Calendar, User, Shield, Download,
  ArrowLeft, Hash, Building2, XCircle, Clock, AlertCircle,
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
  LOW:      "bg-cetiem-teal/20 text-cetiem-teal",
  MEDIUM:   "bg-cetiem-amber/20 text-cetiem-amber",
  HIGH:     "bg-cetiem-red/20 text-cetiem-red",
  CRITICAL: "bg-cetiem-red/40 text-cetiem-red font-bold",
};

const FIND_COLOR: Record<string, string> = {
  COMPLIANCE:     "text-cetiem-lime",
  NON_COMPLIANCE: "text-cetiem-red",
  OBSERVATION:    "text-cetiem-amber",
  RECOMMENDATION: "text-cetiem-teal",
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
        <div className="flex items-center gap-4 px-8 py-5 border-b border-white/5">
          <Link href="/dashboard" className="text-cetiem-gray hover:text-white transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-heading font-bold text-2xl text-white">Mi Certificado ESG</h1>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <Award className="h-16 w-16 text-cetiem-gray/20 mx-auto mb-4" />
            <h2 className="font-heading font-semibold text-white text-lg mb-2">Sin dictamen emitido aún</h2>
            <p className="text-cetiem-gray text-sm mb-6">
              Un Assessor ESG revisará tu expediente cuando hayas subido todos los documentos requeridos y el análisis IA esté completo.
            </p>
            <Link href="/dashboard/documents" className="inline-flex items-center gap-2 bg-cetiem-green hover:bg-cetiem-green/90 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors">
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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-4 px-8 py-5 border-b border-white/5">
        <Link href="/dashboard" className="text-cetiem-gray hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="font-heading font-bold text-2xl text-white">Mi Certificado ESG</h1>
          <p className="text-cetiem-gray text-sm mt-0.5">
            {isApproved ? "Certificación vigente" : CERT_STATUS_LABEL[cert.status] ?? cert.status}
          </p>
        </div>
        {isApproved && (
          <a
            href={`/api/companies/${userId}/certificate`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-cetiem-lime hover:bg-cetiem-lime/90 text-black font-semibold text-sm px-4 py-2 rounded-xl transition-colors"
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
            isApproved ? "bg-cetiem-lime/5 border-cetiem-lime/30" :
            cert.status === "REJECTED" ? "bg-cetiem-red/5 border-cetiem-red/20" :
            "bg-cetiem-amber/5 border-cetiem-amber/20"
          )}>
            <div className="flex items-start gap-4">
              {isApproved ? (
                <Award className="h-12 w-12 text-cetiem-lime shrink-0" />
              ) : cert.status === "REJECTED" ? (
                <XCircle className="h-12 w-12 text-cetiem-red shrink-0" />
              ) : (
                <AlertCircle className="h-12 w-12 text-cetiem-amber shrink-0" />
              )}
              <div className="flex-1">
                <h2 className={cn("font-heading font-bold text-xl mb-1",
                  isApproved ? "text-cetiem-lime" :
                  cert.status === "REJECTED" ? "text-cetiem-red" : "text-cetiem-amber"
                )}>
                  {CERT_STATUS_LABEL[cert.status] ?? cert.status}
                </h2>
                {cert.esgScore !== null && cert.esgScore !== undefined && (
                  <p className="text-white text-sm mb-2">
                    Puntuación ESG: <strong className="text-cetiem-lime">{Math.round(cert.esgScore)}%</strong>
                  </p>
                )}
                {req?.notes && (
                  <p className="text-white/80 text-sm italic border-l-2 border-current/30 pl-3">
                    "{req.notes}"
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Detalles */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-cetiem-card border border-white/5 rounded-2xl p-5">
              <h3 className="font-heading font-semibold text-white text-sm mb-3 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-cetiem-teal" /> Empresa
              </h3>
              <div className="space-y-2 text-sm">
                <div>
                  <p className="text-[10px] text-cetiem-gray/50">Razón Social</p>
                  <p className="text-white font-medium">{company?.companyName || company?.name || company?.email}</p>
                </div>
                {company?.rfc && (
                  <div>
                    <p className="text-[10px] text-cetiem-gray/50">RFC</p>
                    <p className="text-white font-mono text-xs">{company.rfc}</p>
                  </div>
                )}
                {company?.track && (
                  <div>
                    <p className="text-[10px] text-cetiem-gray/50">Track Sectorial</p>
                    <p className="text-cetiem-teal text-xs">{TRACK_LABEL[company.track] ?? company.track}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-cetiem-card border border-white/5 rounded-2xl p-5">
              <h3 className="font-heading font-semibold text-white text-sm mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-cetiem-green" /> Dictamen
              </h3>
              <div className="space-y-2 text-sm">
                <div>
                  <p className="text-[10px] text-cetiem-gray/50">Fecha</p>
                  <p className="text-white">{assessedDate.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}</p>
                </div>
                {req?.assessorEmail && (
                  <div>
                    <p className="text-[10px] text-cetiem-gray/50">Assessor ESG</p>
                    <p className="text-white text-xs">{req.assessorEmail}</p>
                  </div>
                )}
                {isApproved && cert.publicToken && (
                  <div>
                    <p className="text-[10px] text-cetiem-gray/50">Token de verificación</p>
                    <p className="text-cetiem-lime font-mono text-[10px] truncate">{cert.publicToken}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* V.L.A.P. */}
          {vlap && (
            <div className="bg-cetiem-card border border-white/5 rounded-2xl p-5">
              <h3 className="font-heading font-semibold text-white text-sm mb-3 flex items-center gap-2">
                <Shield className="h-4 w-4 text-cetiem-teal" /> Evaluación V.L.A.P.
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {["vigencia", "legibilidad", "autoria", "pertinencia"].map(key => {
                  const item = vlap[key];
                  const passed = item?.value === true;
                  return (
                    <div key={key} className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-xl border text-sm",
                      passed ? "bg-cetiem-lime/5 border-cetiem-lime/20" : "bg-white/3 border-white/5"
                    )}>
                      {passed
                        ? <CheckCircle className="h-4 w-4 text-cetiem-lime shrink-0" />
                        : <XCircle className="h-4 w-4 text-cetiem-red shrink-0" />
                      }
                      <div>
                        <p className="text-white capitalize font-medium text-xs">{key}</p>
                        {item?.confidence !== undefined && (
                          <p className="text-cetiem-gray/50 text-[10px]">Confianza: {item.confidence}%</p>
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
            <div className="bg-cetiem-card border border-white/5 rounded-2xl p-5">
              <h3 className="font-heading font-semibold text-white text-sm mb-3">
                Hallazgos del Assessor ({findings.length})
              </h3>
              <div className="space-y-2">
                {findings.map((f: any, i: number) => (
                  <div key={i} className="bg-white/3 border border-white/5 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={cn("text-[10px] font-medium", FIND_COLOR[f.type] ?? "text-cetiem-gray")}>
                        {FINDING_TYPE_LABEL[f.type] ?? f.type}
                      </span>
                      {f.severity && (
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full", SEV_COLOR[f.severity] ?? "bg-white/10 text-cetiem-gray")}>
                          {f.severity}
                        </span>
                      )}
                    </div>
                    <p className="text-white text-xs font-medium">{f.title}</p>
                    {f.description && <p className="text-cetiem-gray/70 text-[11px] mt-0.5">{f.description}</p>}
                    {f.recommendation && (
                      <p className="text-cetiem-teal/80 text-[11px] mt-1">
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
            <div className="bg-cetiem-amber/5 border border-cetiem-amber/20 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-heading font-semibold text-white text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-cetiem-amber" />
                  Acciones correctivas pendientes ({capaTickets.length})
                </h3>
                <Link href="/dashboard/capa" className="text-xs text-cetiem-amber hover:underline">
                  Gestionar →
                </Link>
              </div>
              <div className="space-y-2">
                {capaTickets.map(ticket => {
                  const days = Math.ceil((new Date(ticket.dueDate).getTime() - Date.now()) / 86400000);
                  return (
                    <div key={ticket.id} className="flex items-center justify-between bg-white/5 rounded-xl p-3 text-xs">
                      <p className="text-white font-medium truncate">{ticket.title}</p>
                      <span className={cn("ml-3 shrink-0 font-medium",
                        days < 0 ? "text-cetiem-red" : days <= 5 ? "text-cetiem-amber" : "text-cetiem-gray"
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
            <div className="bg-cetiem-green/5 border border-cetiem-green/15 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Hash className="h-4 w-4 text-cetiem-green" />
                <h3 className="font-heading font-semibold text-white text-sm">Verificación pública</h3>
              </div>
              <p className="text-cetiem-gray text-xs mb-2">
                Este certificado puede ser verificado de forma independiente con el siguiente token único:
              </p>
              <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 font-mono text-cetiem-lime text-sm break-all">
                {cert.publicToken}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
