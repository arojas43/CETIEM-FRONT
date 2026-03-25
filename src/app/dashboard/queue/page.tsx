import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Eye, FileText, Clock, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const certStatusColor: Record<string, string> = {
  APPROVED:  "text-cetiem-lime bg-cetiem-lime/10 border-cetiem-lime/20",
  IN_REVIEW: "text-cetiem-amber bg-cetiem-amber/10 border-cetiem-amber/20",
  REJECTED:  "text-cetiem-red bg-cetiem-red/10 border-cetiem-red/20",
};
const certStatusLabel: Record<string, string> = {
  APPROVED:  "✓ Aprobado",
  IN_REVIEW: "↩ Cambios solicitados",
  REJECTED:  "✗ Rechazado",
};

export default async function QueuePage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const queue = await prisma.document.findMany({
    where: { status: { in: ["ANALYZED", "INDEXED"] } },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true, name: true, status: true, domain: true, createdAt: true, updatedAt: true,
      user: { select: { name: true, email: true } },
      certifications: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, status: true, createdAt: true },
      },
    },
  });

  const pending = queue.filter(d => d.certifications.length === 0);
  const reviewed = queue.filter(d => d.certifications.length > 0);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/5">
        <div>
          <h1 className="font-heading font-bold text-2xl text-white">Cola de Revisión</h1>
          <p className="text-cetiem-gray text-sm mt-0.5">Documentos analizados por IA listos para auditoría humana.</p>
        </div>
        <span className={cn("text-sm font-medium px-3 py-1.5 rounded-full border",
          pending.length > 0 ? "text-cetiem-amber bg-cetiem-amber/10 border-cetiem-amber/30"
                             : "text-cetiem-lime bg-cetiem-lime/10 border-cetiem-lime/30"
        )}>
          {pending.length > 0 ? `${pending.length} sin dictamen` : "Al día ✓"}
        </span>
      </div>

      <div className="flex-1 p-8 overflow-auto max-w-4xl space-y-8">
        {/* Pending section */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-cetiem-amber mb-3">
            Sin dictamen · {pending.length}
          </h2>
          {pending.length === 0 ? (
            <div className="text-center py-12 bg-cetiem-card border border-white/5 rounded-2xl">
              <CheckCircle className="h-12 w-12 text-cetiem-lime/30 mx-auto mb-3" />
              <p className="text-cetiem-gray text-sm">No hay documentos pendientes de revisión.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pending.map((doc, i) => (
                <DocRow key={doc.id} doc={doc} index={i} cert={null} />
              ))}
            </div>
          )}
        </section>

        {/* Already reviewed */}
        {reviewed.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-cetiem-gray/50 mb-3">
              Ya dictaminados · {reviewed.length}
            </h2>
            <div className="space-y-3">
              {reviewed.map((doc, i) => (
                <DocRow key={doc.id} doc={doc} index={i} cert={doc.certifications[0]} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function DocRow({ doc, index, cert }: {
  doc: { id: string; name: string; status: string; domain?: string | null; updatedAt: Date; user: { name?: string | null; email?: string | null } };
  index: number;
  cert: { id: string; status: string; createdAt: Date } | null;
}) {
  return (
    <div className={cn(
      "bg-cetiem-card border rounded-2xl p-5 flex items-center gap-4",
      cert ? "border-white/5 opacity-70" : "border-white/5"
    )}>
      <div className="text-cetiem-gray/30 font-mono text-xs w-6 shrink-0 text-right">{index + 1}</div>
      <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
        doc.status === "ANALYZED" ? "bg-cetiem-lime/10" : "bg-cetiem-teal/10"
      )}>
        <FileText className={cn("h-5 w-5", doc.status === "ANALYZED" ? "text-cetiem-lime" : "text-cetiem-teal")} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-medium">{doc.name}</p>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-cetiem-gray/60 text-xs">{doc.user.name || doc.user.email}</span>
          <span className="text-cetiem-gray/30 text-xs">·</span>
          <span className="text-cetiem-teal/70 text-xs capitalize">{doc.domain?.toLowerCase()}</span>
          <span className="text-cetiem-gray/30 text-xs">·</span>
          <span className="text-cetiem-gray/50 text-xs flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {new Date(doc.updatedAt).toLocaleDateString("es-MX")}
          </span>
        </div>
      </div>
      <span className={cn("text-[10px] font-medium px-2.5 py-1 rounded-full border",
        doc.status === "ANALYZED"
          ? "text-cetiem-lime bg-cetiem-lime/10 border-cetiem-lime/20"
          : "text-cetiem-teal bg-cetiem-teal/10 border-cetiem-teal/20"
      )}>
        {doc.status === "ANALYZED" ? "✓ IA Analizado" : "Indexado"}
      </span>
      {cert && (
        <span className={cn("text-[10px] font-medium px-2.5 py-1 rounded-full border", certStatusColor[cert.status])}>
          {certStatusLabel[cert.status] || cert.status}
        </span>
      )}
      <div className="flex items-center gap-2 shrink-0">
        <Link href={`/dashboard/documents/${doc.id}`}
          className="p-2 rounded-lg border border-white/10 hover:border-white/20 text-cetiem-gray hover:text-white transition-colors" title="Ver detalles">
          <Eye className="h-4 w-4" />
        </Link>
        <Link href={`/dashboard/review/${doc.id}`}
          className={cn(
            "flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-xl transition-colors",
            cert
              ? "bg-white/5 hover:bg-white/10 text-cetiem-gray hover:text-white border border-white/10"
              : "bg-cetiem-amber hover:bg-cetiem-amber/90 text-black"
          )}>
          {cert ? "Re-revisar" : "Iniciar Revisión"}
        </Link>
      </div>
    </div>
  );
}
