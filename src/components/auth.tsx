"use client";

import { useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { InstitutionalLogo } from "@/components/institutional-logo";

export function AuthButton() {
  const { data: session } = useSession();

  if (session) {
    return (
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground hidden sm:inline">
          {session.user?.name || session.user?.email}
        </span>
        <Button variant="outline" onClick={() => signOut()}>
          Cerrar sesión
        </Button>
      </div>
    );
  }

  return (
    <Button onClick={() => signIn("credentials")}>
      Iniciar sesión
    </Button>
  );
}

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
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Credenciales inválidas. Verifique su correo y contraseña.");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("Error de conexión. Intente nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#FFFFFF]">

      {/* ── Panel Institucional Izquierdo (40%) ──────────────────────── */}
      <div style={{ width: '38%', background: '#611232', flexDirection: 'column', justifyContent: 'space-between', padding: '3rem', position: 'relative', overflow: 'hidden', borderRight: '1px solid rgba(157,36,73,0.3)' }} className="flex">
        {/* Decoración de fondo */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#9D2449]/30 rounded-full -mr-32 -mt-32 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#BC955C]/20 rounded-full -ml-24 -mb-24 blur-2xl" />

        <div className="relative z-10">
          <div className="mb-12">
            <InstitutionalLogo variant="white" size="md" />
          </div>

          <div style={{ backgroundColor: '#BC955C', height: '4px', width: '64px', marginBottom: '32px' }} />

          <h2 className="text-white font-heading font-black text-4xl xl:text-6xl leading-none mb-10">
            Plataforma de<br />
            Certificación<br />
            Empresarial ESG
          </h2>

          <p className="text-white/80 text-lg leading-relaxed max-w-sm font-light">
            Sistema de certificación digital impulsado por Inteligencia Artificial de NVIDIA NIM para el cumplimiento normativo empresarial.
          </p>
        </div>

        {/* Estándares */}
        <div className="relative z-10">
          <p className="text-white/40 text-sm font-bold uppercase tracking-widest mb-6">Estándares certificados</p>
          <div className="grid grid-cols-2 gap-6">
            {['ISO 9001', 'ISO 14001', 'NOM-035', 'V.L.A.P.'].map(std => (
              <div key={std} className="bg-white/10 border border-white/10 px-8 py-10 backdrop-blur-sm hover:bg-white/20 transition-all">
                <div className="text-white font-black text-2xl tracking-tighter">{std}</div>
              </div>
            ))}
          </div>
          <p className="text-white/30 text-sm mt-12">GOBIERNO DE MÉXICO · 2024-2030</p>
        </div>
      </div>

      {/* ── Panel Formulario Derecho (60%) ────────────────────────── */}
      <div className="flex-1 flex flex-col">
        {/* Pleca roja institucional — gob.mx v3 */}
        <div className="h-1 bg-[#9D2449] w-full shrink-0" />

        <div className="flex-1 flex items-center justify-center px-10 py-16 bg-[#F8F8F8]">
          <div className="w-full max-w-xl">
            {/* Tarjeta de formulario */}
            <div className="bg-white border-t-[6px] border-[#9D2449] shadow-gob-heavy p-12">
              <div className="mb-10">
                <h1 className="text-3xl font-heading font-black text-[#1B1B1B] uppercase tracking-tight mb-2">
                  Acceso al Sistema
                </h1>
                {/* Separador oficial hr.red */}
                <hr style={{ backgroundColor: '#9D2449', border: 'none', height: '5px', width: '80px', marginBottom: '24px' }} />
                <p className="text-lg text-[#545454] font-light">Ingrese sus credenciales registradas para continuar</p>
              </div>

              {/* Alerta de error — gob.mx v3: role=alert */}
              {error && (
                <div role="alert" aria-live="assertive" className="alert-gob alert-gob-danger mb-4 text-sm">
                  <strong>Error:</strong> {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="form-group">
                  <label htmlFor="email" className="control-label">
                    Correo electrónico
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="form-control-gob w-full"
                    placeholder="ejemplo@dominio.com"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="password" className="control-label">
                    Contraseña
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="form-control-gob w-full"
                    placeholder="••••••••"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-gob-primary w-full !py-5 !text-xl !font-black shadow-xl hover:shadow-2xl transition-all"
                >
                  {loading ? 'INICIANDO...' : 'INGRESAR'}
                </button>

                <div className="text-center pt-6 border-t border-gray-100">
                  <p className="text-base text-[#545454]">
                    ¿Su empresa aún no está registrada?{' '}
                    <Link href="/register" className="text-[#9D2449] font-bold underline hover:text-[#611232]">
                      Solicite su ingreso aquí
                    </Link>
                  </p>
                </div>
              </form>
            </div>

            <div className="mt-8 text-center">
              <p className="text-xs font-bold text-[#98989A] uppercase tracking-[0.3em]">
                Gobierno de México · 2024-2030
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
