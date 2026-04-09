"use client";

import { useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AuthButton() {
  const { data: session } = useSession();

  if (session) {
    return (
      <div className="flex items-center gap-4">
        <span className="text-sm text-cetiem-gray hidden sm:inline">
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
        setError("Credenciales inválidas");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dark min-h-screen flex items-center justify-center bg-cetiem-dark">
      <div className="w-full max-w-sm px-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-baseline gap-1.5 mb-3">
            <span className="font-heading font-bold text-2xl text-white tracking-tight">SECRETARIA DE ECONOMIA</span>
          </div>
          <p className="text-cetiem-gray text-sm">Plataforma de certificación ESG</p>
        </div>

        {/* Card */}
        <div className="bg-cetiem-card border border-white/5 rounded-2xl p-8">
          <h2 className="font-heading font-bold text-xl text-white mb-1">Iniciar sesión</h2>
          <p className="text-cetiem-gray text-sm mb-6">Accede a tu cuenta</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-cetiem-gray" htmlFor="email">
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@empresa.com"
                required
                className="bg-white/5 border-white/10 text-white placeholder:text-cetiem-gray/40 focus:border-cetiem-green focus:ring-cetiem-green"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-cetiem-gray" htmlFor="password">
                Password
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="bg-white/5 border-white/10 text-white placeholder:text-cetiem-gray/40 focus:border-cetiem-green focus:ring-cetiem-green"
              />
            </div>

            {error && (
              <p className="text-sm text-cetiem-red">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-cetiem-green hover:bg-cetiem-green/90 text-white font-medium py-2.5 rounded-xl transition-colors disabled:opacity-50 mt-2"
            >
              {loading ? "Iniciando sesión..." : "Iniciar sesión"}
            </button>
          </form>

          <p className="text-center text-xs text-cetiem-gray mt-6">
            ¿No tienes cuenta?{" "}
            <Link href="/register" className="text-cetiem-green hover:underline">Registra tu empresa</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
