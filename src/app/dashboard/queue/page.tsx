import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Eye, FileText, Clock, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default async function QueuePage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const queue = await prisma.document.findMany({
    where: { status: { in: ["ANALYZED", "INDEXED"] } },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true, name: true, status: true, domain: true, createdAt: true, updatedAt: true,
      user: { select: { name: true, email: true } },
    },
  });

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/5">
        <div>
          <h1 className="font-heading font-bold text-2xl text-white">Cola de Revisión</h1>
          <p className="text-cetiem-gray text-sm mt-0.5">Documentos analizados por IA listos para auditoría humana.</p>
        </div>
        <span className={cn("text-sm font-medium px-3 py-1.5 rounded-full border",
          queue.length > 0 ? "text-cetiem-amber bg-cetiem-amber/10 border-cetiem-amber/30"
                           : "text-cetiem-lime bg-cetiem-lime/10 border-cetiem-lime/30"
        )}>
          {queue.length > 0 ? `${queue.length} pendiente${queue.length !== 1 ? "s" : ""}` : "Cola vacía ✓"}
        </span>
      </div>

      <div className="flex-1 p-8 overflow-auto max-w-4xl">
        {queue.length === 0 ? (
          <div className="text-center py-20">
            <CheckCircle className="h-16 w-16 text-cetiem-lime/30 mx-auto mb-4" />
            <h2 className="font-heading font-semibold text-white text-lg mb-2">Cola vacía</h2>
            <p className="text-cetiem-gray text-sm">No hay documentos pendientes de revisión en este momento.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {queue.map((doc, i) => (
              <div key={doc.id} className="bg-cetiem-card border border-white/5 rounded-2xl p-5 flex items-center gap-4">
                <div className="text-cetiem-gray/30 font-mono text-xs w-6 shrink-0 text-right">{i + 1}</div>
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
                <div className="flex items-center gap-2 shrink-0">
                  <Link href={`/dashboard/documents/${doc.id}`}
                    className="p-2 rounded-lg border border-white/10 hover:border-white/20 text-cetiem-gray hover:text-white transition-colors" title="Ver detalles">
                    <Eye className="h-4 w-4" />
                  </Link>
                  <Link href={`/dashboard/review/${doc.id}`}
                    className="flex items-center gap-2 bg-cetiem-amber hover:bg-cetiem-amber/90 text-black text-sm font-bold px-4 py-2 rounded-xl transition-colors">
                    Iniciar Revisión
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
