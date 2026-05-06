"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Brain, Shield, CheckCircle, ArrowRight, Upload, Award, BarChart3, Users } from "lucide-react";
import { InstitutionalLogo } from "@/components/institutional-logo";

export default function HomePage() {
  const [showHeader, setShowHeader] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setShowHeader(false);
      } else {
        setShowHeader(true);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  return (
    <div className="min-h-screen text-white/60" style={{ background: '#0A0A0A' }}>

      {/* Header */}
      <header
        className={`border-b sticky top-0 z-50 transition-all duration-500 transform ${showHeader ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0 pointer-events-none"}`}
        style={{ background: '#0D0D0D', borderColor: 'rgba(255,255,255,0.06)' }}
      >
        <div className="container mx-auto px-8 py-3 flex items-center justify-between">
          <InstitutionalLogo size="md" />

          <nav className="hidden lg:flex items-center gap-12 text-sm font-black text-white/50 uppercase tracking-[0.2em]">
            <Link href="#como-funciona" className="hover:text-[#00D47A] transition-colors">Funcionamiento</Link>
            <Link href="#certificaciones" className="hover:text-[#00D47A] transition-colors">Estándares</Link>
            <Link href="#tecnologia" className="hover:text-[#00D47A] transition-colors">Infraestructura IA</Link>
          </nav>

          <Link
            href="/register"
            className="px-6 py-2.5 rounded-lg text-sm font-black text-black uppercase tracking-widest transition-all"
            style={{ background: '#00D47A', boxShadow: '0 0 16px rgba(0,212,122,0.3)' }}
          >
            Registro Empresarial
          </Link>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden pt-24 pb-28 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-[600px] h-[600px] rounded-full blur-[120px]"
            style={{ background: 'radial-gradient(ellipse, rgba(0,212,122,0.08) 0%, transparent 70%)' }} />
          <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-[500px] h-[500px] rounded-full blur-[120px]"
            style={{ background: 'radial-gradient(ellipse, rgba(0,200,224,0.06) 0%, transparent 70%)' }} />

          <div className="container mx-auto px-6 relative z-10 text-center">
            <div className="inline-flex items-center gap-3 border px-6 py-2 rounded-full mb-12"
              style={{ background: 'rgba(0,212,122,0.06)', borderColor: 'rgba(0,212,122,0.2)' }}>
              <div className="w-2 h-2 rounded-full bg-[#00D47A] animate-pulse" />
              <span className="text-xs font-black text-[#00D47A] uppercase tracking-[0.4em]">
                Certificación ESG · NVIDIA NIM + Kimi K2
              </span>
            </div>

            <h1 className="leading-[1.05] tracking-tight mb-10 max-w-5xl mx-auto text-5xl md:text-7xl font-black text-white/90">
              Certificación Digital con{" "}
              <span className="text-[#00D47A]">Inteligencia Artificial</span>
            </h1>

            <p className="text-xl md:text-2xl text-white/50 mb-14 max-w-3xl mx-auto leading-relaxed font-light">
              Agile Audit Hub impulsado por IA — análisis automático con Protocolo V.L.A.P. para
              PyMEs mexicanas. Dictamen verificable en tiempo récord.
            </p>

            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
              <Link
                href="/register"
                className="px-10 py-4 rounded-xl text-lg font-black text-black uppercase tracking-widest transition-all hover:-translate-y-0.5"
                style={{ background: '#00D47A', boxShadow: '0 0 24px rgba(0,212,122,0.35)' }}
              >
                Solicitar Certificación
              </Link>
              <Link href="/auth/signin"
                className="text-base font-bold text-white/50 hover:text-white/80 flex items-center gap-2 transition-colors group">
                Acceso al Sistema <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            <div className="mt-20 pt-10 border-t flex flex-wrap items-center justify-center gap-14 opacity-25 hover:opacity-60 transition-all duration-700"
              style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              {["ISO 9001", "ISO 14001", "NOM-035", "V.L.A.P."].map((std, i) => (
                <div key={std} className="flex flex-col items-center">
                  <span className="text-4xl font-black text-white/90">{std}</span>
                  <span className="text-[10px] font-bold tracking-[0.5em] uppercase mt-1 text-white/40">
                    {["Calidad", "Ambiental", "Laboral", "Normativa"][i]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Ecosistema */}
        <section id="como-funciona" className="container mx-auto px-6 py-28">
          <div className="text-center mb-20">
            <h2 className="mb-4 text-4xl md:text-5xl font-black text-white/90">Ecosistema de Certificación</h2>
            <div className="w-20 h-1 bg-[#00D47A] mx-auto mt-4 mb-6 rounded-full" />
            <p className="text-lg text-white/40 max-w-2xl mx-auto font-light leading-relaxed">
              Un proceso coordinado por inteligencia artificial para garantizar la certidumbre jurídica y técnica.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-10 relative">
            <div className="hidden md:block absolute top-16 left-[12%] right-[12%] h-px"
              style={{ background: 'linear-gradient(to right, rgba(0,212,122,0.2), rgba(0,200,224,0.2), rgba(0,212,122,0.1))' }} />

            {[
              { n: "01", icon: Upload, color: '#00D47A', title: "Carga de Datos", desc: "Sube manuales, actas y procedimientos en formato PDF." },
              { n: "02", icon: Brain, color: '#00C8E0', title: "Análisis IA", desc: "NVIDIA NIM identifica hallazgos de cumplimiento automáticamente." },
              { n: "03", icon: Shield, color: '#ADFF4F', title: "Dictamen Técnico", desc: "Un Assessor certificado valida la resolución con soporte IA." },
              { n: "04", icon: Award, color: '#00D47A', title: "Certificado", desc: "Obtenga su sello de cumplimiento con validez digital." },
            ].map(step => {
              const Icon = step.icon;
              return (
                <div key={step.n} className="text-center relative z-10 group">
                  <div className="h-32 w-32 rounded-3xl flex items-center justify-center mx-auto mb-8 transition-all duration-500 group-hover:scale-110"
                    style={{ background: `${step.color}15`, border: `1px solid ${step.color}30` }}>
                    <Icon className="h-12 w-12" style={{ color: step.color }} />
                  </div>
                  <span className="text-xs font-black uppercase tracking-[0.5em]" style={{ color: step.color }}>{step.n}</span>
                  <h3 className="mt-4 mb-3 text-xl font-bold text-white/90">{step.title}</h3>
                  <p className="text-sm text-white/40 leading-relaxed font-light">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Roles */}
        <section id="certificaciones" className="border-y py-28" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="container mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="mb-4 text-4xl font-black text-white/90">Interfaces Especializadas</h2>
              <div className="w-20 h-1 bg-[#00D47A] mx-auto mt-4 rounded-full" />
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: Users, color: '#00D47A',
                  title: "Portal Empresa",
                  desc: "Gestión centralizada de expedientes y repositorio de certificados.",
                  features: ["Dashboard ESG", "Subida Masiva Segura", "Seguimiento Tiempo Real", "Descarga de Sellos"],
                },
                {
                  icon: Shield, color: '#00C8E0',
                  title: "Consola Assessor",
                  desc: "Entorno de alta productividad para la validación expedita.",
                  features: ["Análisis Inteligente", "Visor Split-View", "Generación de Hallazgos", "Auditoría Técnica"],
                },
                {
                  icon: BarChart3, color: '#ADFF4F',
                  title: "Mando Administrativo",
                  desc: "Supervisión institucional y monitor de impacto.",
                  features: ["Control Multi-Sectorial", "Gestión de Assessors", "Métricas Globales", "Logs Transparencia"],
                },
              ].map(role => {
                const Icon = role.icon;
                return (
                  <div key={role.title} className="rounded-2xl p-10 flex flex-col items-center text-center transition-all duration-300 hover:-translate-y-1"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="h-16 w-16 rounded-xl flex items-center justify-center mb-6"
                      style={{ background: `${role.color}15`, border: `1px solid ${role.color}25` }}>
                      <Icon className="h-8 w-8" style={{ color: role.color }} />
                    </div>
                    <h3 className="mb-3 text-xl font-black text-white/90 uppercase tracking-tight">{role.title}</h3>
                    <div className="w-12 h-0.5 mx-auto mb-5 rounded-full" style={{ background: role.color }} />
                    <p className="text-sm text-white/40 mb-6 leading-relaxed font-light">{role.desc}</p>
                    <ul className="space-y-3 w-full text-left">
                      {role.features.map(f => (
                        <li key={f} className="flex items-center gap-3 text-sm font-semibold text-white/70 border-b pb-2 last:border-0"
                          style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                          <CheckCircle className="h-4 w-4 shrink-0" style={{ color: role.color }} /> {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section id="tecnologia" className="container mx-auto px-6 py-24">
          <div className="rounded-3xl p-16 text-center relative overflow-hidden group"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(0,212,122,0.15)' }}>
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-1000"
              style={{ background: 'radial-gradient(ellipse at center, rgba(0,212,122,0.05) 0%, transparent 70%)' }} />
            <h2 className="text-white mb-4 relative z-10 text-3xl md:text-4xl font-black leading-tight">
              Lleve su empresa al siguiente nivel
            </h2>
            <p className="text-white/40 mb-10 max-w-xl mx-auto font-light relative z-10">
              La digitalización de la confianza comienza con el cumplimiento auditable.
            </p>
            <Link
              href="/register"
              className="inline-block px-12 py-4 rounded-xl font-black text-black uppercase tracking-widest relative z-10 transition-all hover:-translate-y-0.5"
              style={{ background: '#00D47A', boxShadow: '0 0 24px rgba(0,212,122,0.35)' }}
            >
              Iniciar Registro
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t pt-16 pb-10" style={{ background: '#0D0D0D', borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-12 mb-12">
            <div className="flex flex-col gap-5">
              <InstitutionalLogo size="md" />
              <p className="text-sm text-white/30 leading-relaxed font-light max-w-xs">
                Infraestructura crítica para la validación de cumplimiento ESG — PyMEs mexicanas.
              </p>
            </div>

            <div className="flex flex-col gap-5">
              <h4 className="text-xs font-black uppercase tracking-[0.3em] text-[#00C8E0]">Plataforma</h4>
              <div className="flex flex-col gap-3">
                <Link href="/auth/signin" className="text-sm text-white/30 hover:text-[#00D47A] transition-colors">Iniciar sesión</Link>
                <Link href="/register" className="text-sm text-white/30 hover:text-[#00D47A] transition-colors">Registro empresarial</Link>
              </div>
            </div>

            <div className="flex flex-col gap-5">
              <h4 className="text-xs font-black uppercase tracking-[0.3em] text-[#00C8E0]">Contacto</h4>
              <p className="text-sm text-white/30 font-light leading-relaxed">
                CETIEM S.C.<br />
                Ciudad de México, México
              </p>
            </div>
          </div>

          <div className="pt-8 border-t flex flex-col md:flex-row justify-between items-center gap-6"
            style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">
              CETIEM S.C. · CIPRE HOLDING · {new Date().getFullYear()}
            </p>
            <div className="flex items-center gap-8 opacity-30">
              <span className="text-[10px] font-black uppercase tracking-widest border-r border-white/10 pr-8">NVIDIA NIM CERTIFIED</span>
              <span className="text-[10px] font-black uppercase tracking-widest">Agile Audit Hub</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
