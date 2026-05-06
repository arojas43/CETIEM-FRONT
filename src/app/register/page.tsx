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
    <div className="min-h-screen flex bg-[#F8F8F8]">
      {/* ── Panel Institucional Izquierdo (38%) ───────────────────────── */}
      <div style={{ width: '38%', background: '#611232' }} className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden border-right border-white/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl" />

        <div className="relative z-10">
          <div className="mb-16">
            <InstitutionalLogo variant="white" size="md" />
          </div>

          <div style={{ backgroundColor: '#BC955C', height: '6px', width: '80px', marginBottom: '48px' }} />

          <h2 className="font-heading font-black text-5xl xl:text-6xl text-white leading-[1.1] mb-10">
            Únete al Ecosistema<br />de Confianza
          </h2>
          <p className="text-white/80 text-xl leading-relaxed mb-16 font-light">
            Certificamos el compromiso de su empresa con los estándares ESG globales mediante modelos de IA auditables.
          </p>

          <div className="grid grid-cols-2 gap-6 mt-16">
            {['ISO 9001', 'ISO 14001', 'NOM-035', 'V.L.A.P.'].map(std => (
              <div key={std} className="bg-white/10 border border-white/10 px-8 py-12 backdrop-blur-md hover:bg-white/20 transition-all">
                <div className="text-white font-black text-2xl tracking-tighter">{std}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 p-6 bg-white/5 border border-white/10 rounded-xl">
          <p className="text-white/40 text-xs font-black uppercase tracking-[0.3em] mb-2 text-center">
            GOBIERNO DE MÉXICO · 2024-2030
          </p>
        </div>
      </div>

      {/* ── Panel Formulario Derecho ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col">
        <div className="h-1 bg-[#9D2449] w-full shrink-0" />

        <div className="flex-1 flex items-center justify-center px-10 py-16 overflow-auto">
          <div className="w-full max-w-3xl">
            {/* Step indicator */}
            {step < 3 && (
              <div className="flex items-center gap-8 mb-16">
                {[1, 2].map(s => (
                  <div key={s} className="flex items-center gap-4 flex-1">
                    <div className={cn(
                      "h-14 w-14 rounded-full flex items-center justify-center text-xl font-black border-4 transition-all",
                      step > s ? "bg-[#9D2449] border-[#9D2449] text-white" :
                        step === s ? "bg-white border-[#9D2449] text-[#9D2449] shadow-2xl shadow-primary/10" :
                          "bg-white border-gray-200 text-gray-300"
                    )}>
                      {step > s ? <CheckCircle className="h-8 w-8" /> : s}
                    </div>
                    {s === 1 && (
                      <div className={cn(
                        "flex-1 h-1 mx-4 transition-colors",
                        step > 1 ? "bg-[#9D2449]" : "bg-gray-200"
                      )} />
                    )}
                    <div className="flex flex-col">
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-[0.2em]",
                        step === s ? "text-[#9D2449]" : "text-gray-400"
                      )}>
                        PASO 0{s}
                      </span>
                      <span className={cn(
                        "text-base font-bold",
                        step === s ? "text-[#1B1B1B]" : "text-gray-300"
                      )}>
                        {s === 1 ? "Registro" : "Certificación"}
                      </span>
                    </div>
                    {s === 1 && <div className="flex-1 h-[2px] bg-gray-100 mx-4" />}
                  </div>
                ))}
              </div>
            )}

            {/* Tarjeta de Formulario */}
            <div className="bg-white border-t-[8px] border-[#9D2449] shadow-gob-heavy p-12 md:p-16">
              {step === 1 && (
                <form onSubmit={handleStep1} className="space-y-10">
                  <div className="mb-12">
                    <h1 className="text-4xl font-heading font-black text-[#1B1B1B] uppercase tracking-tight mb-2">
                      Registro Empresarial
                    </h1>
                    <hr style={{ backgroundColor: '#9D2449', border: 'none', height: '6px', width: '100px', marginBottom: '24px' }} />
                    <p className="text-xl text-[#545454] font-light">Proporcione los datos oficiales de su unidad económica.</p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-10">
                    <div className="form-group md:col-span-2">
                      <label className="control-label">Nombre de la empresa *</label>
                      <input
                        className="form-control-gob w-full"
                        value={form.companyName}
                        onChange={set("companyName")}
                        required
                        placeholder="Nombre comercial o razón social"
                      />
                    </div>

                    <div className="form-group">
                      <label className="control-label">RFC</label>
                      <input
                        className="form-control-gob w-full uppercase"
                        value={form.rfc}
                        onChange={set("rfc")}
                        placeholder="XAXX010101000"
                      />
                    </div>

                    <div className="form-group">
                      <label className="control-label">Industria</label>
                      <select
                        className="form-control-gob w-full text-lg cursor-pointer"
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

                    <div className="form-group">
                      <label className="control-label">Correo electrónico *</label>
                      <input
                        className="form-control-gob w-full"
                        type="email"
                        value={form.email}
                        onChange={set("email")}
                        required
                        placeholder="contacto@empresa.com"
                      />
                    </div>

                    <div className="form-group">
                      <label className="control-label">Contraseña *</label>
                      <input
                        className="form-control-gob w-full"
                        type="password"
                        value={form.password}
                        onChange={set("password")}
                        required
                        placeholder="Mínimo 8 caracteres"
                      />
                    </div>

                    <div className="form-group">
                      <label className="control-label">Confirmar contraseña *</label>
                      <input
                        className="form-control-gob w-full"
                        type="password"
                        value={form.confirmPassword}
                        onChange={set("confirmPassword")}
                        required
                        placeholder="Repetir contraseña"
                      />
                    </div>
                  </div>

                  {error && <p className="text-red-600 font-bold bg-red-50 p-4 border-l-4 border-red-600">{error}</p>}

                  <button
                    type="submit"
                    className="btn-gob-primary w-full !py-6 !text-2xl !font-black flex items-center justify-center gap-4 shadow-xl hover:-translate-y-1 transition-all"
                  >
                    CONTINUAR <ArrowRight className="h-7 w-7" />
                  </button>
                </form>
              )}

              {step === 2 && (
                <form onSubmit={handleSubmit} className="space-y-10">
                  <div>
                    <h2 className="text-3xl font-heading font-black text-[#1B1B1B] uppercase tracking-tight mb-2">
                      Track Sectorial ESG
                    </h2>
                    <hr style={{ backgroundColor: '#9D2449', border: 'none', height: '6px', width: '100px', marginBottom: '24px' }} />
                    <p className="text-lg text-[#545454] font-light">Seleccione el track que corresponde al giro de su empresa.</p>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    {TRACKS.map(track => (
                      <button
                        key={track.id}
                        type="button"
                        onClick={() => setForm(p => ({ ...p, track: track.id as "A" | "B" | "C" }))}
                        className={cn(
                          "flex items-start gap-6 p-8 border-2 text-left transition-all relative overflow-hidden",
                          form.track === track.id
                            ? "bg-[#F8F8F8] border-[#9D2449]"
                            : "bg-white border-gray-100 hover:border-gray-200"
                        )}
                      >
                        <div className={cn(
                          "h-12 w-12 flex items-center justify-center font-black text-xl border-2 shrink-0 transition-all",
                          form.track === track.id ? "bg-[#9D2449] border-[#9D2449] text-white" : "border-gray-200 text-gray-300"
                        )}>
                          {track.id}
                        </div>
                        <div className="flex-1">
                          <p className="font-black text-xl text-[#1B1B1B] uppercase mb-1">{track.label}</p>
                          <p className="text-base text-[#545454] mb-4">{track.desc}</p>
                          <div className="flex flex-wrap gap-2">
                            {track.docs.map(d => (
                              <span key={d} className="text-[11px] px-3 py-1 font-bold bg-gray-200 text-gray-600 rounded-sm">
                                {d}
                              </span>
                            ))}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>

                  <label className="flex items-start gap-4 p-4 bg-gray-50 cursor-pointer border-l-4 border-[#BC955C]">
                    <input
                      type="checkbox"
                      checked={form.acceptTerms}
                      onChange={e => setForm(p => ({ ...p, acceptTerms: e.target.checked }))}
                      className="mt-1 h-5 w-5 accent-[#9D2449]"
                    />
                    <span className="text-base text-[#545454]">
                      Acepto los <span className="text-[#9D2449] font-bold underline">términos y condiciones</span> y la política de privacidad institucional.
                    </span>
                  </label>

                  {error && <p className="text-red-600 font-bold bg-red-50 p-4 border-l-4 border-red-600">{error}</p>}

                  <div className="flex gap-6">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="flex-1 py-6 border-2 border-gray-200 hover:border-gray-400 font-bold text-xl uppercase transition-all"
                    >
                      Atrás
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-[2] btn-gob-primary !py-6 !text-2xl !font-black shadow-xl hover:-translate-y-1 transition-all disabled:opacity-50"
                    >
                      {loading ? "REGISTRANDO..." : "COMPLETAR REGISTRO"}
                    </button>
                  </div>
                </form>
              )}

              {step === 3 && (
                <div className="text-center space-y-10">
                  <div className="h-24 w-24 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                    <CheckCircle className="h-12 w-12 text-green-600" />
                  </div>
                  <div>
                    <h1 className="text-4xl font-heading font-black text-[#1B1B1B] uppercase tracking-tight mb-4">
                      ¡Registro Exitoso!
                    </h1>
                    <p className="text-xl text-[#545454] leading-relaxed max-w-lg mx-auto">
                      Su empresa <strong className="text-[#1B1B1B]">{form.companyName}</strong> ha sido registrada en el padrón institucional.
                    </p>
                  </div>
                  <div className="bg-[#F8F8F8] p-8 text-left space-y-4">
                    <p className="text-[#1B1B1B] font-black text-lg mb-4 uppercase tracking-widest">Próximos Pasos:</p>
                    {[
                      "Inicie sesión con sus credenciales",
                      "Siga el track sectorial seleccionado",
                      "Cargue la documentación técnica requerida",
                    ].map((s, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <span className="h-8 w-8 bg-[#9D2449] text-white font-black flex items-center justify-center rounded-full shrink-0">
                          {i + 1}
                        </span>
                        <span className="text-lg text-[#545454]">{s}</span>
                      </div>
                    ))}
                  </div>
                  <Link href="/auth/signin"
                    className="flex items-center justify-center gap-4 w-full btn-gob-primary !py-6 !text-2xl !font-black shadow-2xl hover:-translate-y-1 transition-all">
                    INICIAR SESIÓN <ArrowRight className="h-8 w-8" />
                  </Link>
                </div>
              )}

              <div className="mt-12 text-center pt-8 border-t border-gray-100">
                <p className="text-lg text-[#545454]">
                  ¿Dificultades técnicas?{' '}
                  <span className="text-[#9D2449] font-bold underline cursor-pointer">Soporte Institutional</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
