"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { InstitutionalLogo } from "@/components/institutional-logo";

const TRACKS = [
  {
    id: "A", label: "Track A — Industria",
    desc: "Manufactura, agroindustria, minería, automotriz",
    docs: ["Política ambiental", "Reportes NOM-035", "Permisos LAU", "Declaraciones SAT"],
  },
  {
    id: "B", label: "Track B — Construcción",
    desc: "Inmobiliaria, infraestructura, obra civil",
    docs: ["Permisos de construcción", "Estudio de impacto", "Contratos colectivos", "Reportes de seguridad"],
  },
  {
    id: "C", label: "Track C — Tecnología / Servicios",
    desc: "Software, consultoría, fintech, educación",
    docs: ["Política de privacidad", "Aviso de privacidad LFPDPPP", "Contratos de servicio", "Reportes ESG"],
  },
];

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    companyName: "",
    rfc: "",
    industry: "",
    phone: "",
    website: "",
    contactName: "",
    email: "",
    password: "",
    confirmPassword: "",
    track: "" as "A" | "B" | "C" | "",
    acceptTerms: false,
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyName || !form.contactName || !form.email) {
      setError("Por favor completa todos los campos obligatorios."); return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Las contraseñas no coinciden."); return;
    }
    if (form.password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres."); return;
    }
    setError(""); setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.acceptTerms) { setError("Debes aceptar los términos y condiciones."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          contactName: form.contactName,
          companyName: form.companyName,
          rfc: form.rfc,
          industry: form.industry,
          phone: form.phone,
          track: form.track || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Error al registrar."); return; }
      setStep(3);
    } catch {
      setError("Error al registrar. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: "#0A0A0A" }}>
      {/* ── Left panel (38%) ───────────────────────────── */}
      <div
        className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden"
        style={{
          width: "38%",
          background: "#0D0D0D",
          borderRight: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* Green radial glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 65% 55% at 25% 15%, rgba(0,212,122,0.11) 0%, transparent 70%)",
          }}
        />
        {/* Cyan bottom-right glow */}
        <div
          className="absolute bottom-0 right-0 w-96 h-96 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 60% 60% at 80% 90%, rgba(0,200,224,0.07) 0%, transparent 70%)",
          }}
        />

        <div className="relative z-10">
          <div className="mb-14">
            <InstitutionalLogo size="md" />
          </div>

          {/* Accent bar */}
          <div
            style={{
              background: "#00D47A",
              height: "3px",
              width: "56px",
              marginBottom: "40px",
              borderRadius: "2px",
            }}
          />

          <h2 className="font-sans font-black text-4xl xl:text-5xl text-white leading-[1.1] mb-6">
            Únete al Ecosistema
            <br />
            <span style={{ color: "#00D47A" }}>de Confianza</span>
          </h2>
          <p className="text-white/55 text-lg leading-relaxed mb-12 font-light">
            Certificamos el compromiso de su empresa con los estándares ESG globales
            mediante modelos de IA auditables.
          </p>

          {/* CETIEM features */}
          <div className="space-y-3">
            {[
              { label: "Filtro Cero IA", desc: "Auditoría documental con IA explicable" },
              { label: "Protocolo VLAP", desc: "Validación de lineamientos y activos productivos" },
              { label: "Agile Audit Hub", desc: "Dashboard de cumplimiento en tiempo real" },
              { label: "Certificación ESG", desc: "Estándares internacionales ISO 9001 · 14001" },
            ].map(f => (
              <div
                key={f.label}
                className="flex items-start gap-4 p-4 rounded-xl"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div
                  className="h-2 w-2 rounded-full mt-2 shrink-0"
                  style={{ background: "#00D47A", boxShadow: "0 0 8px rgba(0,212,122,0.7)" }}
                />
                <div>
                  <p className="text-white font-bold text-sm">{f.label}</p>
                  <p className="text-white/35 text-xs mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-white/20 text-xs font-bold uppercase tracking-[0.3em] text-center">
            CETIEM S.C. · CIPRE HOLDING
          </p>
        </div>
      </div>

      {/* ── Right panel ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col" style={{ background: "#0A0A0A" }}>
        {/* Top accent gradient line */}
        <div
          style={{
            height: "2px",
            background: "linear-gradient(90deg, #00D47A 0%, #00C8E0 50%, transparent 100%)",
            flexShrink: 0,
          }}
        />

        <div className="flex-1 flex items-center justify-center px-8 py-12 overflow-auto">
          <div className="w-full max-w-2xl">

            {/* Step indicator */}
            {step < 3 && (
              <div className="flex items-center gap-4 mb-10">
                {[1, 2].map(s => (
                  <div key={s} className="flex items-center gap-3 flex-1">
                    <div
                      className={cn(
                        "h-10 w-10 rounded-full flex items-center justify-center text-sm font-black border-2 transition-all shrink-0",
                        step > s
                          ? "border-[#00D47A] bg-[#00D47A] text-black"
                          : step === s
                          ? "border-[#00D47A] bg-transparent text-[#00D47A]"
                          : "border-white/10 bg-transparent text-white/20"
                      )}
                      style={
                        step === s
                          ? { boxShadow: "0 0 14px rgba(0,212,122,0.40)" }
                          : undefined
                      }
                    >
                      {step > s ? <CheckCircle className="h-5 w-5" /> : s}
                    </div>
                    <div className="flex flex-col">
                      <span
                        className={cn(
                          "text-[9px] font-black uppercase tracking-[0.2em]",
                          step === s ? "text-[#00D47A]" : "text-white/20"
                        )}
                      >
                        PASO 0{s}
                      </span>
                      <span
                        className={cn(
                          "text-sm font-bold",
                          step === s ? "text-white" : "text-white/20"
                        )}
                      >
                        {s === 1 ? "Registro" : "Certificación"}
                      </span>
                    </div>
                    {s === 1 && (
                      <div
                        className="flex-1 h-px mx-2 transition-colors"
                        style={{
                          background:
                            step > 1 ? "#00D47A" : "rgba(255,255,255,0.08)",
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Glassmorphism card */}
            <div
              className="rounded-2xl p-8 md:p-10"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {/* ── Step 1: Account & Company info ── */}
              {step === 1 && (
                <form onSubmit={handleStep1} className="space-y-7">
                  <div>
                    <h1 className="font-sans font-black text-2xl text-white uppercase tracking-tight mb-1">
                      Registro Empresarial
                    </h1>
                    <div
                      style={{
                        background: "#00D47A",
                        height: "2px",
                        width: "48px",
                        borderRadius: "2px",
                        margin: "10px 0 14px",
                      }}
                    />
                    <p className="text-white/40 text-sm font-light">
                      Proporcione los datos oficiales de su unidad económica.
                    </p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-5">
                    <div className="md:col-span-2 space-y-1.5">
                      <label className="text-xs font-bold text-white/50 uppercase tracking-widest block">
                        Nombre de la empresa *
                      </label>
                      <input
                        className="form-control w-full"
                        value={form.companyName}
                        onChange={set("companyName")}
                        required
                        placeholder="Nombre comercial o razón social"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-white/50 uppercase tracking-widest block">
                        RFC
                      </label>
                      <input
                        className="form-control w-full uppercase"
                        value={form.rfc}
                        onChange={set("rfc")}
                        placeholder="XAXX010101000"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-white/50 uppercase tracking-widest block">
                        Industria
                      </label>
                      <select
                        className="form-control w-full cursor-pointer"
                        value={form.industry}
                        onChange={set("industry")}
                      >
                        <option value="">Seleccionar...</option>
                        <option>Manufactura</option>
                        <option>Construcción</option>
                        <option>Servicios</option>
                        <option>Tecnología</option>
                        <option>Energía</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-white/50 uppercase tracking-widest block">
                        Nombre de contacto *
                      </label>
                      <input
                        className="form-control w-full"
                        value={form.contactName}
                        onChange={set("contactName")}
                        required
                        placeholder="Nombre completo"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-white/50 uppercase tracking-widest block">
                        Correo electrónico *
                      </label>
                      <input
                        className="form-control w-full"
                        type="email"
                        value={form.email}
                        onChange={set("email")}
                        required
                        placeholder="contacto@empresa.com"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-white/50 uppercase tracking-widest block">
                        Contraseña *
                      </label>
                      <input
                        className="form-control w-full"
                        type="password"
                        value={form.password}
                        onChange={set("password")}
                        required
                        placeholder="Mínimo 8 caracteres"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-white/50 uppercase tracking-widest block">
                        Confirmar contraseña *
                      </label>
                      <input
                        className="form-control w-full"
                        type="password"
                        value={form.confirmPassword}
                        onChange={set("confirmPassword")}
                        required
                        placeholder="Repetir contraseña"
                      />
                    </div>
                  </div>

                  {error && (
                    <div
                      className="rounded-lg px-4 py-3"
                      style={{
                        background: "rgba(239,68,68,0.10)",
                        border: "1px solid rgba(239,68,68,0.20)",
                      }}
                    >
                      <p className="text-red-400 text-sm font-medium">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-3 py-3 rounded-lg font-black text-sm uppercase tracking-wide transition-all hover:-translate-y-0.5"
                    style={{
                      background: "#00D47A",
                      color: "#000",
                      boxShadow: "0 0 24px rgba(0,212,122,0.35)",
                    }}
                  >
                    CONTINUAR <ArrowRight className="h-5 w-5" />
                  </button>

                  <p className="text-center text-white/30 text-sm">
                    ¿Ya tienes cuenta?{" "}
                    <Link
                      href="/auth/signin"
                      className="font-bold"
                      style={{ color: "#00D47A" }}
                    >
                      Iniciar sesión
                    </Link>
                  </p>
                </form>
              )}

              {/* ── Step 2: Track selection ── */}
              {step === 2 && (
                <form onSubmit={handleSubmit} className="space-y-7">
                  <div>
                    <h2 className="font-sans font-black text-2xl text-white uppercase tracking-tight mb-1">
                      Track Sectorial ESG
                    </h2>
                    <div
                      style={{
                        background: "#00D47A",
                        height: "2px",
                        width: "48px",
                        borderRadius: "2px",
                        margin: "10px 0 14px",
                      }}
                    />
                    <p className="text-white/40 text-sm font-light">
                      Seleccione el track que corresponde al giro de su empresa.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {TRACKS.map(track => (
                      <button
                        key={track.id}
                        type="button"
                        onClick={() =>
                          setForm(p => ({ ...p, track: track.id as "A" | "B" | "C" }))
                        }
                        className="flex items-start gap-5 p-5 rounded-xl text-left transition-all"
                        style={{
                          background:
                            form.track === track.id
                              ? "rgba(0,212,122,0.05)"
                              : "rgba(255,255,255,0.03)",
                          border:
                            form.track === track.id
                              ? "1px solid #00D47A"
                              : "1px solid rgba(255,255,255,0.08)",
                        }}
                      >
                        <div
                          className="h-10 w-10 flex items-center justify-center font-black text-sm rounded-lg shrink-0 transition-all"
                          style={{
                            background:
                              form.track === track.id
                                ? "#00D47A"
                                : "rgba(255,255,255,0.05)",
                            color:
                              form.track === track.id
                                ? "#000"
                                : "rgba(255,255,255,0.30)",
                            border:
                              form.track === track.id
                                ? "none"
                                : "1px solid rgba(255,255,255,0.08)",
                          }}
                        >
                          {track.id}
                        </div>
                        <div className="flex-1">
                          <p className="font-black text-sm text-white uppercase tracking-wide mb-1">
                            {track.label}
                          </p>
                          <p className="text-white/40 text-xs mb-3">{track.desc}</p>
                          <div className="flex flex-wrap gap-2">
                            {track.docs.map(d => (
                              <span
                                key={d}
                                className="text-[10px] px-2 py-0.5 font-bold rounded"
                                style={{
                                  background: "rgba(255,255,255,0.06)",
                                  color: "rgba(255,255,255,0.40)",
                                }}
                              >
                                {d}
                              </span>
                            ))}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>

                  <label
                    className="flex items-start gap-3 p-4 rounded-xl cursor-pointer"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={form.acceptTerms}
                      onChange={e =>
                        setForm(p => ({ ...p, acceptTerms: e.target.checked }))
                      }
                      className="mt-0.5 h-4 w-4 shrink-0"
                      style={{ accentColor: "#00D47A" }}
                    />
                    <span className="text-sm text-white/50">
                      Acepto los{" "}
                      <span
                        className="font-bold underline"
                        style={{ color: "#00D47A" }}
                      >
                        términos y condiciones
                      </span>{" "}
                      y la política de privacidad institucional.
                    </span>
                  </label>

                  {error && (
                    <div
                      className="rounded-lg px-4 py-3"
                      style={{
                        background: "rgba(239,68,68,0.10)",
                        border: "1px solid rgba(239,68,68,0.20)",
                      }}
                    >
                      <p className="text-red-400 text-sm font-medium">{error}</p>
                    </div>
                  )}

                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="flex-1 py-3 rounded-lg font-bold text-sm uppercase tracking-wide transition-all text-white/50 hover:text-white"
                      style={{
                        border: "1px solid rgba(255,255,255,0.08)",
                        background: "transparent",
                      }}
                    >
                      Atrás
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-[2] py-3 rounded-lg font-black text-sm uppercase tracking-wide transition-all hover:-translate-y-0.5 disabled:opacity-50"
                      style={{
                        background: "#00D47A",
                        color: "#000",
                        boxShadow: "0 0 24px rgba(0,212,122,0.35)",
                      }}
                    >
                      {loading ? "REGISTRANDO..." : "COMPLETAR REGISTRO"}
                    </button>
                  </div>
                </form>
              )}

              {/* ── Step 3: Success ── */}
              {step === 3 && (
                <div className="text-center space-y-8">
                  <div
                    className="h-20 w-20 rounded-full flex items-center justify-center mx-auto"
                    style={{
                      background: "rgba(0,212,122,0.10)",
                      border: "2px solid rgba(0,212,122,0.30)",
                      boxShadow: "0 0 32px rgba(0,212,122,0.20)",
                    }}
                  >
                    <CheckCircle className="h-10 w-10" style={{ color: "#00D47A" }} />
                  </div>

                  <div>
                    <h1
                      className="font-sans font-black text-3xl uppercase tracking-tight mb-3"
                      style={{ color: "#00D47A" }}
                    >
                      ¡Registro Exitoso!
                    </h1>
                    <p className="text-white/50 text-base leading-relaxed max-w-md mx-auto">
                      Su empresa{" "}
                      <strong className="text-white">{form.companyName}</strong>{" "}
                      ha sido registrada en el padrón institucional.
                    </p>
                  </div>

                  <div
                    className="p-6 rounded-xl text-left space-y-3"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <p className="text-white/30 font-black text-xs uppercase tracking-widest mb-4">
                      Próximos Pasos
                    </p>
                    {[
                      "Inicie sesión con sus credenciales",
                      "Siga el track sectorial seleccionado",
                      "Cargue la documentación técnica requerida",
                    ].map((s, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span
                          className="h-6 w-6 font-black text-xs flex items-center justify-center rounded-full shrink-0"
                          style={{ background: "#00D47A", color: "#000" }}
                        >
                          {i + 1}
                        </span>
                        <span className="text-sm text-white/60">{s}</span>
                      </div>
                    ))}
                  </div>

                  <Link
                    href="/auth/signin"
                    className="flex items-center justify-center gap-3 w-full py-3 rounded-lg font-black text-sm uppercase tracking-wide transition-all hover:-translate-y-0.5"
                    style={{
                      background: "#00D47A",
                      color: "#000",
                      boxShadow: "0 0 24px rgba(0,212,122,0.35)",
                    }}
                  >
                    INICIAR SESIÓN <ArrowRight className="h-5 w-5" />
                  </Link>
                </div>
              )}

              {/* Footer */}
              <div
                className="mt-8 pt-5"
                style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
              >
                <p className="text-center text-white/20 text-xs">
                  CETIEM S.C. · CIPRE HOLDING
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
