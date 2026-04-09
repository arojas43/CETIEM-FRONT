import Link from "next/link";
import { Brain, Shield, CheckCircle, ArrowRight, Upload, FileText, Users, Award, BarChart3, Zap } from "lucide-react";

export default function HomePage() {
  return (
    <div className="dark min-h-screen bg-cetiem-dark text-white">
      {/* Header */}
      <header className="border-b border-white/5 sticky top-0 z-50 bg-cetiem-dark/90 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-baseline gap-1.5">
            <span className="font-heading font-bold text-sm text-white tracking-tight">SECRETARIA DE ECONOMIA</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-cetiem-gray">
            <Link href="#como-funciona" className="hover:text-white transition-colors">Cómo funciona</Link>
            <Link href="#certificaciones" className="hover:text-white transition-colors">Certificaciones</Link>
            <Link href="#tecnologia" className="hover:text-white transition-colors">Tecnología</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/auth/signin" className="text-sm text-cetiem-gray hover:text-white transition-colors px-4 py-2">
              Iniciar Sesión
            </Link>
            <Link href="/register" className="flex items-center gap-2 bg-cetiem-green hover:bg-cetiem-green/90 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
              Registrar Empresa <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="container mx-auto px-6 py-28 text-center">
          <div className="inline-flex items-center gap-2 bg-cetiem-green/10 text-cetiem-green border border-cetiem-green/20 px-4 py-1.5 rounded-full text-xs font-semibold mb-8 uppercase tracking-widest">
            <Zap className="h-3.5 w-3.5" />
            Plataforma de Certificación ESG con IA · En desarrollo activo
          </div>
          <h1 className="font-heading font-bold text-5xl md:text-6xl text-white mb-6 max-w-4xl mx-auto leading-[1.1]">
            Certifica tu empresa con{" "}
            <span className="text-cetiem-green">Inteligencia Artificial</span>
          </h1>
          <p className="text-lg md:text-xl text-cetiem-gray mb-10 max-w-2xl mx-auto leading-relaxed">
            CETIEM automatiza el análisis documental para procesos de certificación empresarial.
            Sube tus documentos, la IA los analiza y un auditor certifica en tiempo récord.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register"
              className="flex items-center justify-center gap-2 bg-cetiem-green hover:bg-cetiem-green/90 text-white font-semibold px-8 py-3.5 rounded-xl transition-colors text-base">
              <Upload className="h-5 w-5" /> Iniciar proceso de certificación
            </Link>
            <Link href="/auth/signin"
              className="flex items-center justify-center gap-2 border border-white/10 hover:border-white/25 text-white font-medium px-8 py-3.5 rounded-xl transition-colors text-base">
              <FileText className="h-5 w-5" /> Acceder al portal
            </Link>
          </div>
          {/* Social proof */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-sm text-cetiem-gray/50">
            {["ISO 9001", "ISO 14001", "ISO 45001", "Cumplimiento Legal", "Custom"].map(c => (
              <span key={c} className="flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-cetiem-green/40" /> {c}
              </span>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="como-funciona" className="container mx-auto px-6 py-20">
          <div className="text-center mb-14">
            <h2 className="font-heading font-bold text-3xl text-white mb-3">¿Cómo funciona?</h2>
            <p className="text-cetiem-gray max-w-xl mx-auto">
              Proceso 100% digital en 4 etapas. Sin papeleo, sin esperas innecesarias.
            </p>
          </div>
          <div className="grid md:grid-cols-4 gap-6 relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-10 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-cetiem-green/20 via-cetiem-teal/30 to-cetiem-lime/20" />
            {[
              { n: "01", icon: Upload,      color: "bg-cetiem-green", title: "Empresa sube documentos", desc: "Arrastra PDFs — manuales, certificados, procedimientos, actas." },
              { n: "02", icon: Brain,       color: "bg-cetiem-teal",  title: "IA analiza el expediente", desc: "Modelos de inteligencia artificial con NVIDIA NIM analizan y clasifican el expediente automáticamente." },
              { n: "03", icon: Shield,      color: "bg-cetiem-amber", title: "Assessor revisa y dictamina", desc: "Un auditor CETIEM valida con la consola split-view PDF + formulario." },
              { n: "04", icon: Award,       color: "bg-cetiem-lime",  title: "Certificado digital emitido", desc: "Descarga tu certificación con QR de verificación en tiempo real." },
            ].map(step => {
              const Icon = step.icon;
              return (
                <div key={step.n} className="text-center relative z-10">
                  <div className={`h-20 w-20 ${step.color} rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg`}>
                    <Icon className="h-9 w-9 text-white" />
                  </div>
                  <span className="text-[10px] font-bold text-cetiem-gray/40 tracking-widest">{step.n}</span>
                  <h3 className="font-heading font-semibold text-white mt-1 mb-2">{step.title}</h3>
                  <p className="text-cetiem-gray text-sm leading-relaxed">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Roles */}
        <section className="bg-cetiem-card border-y border-white/5 py-20">
          <div className="container mx-auto px-6">
            <div className="text-center mb-14">
              <h2 className="font-heading font-bold text-3xl text-white mb-3">Diseñado para todos los actores</h2>
              <p className="text-cetiem-gray max-w-xl mx-auto">Cada rol tiene su propio portal optimizado para su flujo de trabajo.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  icon: Users, color: "text-cetiem-teal", bg: "bg-cetiem-teal/10", border: "border-cetiem-teal/20",
                  title: "Empresa Certificante",
                  desc: "Sube documentos, sigue el estado de tu certificación en tiempo real y descarga tu certificado.",
                  features: ["Dashboard de progreso", "Subida masiva de documentos", "Historial de certificaciones", "Descarga de certificados PDF"],
                },
                {
                  icon: Shield, color: "text-cetiem-amber", bg: "bg-cetiem-amber/10", border: "border-cetiem-amber/20",
                  title: "Data Assessor",
                  desc: "Revisa expedientes con la consola Split-View, valida o corrige el análisis de IA y emite dictámenes.",
                  features: ["Cola de revisión priorizada", "Visor PDF + formulario lado a lado", "Hallazgos y notas estructuradas", "Historial de dictámenes"],
                },
                {
                  icon: BarChart3, color: "text-cetiem-lime", bg: "bg-cetiem-lime/10", border: "border-cetiem-lime/20",
                  title: "Super Administrador",
                  desc: "Gestiona empresas, asigna assessors, accede a métricas globales y controla el ciclo de certificación.",
                  features: ["Gestión multi-empresa", "Asignación de assessors", "Métricas y reportes", "Logs de auditoría"],
                },
              ].map(role => {
                const Icon = role.icon;
                return (
                  <div key={role.title} className={`border ${role.border} rounded-2xl p-8 hover:bg-white/2 transition-colors`}>
                    <div className={`h-12 w-12 ${role.bg} rounded-xl flex items-center justify-center mb-5`}>
                      <Icon className={`h-6 w-6 ${role.color}`} />
                    </div>
                    <h3 className="font-heading font-semibold text-lg text-white mb-2">{role.title}</h3>
                    <p className="text-cetiem-gray text-sm mb-5 leading-relaxed">{role.desc}</p>
                    <ul className="space-y-2">
                      {role.features.map(f => (
                        <li key={f} className="flex items-center gap-2 text-sm text-cetiem-gray/80">
                          <CheckCircle className={`h-3.5 w-3.5 ${role.color} shrink-0`} /> {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Certifications */}
        <section id="certificaciones" className="container mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <h2 className="font-heading font-bold text-3xl text-white mb-3">Certificaciones disponibles</h2>
            <p className="text-cetiem-gray">Soportamos los principales estándares internacionales y locales.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "ISO 9001", sub: "Gestión de Calidad",       color: "border-cetiem-green/30 hover:border-cetiem-green/60" },
              { label: "ISO 14001", sub: "Gestión Ambiental",       color: "border-cetiem-teal/30  hover:border-cetiem-teal/60" },
              { label: "ISO 45001", sub: "Seguridad y Salud",       color: "border-cetiem-amber/30 hover:border-cetiem-amber/60" },
              { label: "Legal",     sub: "Cumplimiento Legal",      color: "border-cetiem-lime/30  hover:border-cetiem-lime/60" },
              { label: "Custom",    sub: "Personalizada",           color: "border-white/10        hover:border-white/30" },
            ].map(cert => (
              <div key={cert.label} className={`bg-cetiem-card border ${cert.color} rounded-2xl p-5 text-center transition-colors cursor-default`}>
                <Award className="h-7 w-7 text-cetiem-green mx-auto mb-3 opacity-70" />
                <p className="font-heading font-bold text-white text-base">{cert.label}</p>
                <p className="text-cetiem-gray/60 text-xs mt-1">{cert.sub}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Tech stack */}
        <section id="tecnologia" className="border-t border-white/5 py-16">
          <div className="container mx-auto px-6">
            <p className="text-center text-[10px] font-semibold text-cetiem-gray/40 tracking-widest uppercase mb-10">
              Stack tecnológico — en desarrollo activo
            </p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
              {[
                { name: "Next.js 15",    role: "Frontend / API",    color: "text-white" },
                { name: "NVIDIA NIM",    role: "IA / LLM (GLM4.7)", color: "text-cetiem-green" },
                { name: "PostgreSQL",    role: "Base de datos",     color: "text-cetiem-lime" },
                { name: "Análisis IA",   role: "Documentos ESG",    color: "text-cetiem-teal" },
                { name: "Certificación", role: "Digital + verificable", color: "text-cetiem-amber" },
              ].map(tech => (
                <div key={tech.name} className="text-center">
                  <p className={`font-heading font-bold text-sm ${tech.color}`}>{tech.name}</p>
                  <p className="text-cetiem-gray/50 text-xs mt-0.5">{tech.role}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="container mx-auto px-6 py-20">
          <div className="bg-gradient-to-br from-cetiem-green/20 via-cetiem-card to-cetiem-teal/10 border border-cetiem-green/20 rounded-3xl p-12 text-center">
            <h2 className="font-heading font-bold text-3xl text-white mb-4">
              ¿Listo para certificar tu empresa?
            </h2>
            <p className="text-cetiem-gray mb-8 max-w-lg mx-auto leading-relaxed">
              Regístrate en minutos, sube tus documentos y nuestro equipo de Data Assessors te acompañará en todo el proceso.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register"
                className="flex items-center justify-center gap-2 bg-cetiem-green hover:bg-cetiem-green/90 text-white font-semibold px-8 py-3.5 rounded-xl transition-colors">
                Registrar mi empresa <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/auth/signin"
                className="flex items-center justify-center gap-2 border border-white/15 hover:border-white/30 text-white font-medium px-8 py-3.5 rounded-xl transition-colors">
                Tengo cuenta, entrar
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/5">
        <div className="container mx-auto px-6 py-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-baseline gap-1">
              <span className="font-heading font-bold text-xs text-white">SECRETARIA DE ECONOMIA</span>
            </div>
            <span className="text-cetiem-gray/30 text-xs">·</span>
            <span className="text-cetiem-gray/50 text-xs">Sistema de Certificación ESG con IA</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-cetiem-gray/40">
            <span>Cipre Holding</span>
            <Link href="/register" className="hover:text-cetiem-green transition-colors">Registrarse</Link>
            <Link href="/auth/signin" className="hover:text-cetiem-green transition-colors">Iniciar Sesión</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
