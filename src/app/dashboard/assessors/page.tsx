import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Users, Building2, FileText, CheckCircle } from "lucide-react";

export default async function AssessorsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const role = (session.user as any).role as string | undefined;
  if (!role || !["ASSESSOR", "ADMIN"].includes(role)) redirect("/dashboard");

  const assessors = await prisma.user.findMany({
    where: { role: "ASSESSOR" },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      companies: {
        select: {
          id: true,
          companyName: true,
          name: true,
          email: true,
          track: true,
          documents: {
            select: {
              id: true,
              certifications: {
                orderBy: { createdAt: "desc" },
                take: 1,
                select: { status: true },
              },
            },
          },
        },
      },
    },
  });

  return (
    <div className="flex flex-col h-full">
      <div className="px-8 py-5 border-b border-white/5">
        <h1 className="font-heading font-bold text-2xl text-white">Assessors</h1>
        <p className="text-cetiem-gray text-sm mt-0.5">{assessors.length} assessor{assessors.length !== 1 ? "es" : ""} registrados</p>
      </div>

      <div className="flex-1 p-8 overflow-auto">
        {assessors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-cetiem-gray">
            <Users className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-lg font-medium">No hay assessors registrados</p>
            <p className="text-sm mt-1 opacity-70">Los assessors se registran desde el panel de administración.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {assessors.map((assessor) => {
              const totalCompanies = assessor.companies.length;
              const totalDocs = assessor.companies.reduce((sum, c) => sum + c.documents.length, 0);
              const totalApproved = assessor.companies.reduce(
                (sum, c) => sum + c.documents.filter(d => d.certifications[0]?.status === "APPROVED").length,
                0
              );

              return (
                <div key={assessor.id} className="bg-cetiem-card border border-white/5 rounded-2xl p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="font-heading font-semibold text-white">{assessor.name || "Sin nombre"}</p>
                      <p className="text-cetiem-gray text-sm">{assessor.email}</p>
                      <p className="text-cetiem-gray/50 text-xs mt-0.5">
                        Desde {new Date(assessor.createdAt).toLocaleDateString("es-MX")}
                      </p>
                    </div>
                    <div className="flex gap-4 text-center">
                      <div>
                        <p className="text-xl font-heading font-bold text-white">{totalCompanies}</p>
                        <p className="text-[10px] text-cetiem-gray flex items-center gap-1">
                          <Building2 className="h-3 w-3" /> Empresas
                        </p>
                      </div>
                      <div>
                        <p className="text-xl font-heading font-bold text-white">{totalDocs}</p>
                        <p className="text-[10px] text-cetiem-gray flex items-center gap-1">
                          <FileText className="h-3 w-3" /> Docs
                        </p>
                      </div>
                      <div>
                        <p className="text-xl font-heading font-bold text-cetiem-lime">{totalApproved}</p>
                        <p className="text-[10px] text-cetiem-gray flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" /> Aprobados
                        </p>
                      </div>
                    </div>
                  </div>

                  {assessor.companies.length > 0 && (
                    <div>
                      <p className="text-xs text-cetiem-gray mb-2 font-medium uppercase tracking-wider">Empresas asignadas</p>
                      <div className="flex flex-wrap gap-2">
                        {assessor.companies.map((company) => (
                          <span
                            key={company.id}
                            className="text-xs bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-cetiem-gray"
                          >
                            {company.companyName || company.name || company.email}
                            {company.track && (
                              <span className="ml-1 text-cetiem-amber font-medium">· {company.track}</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
