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
        setShowHeader(false); // Scrolling down
      } else {
        setShowHeader(true); // Scrolling up
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#545454]">
      {/* El Header oficial de gob.mx se inyecta vía CDN en layout.tsx */}

      {/* 2. Header Institucional (Logo area) */}
      <header
        className={`bg-[#FFFFFF] border-b border-gray-100 sticky top-0 z-50 shadow-sm transition-all duration-500 transform ${showHeader ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0 pointer-events-none"
          }`}
      >
        <div className="container mx-auto px-8 py-2 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <InstitutionalLogo size="md" />
          </div>

          <nav className="hidden lg:flex items-center gap-12 text-sm font-black text-[#545454] uppercase tracking-[0.2em]">
            <Link href="#como-funciona" className="hover:text-[#9D2449] transition-colors">Funcionamiento</Link>
            <Link href="#certificaciones" className="hover:text-[#9D2449] transition-colors">Estándares</Link>
            <Link href="#tecnologia" className="hover:text-[#9D2449] transition-colors">Infraestructura IA</Link>
          </nav>

          <div className="flex items-center gap-6">
            <Link href="/register" className="btn-gob-primary !text-base !px-10 !py-4 shadow-lg hover:shadow-xl transition-all font-black tracking-widest leading-none">
              REGISTRO EMPRESARIAL
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* 3. Hero Section - IMPACTO MASIVO — Desempaquetado */}
        <section className="relative overflow-hidden bg-gradient-to-b from-gray-50 to-white pt-16 pb-20 border-b border-gray-100">
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-[600px] h-[600px] bg-[#9D2449]/5 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-[500px] h-[500px] bg-[#BC955C]/5 rounded-full blur-[100px]" />

          <div className="container mx-auto px-6 relative z-10 text-center">
            <div className="inline-flex items-center gap-4 bg-white border-2 border-gray-100 shadow-xl px-8 py-3 rounded-full mb-12 transform hover:scale-105 transition-transform cursor-default">
              <div className="w-3 h-3 rounded-full bg-[#1E5B4F] animate-pulse" />
              <span className="text-sm font-black text-[#545454] uppercase tracking-[0.4em]">
                Certificación ESG Impulsada por NVIDIA NIM
              </span>
            </div>

            <h1 className="leading-[1] tracking-tighter mb-10 max-w-6xl mx-auto text-5xl md:text-8xl font-black text-[#1B1B1B]">
              Certificación Digital con <br />
              <span className="text-[#9D2449]">Inteligencia Artificial</span>
            </h1>

            <p className="text-2xl md:text-3xl text-[#545454] mb-16 max-w-4xl mx-auto leading-relaxed font-light opacity-90">
              Transformamos el cumplimiento normativo mediante agentes de IA que analizan su expediente en segundos,
              garantizando transparencia y máxima agilidad institucional.
            </p>

            <div className="flex flex-col sm:flex-row gap-10 justify-center items-center">
              <Link href="/register"
                className="btn-gob-primary !text-2xl !px-20 !py-8 shadow-2xl hover:shadow-primary/30 hover:-translate-y-2 transition-all duration-300 font-black tracking-[0.15em]">
                SOLICITAR CERTIFICACIÓN
              </Link>
              <Link href="/auth/signin"
                className="text-xl font-bold text-[#545454] hover:text-[#1B1B1B] flex items-center gap-3 transition-colors group">
                ACCESO AL SISTEMA <ArrowRight className="h-6 w-6 group-hover:translate-x-2 transition-transform" />
              </Link>
            </div>

            {/* Credenciales de confianza */}
            <div className="mt-24 pt-12 border-t border-gray-100 flex flex-wrap items-center justify-center gap-16 grayscale opacity-30 hover:grayscale-0 hover:opacity-100 transition-all duration-1000">
              <div className="flex flex-col items-center">
                <span className="text-5xl font-black text-[#1B1B1B]">ISO 9001</span>
                <span className="text-xs font-bold tracking-[0.5em] uppercase mt-2">Calidad</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-5xl font-black text-[#1B1B1B]">ISO 14001</span>
                <span className="text-xs font-bold tracking-[0.5em] uppercase mt-2">Ambiental</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-5xl font-black text-[#1B1B1B]">NOM-035</span>
                <span className="text-xs font-bold tracking-[0.5em] uppercase mt-2">Laboral</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-5xl font-black text-[#1B1B1B]">V.L.A.P.</span>
                <span className="text-xs font-bold tracking-[0.5em] uppercase mt-2">Normativa</span>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Ecosistema de Certificación */}
        <section id="como-funciona" className="container mx-auto px-6 py-32 bg-white">
          <div className="text-center mb-24">
            <h2 className="mb-6 text-5xl md:text-6xl font-black text-[#1B1B1B]">Ecosistema de Certificación</h2>
            <hr style={{ backgroundColor: '#9D2449', opacity: 1, border: 'none', height: '6px', width: '120px' }} className="mx-auto" />
            <p className="text-2xl text-[#545454] max-w-3xl mx-auto font-light leading-relaxed mt-8">
              Un proceso coordinado por inteligencia artificial para garantizar la certidumbre jurídica y técnica en tiempo récord.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-16 relative">
            <div className="hidden md:block absolute top-20 left-[10%] right-[10%] h-[2px] bg-gradient-to-r from-[#9D2449]/30 via-[#BC955C]/30 to-[#1E5B4F]/30" />

            {[
              { n: "01", icon: Upload, color: "bg-[#9D2449]", title: "Carga de Datos", desc: "Sube manuales, actas y procedimientos en formato PDF." },
              { n: "02", icon: Brain, color: "bg-[#12322B]", title: "Análisis IA", desc: "NVIDIA NIM identifica hallazgos de cumplimiento automáticamente." },
              { n: "03", icon: Shield, color: "bg-[#BC955C]", title: "Dictamen Técnico", desc: "Un Assessor certificado valida la resolución con soporte IA." },
              { n: "04", icon: Award, color: "bg-[#1E5B4F]", title: "Certificado", desc: "Obtenga su sello de cumplimiento con validez digital." },
            ].map(step => {
              const Icon = step.icon;
              return (
                <div key={step.n} className="text-center relative z-10 group">
                  <div className={`h-40 w-40 ${step.color} rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 shadow-2xl group-hover:scale-110 transition-all duration-500`}>
                    <Icon className="h-16 w-16 text-white" aria-hidden="true" />
                  </div>
                  <span className="text-sm font-black text-[#9D2449] tracking-[0.6em] uppercase">{step.n}</span>
                  <h3 className="mt-6 mb-4 text-3xl font-bold text-[#1B1B1B]">{step.title}</h3>
                  <p className="text-xl text-[#545454] leading-relaxed font-light">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* 5. Roles — Interfaces Especializadas */}
        <section id="certificaciones" className="bg-gray-50 border-y border-gray-100 py-32">
          <div className="container mx-auto px-6">
            <div className="text-center mb-20">
              <h2 className="mb-6 text-5xl font-black text-[#1B1B1B]">Interfaces Especializadas</h2>
              <hr style={{ backgroundColor: '#9D2449', opacity: 1, border: 'none', height: '6px', width: '120px' }} className="mx-auto" />
            </div>

            <div className="grid md:grid-cols-3 gap-10">
              {[
                {
                  icon: Users, color: "text-[#12322B]", bg: "bg-[#12322B]/5",
                  title: "Portal Empresa",
                  desc: "Gestión centralizada de expedientes y repositorio de certificados.",
                  features: ["Dashboard ESG", "Subida Masiva Segura", "Seguimiento Tiempo Real", "Descarga de Sellos"],
                },
                {
                  icon: Shield, color: "text-[#9D2449]", bg: "bg-[#9D2449]/5",
                  title: "Consola Assessor",
                  desc: "Entorno de alta productividad para la validación expedita.",
                  features: ["Análisis Inteligente", "Visor Split-View", "Generación de Hallazgos", "Auditoría Técnica"],
                },
                {
                  icon: BarChart3, color: "text-[#BC955C]", bg: "bg-[#BC955C]/5",
                  title: "Mando Administrativo",
                  desc: "Supervisión institucional y monitor de impacto nacional.",
                  features: ["Control Multi-Sectorial", "Gestión de Assessors", "Métricas Nación", "Logs Transparencia"],
                },
              ].map(role => {
                const Icon = role.icon;
                return (
                  <div key={role.title} className="bg-white rounded-3xl p-12 shadow-gob border border-border/40 hover:shadow-2xl transition-all duration-500 flex flex-col items-center text-center">
                    <div className={`h-20 w-20 ${role.bg} rounded-2xl flex items-center justify-center mb-8`}>
                      <Icon className={`h-10 w-10 ${role.color}`} aria-hidden="true" />
                    </div>
                    <h3 className="mb-4 text-2xl font-black text-[#1B1B1B] uppercase tracking-tight">{role.title}</h3>
                    <hr className="red w-16 mx-auto mb-6" />
                    <p className="text-lg text-[#545454] mb-8 leading-relaxed font-light">{role.desc}</p>
                    <ul className="space-y-4 w-full text-left">
                      {role.features.map(f => (
                        <li key={f} className="flex items-center gap-4 text-base font-bold text-[#1B1B1B] border-b border-gray-50 pb-3 last:border-0">
                          <CheckCircle className={`h-5 w-5 ${role.color} shrink-0`} aria-hidden="true" /> {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 6. CTA Final */}
        <section id="tecnologia" className="container mx-auto px-6 py-24">
          <div className="bg-[#1B1B1B] rounded-[3rem] p-20 text-center relative overflow-hidden group shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-r from-[#9D2449]/20 to-[#BC955C]/20 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
            <h2 className="text-white mb-6 relative z-10 text-4xl md:text-5xl font-black leading-tight">
              Lleve su empresa al siguiente nivel institucional
            </h2>
            <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto font-light relative z-10">
              La digitalización de la confianza comienza con el cumplimiento auditable institucional.
            </p>
            <Link href="/register" className="btn-gob-primary !text-2xl !px-24 !py-8 font-black uppercase tracking-[0.3em] relative z-10 hover:shadow-primary/40">
              INICIAR REGISTRO NACIONAL
            </Link>
          </div>
        </section>
      </main>

      <footer className="bg-[#12322B] text-white pt-24 pb-16 border-t-[16px] border-[#D4C19C]">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-16 mb-16">
            <div className="flex flex-col gap-8">
              <div className="flex items-center gap-8">
                <div className="w-2 h-32 bg-[#BC955C]" />
                <div className="flex flex-col">
                  <span className="font-heading font-black text-6xl tracking-tighter uppercase leading-none">ECONOMIA</span>
                  <span className="text-base font-black text-[#BC955C] uppercase tracking-[0.4em] mt-3">Secretaría de Economía</span>
                </div>
              </div>
              <p className="text-xl text-gray-300 leading-relaxed font-light">
                Infraestructura crítica para la validación de cumplimiento ESG y normativa institucional mexicana.
              </p>
            </div>

            <div className="flex flex-col gap-8">
              <h4 className="text-xl font-black uppercase tracking-[0.3em] text-[#BC955C]">Enlaces Institucionales</h4>
              <div className="flex flex-col gap-5">
                <Link href="https://www.gob.mx" target="_blank" className="text-lg text-gray-300 hover:text-[#BC955C] transition-colors">gob.mx</Link>
                <Link href="https://www.gob.mx/transparencia" target="_blank" className="text-lg text-gray-300 hover:text-[#BC955C] transition-colors">Transparencia</Link>
                <Link href="https://www.gob.mx/datos" target="_blank" className="text-lg text-gray-300 hover:text-[#BC955C] transition-colors">Datos Abiertos</Link>
              </div>
            </div>

            <div className="flex flex-col gap-8">
              <h4 className="text-xl font-black uppercase tracking-[0.3em] text-[#BC955C]">Contacto</h4>
              <p className="text-lg text-gray-300 font-light italic leading-relaxed">
                Av. Insurgentes Sur 1940, Col. Florida,<br />
                Álvaro Obregón, Ciudad de México, CP 01030
              </p>
              <div className="flex gap-10 grayscale opacity-50">
                <div className="text-xs font-black tracking-widest leading-none">SE-2024</div>
                <div className="text-xs font-black tracking-widest leading-none text-[#BC955C]">MX-IA+</div>
              </div>
            </div>
          </div>

          <div className="pt-12 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-12">
            <p className="text-base font-black text-[#BC955C] uppercase tracking-[0.6em] opacity-80">
              ESTADOS UNIDOS MEXICANOS · 2024 - 2030
            </p>
            <div className="flex items-center gap-16 grayscale opacity-30">
              <span className="text-xs font-black uppercase tracking-widest pr-16 border-r border-white/10">NVIDIA NIM CERTIFIED PLATFORM</span>
              <span className="text-xs font-black uppercase tracking-widest">Secretaría de Economía</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
