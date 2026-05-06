import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Building2, FileText, Clock, CheckCircle, ChevronRight, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { MyDocumentIa } from "@/components/ui/icons";

const CERT_COLOR: Record<string, string> = {
  APPROVED:  "text-economia-success   bg-economia-success/10   border-economia-success/20",
  IN_REVIEW: "text-economia-warning  bg-economia-warning/10  border-economia-warning/20",
  REJECTED:  "text-economia-error    bg-economia-error/10    border-economia-error/20",
  CAPA_OPEN: "text-economia-warning  bg-economia-warning/10  border-economia-warning/20",
  REVOKED:   "text-economia-error    bg-economia-error/10    border-economia-error/20",
};
const CERT_LABEL: Record<string, string> = {
  APPROVED:  "✓ Dictamen aprobado",
  IN_REVIEW: "↩ Cambios solicitados",
  REJECTED:  "✗ Rechazado",
  CAPA_OPEN: "⚠ CAPA abierta",
  REVOKED:   "✗ Revocado",
};
const TRACK_LABEL: Record<string, string> = {
  A: "Track A — Industria",
  B: "Track B — Construcción",
  C: "Track C — Tecnología",
};

type QueueCompany = {
  id: string;
  name: string | null;
  email: string;
  companyName: string | null;
  track: string | null;
  sprintLevel: string;
  assessor: { name: string | null; email: string } | null;
  documents: { id: string; status: string; name: string; updatedAt: Date }[];
  companyCertifications: { id: string; status: string; esgScore: number | null; createdAt: Date }[];
};

