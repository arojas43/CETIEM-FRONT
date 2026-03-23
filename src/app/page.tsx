import Link from "next/link";
import { FileText, Upload, Brain, Shield, CheckCircle, ArrowRight } from "lucide-react";

export default function HomePage() {
  return (
    <div className="dark min-h-screen bg-cetiem-dark text-white">
      {/* Header */}
      <header className="border-b border-white/5 sticky top-0 z-50 bg-cetiem-dark/80 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-baseline gap-1.5">
            <span className="font-heading font-bold text-xl text-white tracking-tight">CETIEM</span>
            <span className="text-cetiem-gray text-xs font-medium">S.C.</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth/signin" className="text-sm text-cetiem-gray hover:text-white transition-colors px-4 py-2">
              Iniciar Sesión
            </Link>
            <Link href="/dashboard" className="flex items-center gap-2 bg-cetiem-green hover:bg-cetiem-green/90 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors">
              Dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6">
        {/* Hero */}
        <section className="py-24 text-center">
          <div className="inline-flex items-center gap-2 bg-cetiem-green/10 text-cetiem-green border border-cetiem-green/20 px-4 py-1.5 rounded-full text-sm font-medium mb-8">
            <Brain className="h-4 w-4" />
            Potenciado por NVIDIA NIM + FalkorDB
          </div>

          <h2 className="font-heading font-bold text-5xl text-white mb-6 max-w-3xl mx-auto leading-tight">
            Plataforma de{" "}
            <span className="text-cetiem-green">Certificación ESG</span>{" "}
            con Inteligencia Artificial
          </h2>

          <p className="text-lg text-cetiem-gray mb-10 max-w-2xl mx-auto">
            Analiza documentos PDF automáticamente, extrae requisitos normativos
            y genera certificaciones empresariales en minutos.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/dashboard/upload" className="flex items-center justify-center gap-2 bg-cetiem-green hover:bg-cetiem-green/90 text-white font-medium px-8 py-3 rounded-xl transition-colors">
              <Upload className="h-5 w-5" />
              Subir Documento
            </Link>
            <Link href="/dashboard" className="flex items-center justify-center gap-2 border border-white/10 hover:border-cetiem-green/40 text-white font-medium px-8 py-3 rounded-xl transition-colors">
              <FileText className="h-5 w-5" />
              Ver Dashboard
            </Link>
          </div>
        </section>

        {/* Features */}
        <section className="py-16">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-cetiem-card border border-white/5 rounded-2xl p-8 hover:border-cetiem-green/20 transition-colors">
              <div className="h-12 w-12 bg-cetiem-green/10 rounded-xl flex items-center justify-center mb-5">
                <Brain className="h-6 w-6 text-cetiem-green" />
              </div>
              <h3 className="font-heading font-semibold text-lg text-white mb-3">
                PageIndex — Análisis Jerárquico
              </h3>
              <p className="text-cetiem-gray text-sm mb-4 leading-relaxed">
                Extrae automáticamente la estructura de documentos PDF manteniendo
                la jerarquía de secciones y capítulos.
              </p>
              <ul className="space-y-2">
                {["Detección de tabla de contenido", "Indexación por páginas", "Búsqueda contextual inteligente"].map(item => (
                  <li key={item} className="flex items-center gap-2 text-sm text-cetiem-gray">
                    <CheckCircle className="h-4 w-4 text-cetiem-green shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-cetiem-card border border-white/5 rounded-2xl p-8 hover:border-cetiem-teal/20 transition-colors">
              <div className="h-12 w-12 bg-cetiem-teal/10 rounded-xl flex items-center justify-center mb-5">
                <Shield className="h-6 w-6 text-cetiem-teal" />
              </div>
              <h3 className="font-heading font-semibold text-lg text-white mb-3">
                Cognee + FalkorDB — Grafo de Conocimiento
              </h3>
              <p className="text-cetiem-gray text-sm mb-4 leading-relaxed">
                Construye una red de conocimiento conectando empresas, normas,
                requisitos y certificaciones.
              </p>
              <ul className="space-y-2">
                {["Extracción de entidades", "Relaciones entre conceptos", "Consultas complejas en tiempo real"].map(item => (
                  <li key={item} className="flex items-center gap-2 text-sm text-cetiem-gray">
                    <CheckCircle className="h-4 w-4 text-cetiem-green shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-cetiem-card border border-white/5 rounded-2xl p-8 hover:border-cetiem-lime/20 transition-colors">
              <div className="h-12 w-12 bg-cetiem-lime/10 rounded-xl flex items-center justify-center mb-5">
                <Upload className="h-6 w-6 text-cetiem-lime" />
              </div>
              <h3 className="font-heading font-semibold text-lg text-white mb-3">
                Procesamiento Automático
              </h3>
              <p className="text-cetiem-gray text-sm mb-4 leading-relaxed">
                Sube documentos PDF y deja que la IA haga el trabajo pesado
                de análisis y clasificación.
              </p>
              <ul className="space-y-2">
                {["Cola de procesamiento asíncrona", "Notificaciones en tiempo real", "Exportación de reportes"].map(item => (
                  <li key={item} className="flex items-center gap-2 text-sm text-cetiem-gray">
                    <CheckCircle className="h-4 w-4 text-cetiem-green shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-16">
          <div className="bg-cetiem-card border border-white/5 rounded-3xl px-8 py-12">
            <h3 className="font-heading font-bold text-2xl text-center text-white mb-12">
              ¿Cómo Funciona?
            </h3>
            <div className="grid md:grid-cols-4 gap-8">
              {[
                { n: "1", title: "Sube tu PDF", desc: "Arrastra documentos normativos, manuales o procedimientos" },
                { n: "2", title: "PageIndex Analiza", desc: "Extrae estructura jerárquica y crea índice de contenido" },
                { n: "3", title: "Cognee Extrae", desc: "Identifica entidades y construye grafo de conocimiento" },
                { n: "4", title: "Obtén Resultados", desc: "Visualiza certificaciones, requisitos y cumplimiento" },
              ].map(step => (
                <div key={step.n} className="text-center">
                  <div className="h-14 w-14 bg-cetiem-green text-white rounded-full flex items-center justify-center text-xl font-heading font-bold mx-auto mb-4">
                    {step.n}
                  </div>
                  <h4 className="font-heading font-semibold text-white mb-2">{step.title}</h4>
                  <p className="text-sm text-cetiem-gray">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Tech stack */}
        <section className="py-12 border-t border-white/5">
          <p className="text-center text-xs font-medium text-cetiem-gray/50 tracking-widest uppercase mb-8">
            Tecnologías que potencian el sistema
          </p>
          <div className="flex flex-wrap justify-center items-center gap-10 opacity-50">
            {[["Next.js 15", "Frontend"], ["NVIDIA NIM", "IA / LLM"], ["FalkorDB", "Grafos"], ["PostgreSQL", "Base de Datos"], ["BullMQ", "Colas"]].map(([name, role]) => (
              <div key={name} className="text-center">
                <p className="font-semibold text-white text-sm">{name}</p>
                <p className="text-xs text-cetiem-gray">{role}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-white/5 mt-8">
        <div className="container mx-auto px-6 py-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-cetiem-gray">
            <Shield className="h-4 w-4" />
            <span>Sistema de Certificación ESG con IA</span>
          </div>
          <p className="text-sm text-cetiem-gray/50">
            Cipre Holding · CETIEM S.C.
          </p>
        </div>
      </footer>
    </div>
  );
}
