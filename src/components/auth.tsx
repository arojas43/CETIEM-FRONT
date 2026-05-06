"use client";

import { useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { InstitutionalLogo } from "@/components/institutional-logo";
import { Loader2, ArrowRight, Shield, Zap, BarChart3, CheckCircle2 } from "lucide-react";

export function AuthButton() {
  const { data: session } = useSession();

  if (session) {
    return (
      <div className="flex items-center gap-4">
        <span className="text-sm text-white/50">{session.user?.name || session.user?.email}</span>
        <Button variant="outline" onClick={() => signOut()}>Cerrar sesión</Button>
      </div>
    );
  }

  return <Button onClick={() => signIn("credentials")}>Iniciar sesión</Button>;
}

const FEATURES = [
  { icon: Zap,       label: "Filtro Cero IA",    desc: "Análisis automático con NVIDIA NIM + Kimi K2" },
  { icon: Shield,    label: "Protocolo V.L.A.P.", desc: "Validación sin sesgos, Human-in-the-loop" },
  { icon: BarChart3, label: "Continuous Compliance", desc: "Monitoreo proactivo y alertas de vencimiento" },
  { icon: CheckCircle2, label: "Certificación ESG",  desc: "Dictamen digital verificable y auditable" },
];

export function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        setError("Credenciales inválidas. Verifica tu correo y contraseña.");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("Error de conexión. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: '#0A0A0A' }}>

      {/* ── Panel izquierdo CETIEM (40%) ───────────────────────── */}
      <div className="hidden lg:flex lg:w-[42%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: '#0D0D0D', borderRight: '1px solid rgba(255,255,255,0.06)' }}>

        {/* Background glow */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-96 h-96 rounded-full"
            style={{ background: 'radial-gradient(ellipse, rgba(0,212,122,0.12) 0%, transparent 70%)' }} />
          <div className="absolute bottom-[10%] right-[-10%] w-72 h-72 rounded-full"
            style={{ background: 'radial-gradient(ellipse, rgba(0,200,224,0.08) 0%, transparent 70%)' }} />
        </div>

        {/* Logo */}
        <div className="relative z-10">
          <InstitutionalLogo size="md" />
        </div>

        {/* Hero text */}
        <div className="relative z-10 space-y-6">
          <div>
            <div className="w-10 h-0.5 bg-[#00D47A] mb-6" />
            <h2 className="text-white font-black text-5xl leading-[1.1] tracking-tight">
              Plataforma de<br />
              <span className="text-[#00D47A]">Certificación</span><br />
              ESG
            </h2>
            <p className="text-white/40 text-base mt-6 leading-relaxed max-w-xs">
              Agile Audit Hub impulsado por IA — análisis V.L.A.P. automático para PyMEs mexicanas.
            </p>
          </div>

          {/* Feature list */}
          <div className="space-y-3">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-3 p-3 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: 'rgba(0,212,122,0.12)' }}>
                  <Icon className="h-3.5 w-3.5 text-[#00D47A]" />
                </div>
                <div>
                  <p className="text-white/80 text-xs font-bold">{label}</p>
                  <p className="text-white/30 text-[10px] mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-white/20 text-[10px] uppercase tracking-[0.25em] font-bold">
            CETIEM S.C. · CIPRE HOLDING · {new Date().getFullYear()}
          </p>
        </div>
      </div>

      {/* ── Panel derecho — formulario (60%) ───────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12"
        style={{ background: '#0A0A0A' }}>

        {/* Mobile logo */}
        <div className="lg:hidden mb-10">
          <InstitutionalLogo size="md" />
        </div>

        <div className="w-full max-w-sm">
          {/* Card */}
          <div className="p-8 rounded-2xl" style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <h1 className="text-2xl font-black text-white tracking-tight mb-1">
              Iniciar sesión
            </h1>
            <p className="text-white/40 text-sm mb-8">
              Ingresa tus credenciales para continuar
            </p>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg mb-6 text-sm"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171' }}>
                <span className="font-bold">Error:</span> {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-2">
                  Correo electrónico
                </label>
                <input
                  id="email" name="email" type="email"
                  autoComplete="email" required
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  className="form-control w-full"
                  placeholder="correo@empresa.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-2">
                  Contraseña
                </label>
                <input
                  id="password" name="password" type="password"
                  autoComplete="current-password" required
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className="form-control w-full"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit" disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-black text-black transition-all mt-2"
                style={{
                  background: loading ? 'rgba(0,212,122,0.5)' : '#00D47A',
                  boxShadow: loading ? 'none' : '0 0 20px rgba(0,212,122,0.3)',
                }}
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Verificando...</>
                ) : (
                  <>Ingresar <ArrowRight className="h-4 w-4" /></>
                )}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t text-center" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <p className="text-xs text-white/30">
                ¿Empresa no registrada?{' '}
                <Link href="/register" className="text-[#00D47A] font-bold hover:underline">
                  Solicitar acceso
                </Link>
              </p>
            </div>
          </div>

          <p className="text-center text-[10px] text-white/15 uppercase tracking-[0.25em] font-bold mt-8">
            CETIEM · Agile Audit Hub · ESG México
          </p>
        </div>
      </div>
    </div>
  );
}
