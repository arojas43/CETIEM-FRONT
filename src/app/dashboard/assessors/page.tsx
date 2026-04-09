"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRole } from "@/lib/role-context";
import {
  Users, Building2, FileText, CheckCircle, Plus, X,
  RefreshCw, Eye, EyeOff, UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AssessorCompany {
  id: string; companyName: string | null; name: string | null; email: string; track: string | null;
  documents: { id: string; certifications: { status: string }[] }[];
}
interface Assessor {
  id: string; name: string | null; email: string; createdAt: string;
  companies: AssessorCompany[];
}

export default function AssessorsPage() {
  const { role } = useRole();
  const router   = useRouter();
  const isAdmin  = role === "admin";

  useEffect(() => {
    if (role && role !== "admin") router.replace("/dashboard");
  }, [role, router]);

  const [assessors, setAssessors] = useState<Assessor[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState("");
  const [showPwd, setShowPwd]     = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/assessors/list");
      if (res.ok) setAssessors(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const res = await fetch("/api/assessors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error || "Error al crear assessor."); return; }
      setShowForm(false);
      setForm({ name: "", email: "", password: "" });
      await load();
    } catch {
      setFormError("Error de conexión.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/5">
        <div>
          <h1 className="font-heading font-bold text-2xl text-white">Assessors</h1>
          <p className="text-cetiem-gray text-sm mt-0.5">
            {loading ? "Cargando…" : `${assessors.length} assessor${assessors.length !== 1 ? "es" : ""} registrado${assessors.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setShowForm(true); setFormError(""); }}
            className="flex items-center gap-2 bg-cetiem-green hover:bg-cetiem-green/90 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
          >
            <Plus className="h-4 w-4" /> Nuevo Assessor
          </button>
        )}
      </div>

      {/* Create form modal */}
      {showForm && isAdmin && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-cetiem-card border border-white/10 rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-heading font-bold text-white text-lg">Crear Assessor ESG</h2>
              <button onClick={() => setShowForm(false)} className="text-cetiem-gray/50 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs text-cetiem-gray mb-1 block">Nombre completo</label>
                <input
                  type="text" value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Ej: María García"
                  className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:border-cetiem-green"
                />
              </div>
              <div>
                <label className="text-xs text-cetiem-gray mb-1 block">Email *</label>
                <input
                  type="email" value={form.email} required
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="assessor@empresa.com"
                  className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:border-cetiem-green"
                />
              </div>
              <div>
                <label className="text-xs text-cetiem-gray mb-1 block">Contraseña * (mín. 8 caracteres)</label>
                <div className="relative">
                  <input
                    type={showPwd ? "text" : "password"} value={form.password} required
                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    placeholder="••••••••"
                    minLength={8}
                    className="w-full px-3 py-2 pr-10 text-sm bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:border-cetiem-green"
                  />
                  <button type="button" onClick={() => setShowPwd(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-cetiem-gray/40 hover:text-white">
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {formError && (
                <p className="text-cetiem-red text-xs">{formError}</p>
              )}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2 text-sm border border-white/10 rounded-xl text-cetiem-gray hover:text-white transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 text-sm bg-cetiem-green hover:bg-cetiem-green/90 text-white font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  {saving ? "Creando…" : "Crear Assessor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex-1 p-8 overflow-auto">
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-24 bg-cetiem-card border border-white/5 rounded-2xl animate-pulse" />)}
          </div>
        ) : assessors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-cetiem-gray">
            <Users className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-lg font-medium">No hay assessors registrados</p>
            {isAdmin && (
              <button onClick={() => setShowForm(true)}
                className="mt-4 flex items-center gap-2 text-cetiem-green hover:text-cetiem-lime text-sm">
                <Plus className="h-4 w-4" /> Crear el primer assessor
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {assessors.map(assessor => {
              const totalCompanies = assessor.companies.length;
              const totalDocs      = assessor.companies.reduce((s, c) => s + c.documents.length, 0);
              const totalApproved  = assessor.companies.reduce(
                (s, c) => s + c.documents.filter(d => d.certifications[0]?.status === "APPROVED").length, 0
              );
              return (
                <div key={assessor.id} className="bg-cetiem-card border border-white/5 rounded-2xl p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-cetiem-teal/20 flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-cetiem-teal">
                          {(assessor.name || assessor.email)[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-heading font-semibold text-white">{assessor.name || "Sin nombre"}</p>
                        <p className="text-cetiem-gray text-sm">{assessor.email}</p>
                        <p className="text-cetiem-gray/40 text-xs mt-0.5">
                          Desde {new Date(assessor.createdAt).toLocaleDateString("es-MX")}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-5 text-center">
                      {[
                        { icon: Building2, value: totalCompanies, label: "Empresas",  color: "text-white" },
                        { icon: FileText,  value: totalDocs,      label: "Docs",      color: "text-white" },
                        { icon: CheckCircle, value: totalApproved, label: "Aprobados", color: "text-cetiem-lime" },
                      ].map(({ icon: Icon, value, label, color }) => (
                        <div key={label}>
                          <p className={cn("text-xl font-heading font-bold", color)}>{value}</p>
                          <p className="text-[10px] text-cetiem-gray flex items-center gap-1 justify-center">
                            <Icon className="h-3 w-3" /> {label}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {assessor.companies.length > 0 && (
                    <div>
                      <p className="text-xs text-cetiem-gray mb-2 font-medium uppercase tracking-wider flex items-center gap-1">
                        <UserCheck className="h-3 w-3" /> Empresas asignadas
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {assessor.companies.map(c => (
                          <span key={c.id}
                            className="text-xs bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-cetiem-gray">
                            {c.companyName || c.name || c.email}
                            {c.track && <span className="ml-1 text-cetiem-amber font-medium">· {c.track}</span>}
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