export default async function QueuePage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  const userRole = (session.user as any).role;
  if (userRole !== "ASSESSOR" && userRole !== "ADMIN") redirect("/dashboard");
  const { saved } = await searchParams;

  // Empresas que tienen al menos un documento en estado ANALYZED o INDEXED
  // Assessors only see their assigned companies; admins see all
  const companies: QueueCompany[] = await prisma.user.findMany({
    where: {
      role: "COMPANY",
      ...(userRole === "ASSESSOR" ? { assessorId: session.user.id } : {}),
      documents: { some: { status: { in: ["ANALYZED", "INDEXED", "PENDING", "PROCESSING"] } } },
    },
    select: {
      id: true,
      name: true,
      email: true,
      companyName: true,
      track: true,
      sprintLevel: true,
      assessor: { select: { name: true, email: true } },
      documents: {
        select: { id: true, status: true, name: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      },
      companyCertifications: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, status: true, esgScore: true, createdAt: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Separar empresas con vs sin dictamen emitido
  const pending  = companies.filter(c => c.companyCertifications.length === 0);
  const reviewed = companies.filter(c => c.companyCertifications.length > 0);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-8 py-5 border-b border-border">
        <div>
          <h1 className="font-heading font-bold text-2xl text-foreground">Cola de Revisión</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Empresas con documentos analizados por IA — listos para dictamen.</p>
        </div>
        <span className={cn("inline-flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-full border",
          pending.length > 0
            ? "text-economia-warning bg-economia-warning/10 border-economia-warning/30"
            : "text-economia-success  bg-economia-success/10  border-economia-success/30"
        )}>
          <MyDocumentIa className="h-4 w-4" /> Iniciar Revisión
        </span>        
        <span className={cn("text-sm font-medium px-3 py-1.5 rounded-full border",
          pending.length > 0
            ? "text-economia-warning bg-economia-warning/10 border-economia-warning/30"
            : "text-economia-success  bg-economia-success/10  border-economia-success/30"
        )}>
          {pending.length > 0 ? `${pending.length} sin dictamen` : "Al día ✓"}
        </span>
      </div>

      <div className="flex-1 p-8 overflow-auto max-w-4xl space-y-8">
        {saved === "1" && (
          <div className="bg-economia-success/10 border border-economia-success/30 rounded-2xl px-5 py-3 flex items-center gap-3">
            <CheckCircle className="h-4 w-4 text-economia-success shrink-0" />
            <p className="text-economia-success text-sm font-medium">Dictamen guardado correctamente.</p>
          </div>
        )}

        {/* Sin dictamen */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-economia-warning mb-3">
            Sin dictamen · {pending.length}
          </h2>
          {pending.length === 0 ? (
            <div className="text-center py-12 bg-card border border-border rounded-2xl">
              <CheckCircle className="h-12 w-12 text-economia-success/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No hay empresas pendientes de revisión.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pending.map((company, i) => (
                <CompanyRow key={company.id} company={company} index={i} cert={null} />
              ))}
            </div>
          )}
        </section>

        {/* Ya dictaminadas */}
        {reviewed.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/50 mb-3">
              Ya dictaminadas · {reviewed.length}
            </h2>
            <div className="space-y-3">
              {reviewed.map((company, i) => (
                <CompanyRow key={company.id} company={company} index={i} cert={company.companyCertifications[0]} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function CompanyRow({ company, index, cert }: {
  company: {
    id: string;
    name: string | null;
    email: string;
    companyName: string | null;
    track: string | null;
    sprintLevel: string;
    assessor: { name: string | null; email: string } | null;
    documents: { id: string; status: string; name: string; updatedAt: Date }[];
  };
  index: number;
  cert: { id: string; status: string; esgScore: number | null; createdAt: Date } | null;
}) {
  const docs = company.documents;
  const analyzed  = docs.filter(d => d.status === "ANALYZED").length;
  const total     = docs.length;
  const lastDoc   = docs[0];

  return (
    <div className={cn(
      "bg-card border rounded-2xl p-5 flex items-center gap-4",
      cert ? "border-border opacity-75" : "border-border"
    )}>
      <div className="text-muted-foreground/30 font-mono text-xs w-6 shrink-0 text-right">{index + 1}</div>

      {/* Icon */}
      <div className="h-10 w-10 rounded-xl bg-economia-info/10 flex items-center justify-center shrink-0">
        <Building2 className="h-5 w-5 text-economia-info" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-foreground font-medium truncate">
          {company.companyName || company.name || company.email}
        </p>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {company.track && (
            <span className="text-economia-info/70 text-xs">{TRACK_LABEL[company.track] ?? company.track}</span>
          )}
          <span className="text-muted-foreground/30 text-xs">·</span>
          {/* Doc counts */}
          <span className="text-xs flex items-center gap-1">
            <FileText className="h-3 w-3 text-muted-foreground/50" />
            <span className={cn(analyzed === total && total > 0 ? "text-economia-success" : "text-economia-warning")}>
              {analyzed}/{total} analizados
            </span>
          </span>
          {company.assessor && (
            <>
              <span className="text-muted-foreground/30 text-xs">·</span>
              <span className="text-xs flex items-center gap-1 text-muted-foreground/60">
                <Users className="h-3 w-3" />
                {company.assessor.name || company.assessor.email}
              </span>
            </>
          )}
          {lastDoc && (
            <>
              <span className="text-muted-foreground/30 text-xs">·</span>
              <span className="text-muted-foreground/50 text-xs flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(lastDoc.updatedAt).toLocaleDateString("es-MX")}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Cert badge */}
      {cert && (
        <span className={cn("text-[10px] font-medium px-2.5 py-1 rounded-full border shrink-0", CERT_COLOR[cert.status])}>
          {CERT_LABEL[cert.status] ?? cert.status}
          {cert.esgScore != null && ` · ${Math.round(cert.esgScore)}%`}
        </span>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href={`/dashboard/review/company/${company.id}`}
          className={cn(
            "flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-xl transition-colors",
            cert
              ? "bg-muted hover:bg-muted text-muted-foreground hover:text-foreground border border-border"
              : "bg-economia-warning hover:bg-economia-warning/90 text-black"
          )}
        >
          {cert ? "Revisar dictamen" : "Iniciar revisión"}
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
