"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, Mail, Lock, User, Phone, CheckCircle, ArrowRight, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const router = useRouter();
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
    <div className="dark min-h-screen bg-cetiem-dark flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[45%] bg-gradient-to-br from-cetiem-card to-[#050a0f] flex-col justify-between p-12 border-r border-white/5">
        <div>
          <div className="flex items-baseline gap-1.5 mb-12">
            <span className="font-heading font-bold text-lg text-white">SECRETARIA DE ECONOMIA</span>
          </div>
          <h2 className="font-heading font-bold text-3xl text-white leading-tight mb-4">
            Comienza tu proceso<br />de certificación hoy
          </h2>
          <p className="text-cetiem-gray text-base leading-relaxed mb-10">
            Nuestra plataforma usa inteligencia artificial para analizar tus documentos y agilizar el proceso de auditoría.
          </p>
          <div className="space-y-4">
            {[
              { title: "Análisis IA automático",    desc: "Extracción inteligente de entidades y cumplimiento" },
              { title: "Auditor humano asignado",   desc: "Un Data Assessor CETIEM revisa tu expediente" },
              { title: "Certificado digital + QR",  desc: "Descarga tu certificación verificable en minutos" },
            ].map(item => (
              <div key={item.title} className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-cetiem-green/20 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle className="h-3.5 w-3.5 text-cetiem-green" />
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{item.title}</p>
                  <p className="text-cetiem-gray/60 text-xs">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-cetiem-gray/40" />
          <span className="text-cetiem-gray/40 text-xs">Sistema seguro · Datos cifrados · Confidencialidad garantizada</span>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-lg">
          {/* Step indicator */}
          {step < 3 && (
            <div className="flex items-center gap-2 mb-8">
              {[1, 2].map(s => (
                <div key={s} className="flex items-center gap-2 flex-1">
                  <div className={cn(
                    "h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all",
                    step > s  ? "bg-cetiem-green border-cetiem-green text-white" :
                    step === s ? "bg-transparent border-cetiem-green text-cetiem-green" :
                                 "bg-transparent border-white/10 text-cetiem-gray/30"
                  )}>
                    {step > s ? <CheckCircle className="h-3.5 w-3.5" /> : s}
                  </div>
                  <span className={cn("text-xs",
                    step >= s ? "text-white" : "text-cetiem-gray/30"
                  )}>
                    {s === 1 ? "Datos de la empresa" : "Tipo de certificación"}
                  </span>
                  {s < 2 && <div className={cn("flex-1 h-px mx-2", step > s ? "bg-cetiem-green" : "bg-white/10")} />}
                </div>
              ))}
            </div>
          )}

          {/* Step 1 — Company data */}
          {step === 1 && (
            <form onSubmit={handleStep1} className="space-y-5">
              <div>
                <h1 className="font-heading font-bold text-2xl text-white mb-1">Registra tu empresa</h1>
                <p className="text-cetiem-gray text-sm">Crea tu cuenta para iniciar el proceso de certificación.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs text-cetiem-gray mb-1.5 block">Nombre de la empresa *</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cetiem-gray/40" />
                    <input type="text" value={form.companyName} onChange={set("companyName")} required
                      placeholder="Empresa XYZ S.A. de C.V."
                      className="w-full h-10 pl-9 pr-3 bg-cetiem-card border border-white/10 rounded-xl text-white text-sm placeholder-cetiem-gray/30 focus:outline-none focus:border-cetiem-green" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-cetiem-gray mb-1.5 block">RFC</label>
                  <input type="text" value={form.rfc} onChange={set("rfc")}
                    placeholder="EXY900101ABC"
                    className="w-full h-10 px-3 bg-cetiem-card border border-white/10 rounded-xl text-white text-sm placeholder-cetiem-gray/30 focus:outline-none focus:border-cetiem-green" />
                </div>
                <div>
                  <label className="text-xs text-cetiem-gray mb-1.5 block">Industria</label>
                  <select value={form.industry} onChange={set("industry")}
                    className="w-full h-10 px-3 bg-cetiem-card border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-cetiem-green">
                    <option value="">Seleccionar...</option>
                    <option>Manufactura</option>
                    <option>Construcción</option>
                    <option>Servicios</option>
                    <option>Tecnología</option>
                    <option>Salud</option>
                    <option>Educación</option>
                    <option>Otro</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-cetiem-gray mb-1.5 block">Nombre del contacto *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cetiem-gray/40" />
                    <input type="text" value={form.contactName} onChange={set("contactName")} required
                      placeholder="Juan Pérez"
                      className="w-full h-10 pl-9 pr-3 bg-cetiem-card border border-white/10 rounded-xl text-white text-sm placeholder-cetiem-gray/30 focus:outline-none focus:border-cetiem-green" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-cetiem-gray mb-1.5 block">Teléfono</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cetiem-gray/40" />
                    <input type="tel" value={form.phone} onChange={set("phone")}
                      placeholder="+52 55 1234 5678"
                      className="w-full h-10 pl-9 pr-3 bg-cetiem-card border border-white/10 rounded-xl text-white text-sm placeholder-cetiem-gray/30 focus:outline-none focus:border-cetiem-green" />
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-cetiem-gray mb-1.5 block">Correo electrónico *</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cetiem-gray/40" />
                    <input type="email" value={form.email} onChange={set("email")} required
                      placeholder="contacto@empresa.com"
                      className="w-full h-10 pl-9 pr-3 bg-cetiem-card border border-white/10 rounded-xl text-white text-sm placeholder-cetiem-gray/30 focus:outline-none focus:border-cetiem-green" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-cetiem-gray mb-1.5 block">Contraseña *</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cetiem-gray/40" />
                    <input type="password" value={form.password} onChange={set("password")} required
                      placeholder="Mínimo 8 caracteres"
                      className="w-full h-10 pl-9 pr-3 bg-cetiem-card border border-white/10 rounded-xl text-white text-sm placeholder-cetiem-gray/30 focus:outline-none focus:border-cetiem-green" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-cetiem-gray mb-1.5 block">Confirmar contraseña *</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cetiem-gray/40" />
                    <input type="password" value={form.confirmPassword} onChange={set("confirmPassword")} required
                      placeholder="Repetir contraseña"
                      className="w-full h-10 pl-9 pr-3 bg-cetiem-card border border-white/10 rounded-xl text-white text-sm placeholder-cetiem-gray/30 focus:outline-none focus:border-cetiem-green" />
                  </div>
                </div>
              </div>

              {error && <p className="text-cetiem-red text-xs bg-cetiem-red/10 border border-cetiem-red/20 px-3 py-2 rounded-lg">{error}</p>}

              <button type="submit" className="w-full flex items-center justify-center gap-2 bg-cetiem-green hover:bg-cetiem-green/90 text-white font-medium py-2.5 rounded-xl transition-colors">
                Continuar <ArrowRight className="h-4 w-4" />
              </button>

              <p className="text-center text-xs text-cetiem-gray">
                ¿Ya tienes cuenta?{" "}
                <Link href="/auth/signin" className="text-cetiem-green hover:underline">Inicia sesión</Link>
              </p>
            </form>
          )}

          {/* Step 2 — Track sectorial */}
          {step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <h1 className="font-heading font-bold text-2xl text-white mb-1">Track Sectorial ESG</h1>
                <p className="text-cetiem-gray text-sm">Selecciona el track que corresponde al giro de tu empresa. Esto determina los documentos requeridos.</p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {TRACKS.map(track => (
                  <button
                    key={track.id} type="button"
                    onClick={() => setForm(p => ({ ...p, track: track.id as "A"|"B"|"C" }))}
                    className={cn(
                      "flex items-start gap-4 p-4 rounded-xl border text-left transition-all",
                      form.track === track.id
                        ? "bg-cetiem-green/10 border-cetiem-green/40 text-white"
                        : "bg-white/3 border-white/10 text-cetiem-gray hover:border-white/20 hover:text-white"
                    )}
                  >
                    <div className={cn(
                      "h-8 w-8 rounded-xl border-2 flex items-center justify-center shrink-0 font-bold text-sm transition-all",
                      form.track === track.id ? "bg-cetiem-green border-cetiem-green text-white" : "border-white/20 text-cetiem-gray/40"
                    )}>
                      {track.id}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{track.label}</p>
                      <p className="text-xs opacity-60 mb-2">{track.desc}</p>
                      <div className="flex flex-wrap gap-1">
                        {track.docs.map(d => (
                          <span key={d} className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-cetiem-gray/60">{d}</span>
                        ))}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={form.acceptTerms}
                  onChange={e => setForm(p => ({ ...p, acceptTerms: e.target.checked }))}
                  className="mt-0.5 rounded border-white/20" />
                <span className="text-xs text-cetiem-gray">
                  Acepto los{" "}
                  <span className="text-cetiem-green hover:underline cursor-pointer">términos y condiciones</span>
                  {" "}y la{" "}
                  <span className="text-cetiem-green hover:underline cursor-pointer">política de privacidad</span>
                  {" "}de CETIEM S.C.
                </span>
              </label>

              {error && <p className="text-cetiem-red text-xs bg-cetiem-red/10 border border-cetiem-red/20 px-3 py-2 rounded-lg">{error}</p>}

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(1)}
                  className="flex-1 py-2.5 border border-white/10 hover:border-white/20 text-cetiem-gray hover:text-white rounded-xl text-sm transition-colors">
                  Atrás
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 bg-cetiem-green hover:bg-cetiem-green/90 text-white font-medium py-2.5 rounded-xl transition-colors disabled:opacity-50">
                  {loading ? "Registrando..." : "Completar Registro"}
                </button>
              </div>
            </form>
          )}

          {/* Step 3 — Success */}
          {step === 3 && (
            <div className="text-center space-y-6">
              <div className="h-20 w-20 rounded-full bg-cetiem-green/20 flex items-center justify-center mx-auto">
                <CheckCircle className="h-10 w-10 text-cetiem-green" />
              </div>
              <div>
                <h1 className="font-heading font-bold text-2xl text-white mb-2">¡Registro exitoso!</h1>
                <p className="text-cetiem-gray text-sm leading-relaxed">
                  Tu empresa <strong className="text-white">{form.companyName}</strong> ha sido registrada.
                  Un Data Assessor de CETIEM se pondrá en contacto contigo pronto.
                </p>
              </div>
              <div className="bg-cetiem-card border border-white/5 rounded-2xl p-5 text-left space-y-2.5 text-sm">
                <p className="text-white font-medium mb-3">Próximos pasos:</p>
                {[
                  "Inicia sesión con tu correo y contraseña",
                  "Sube los documentos requeridos para tu certificación",
                  "La IA analizará automáticamente tu expediente",
                  "Un Data Assessor revisará y emitirá el dictamen",
                ].map((s, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="h-5 w-5 rounded-full bg-cetiem-green text-white text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <span className="text-cetiem-gray">{s}</span>
                  </div>
                ))}
              </div>
              <Link href="/auth/signin"
                className="flex items-center justify-center gap-2 w-full bg-cetiem-green hover:bg-cetiem-green/90 text-white font-medium py-3 rounded-xl transition-colors">
                Iniciar Sesión <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
