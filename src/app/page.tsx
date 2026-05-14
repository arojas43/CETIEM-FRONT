"use client";

import { useState, useEffect, memo } from "react";
import Link from "next/link";
import {
  Brain, Shield, CheckCircle, ArrowRight, Upload, Award,
  FileText, RefreshCw, Sparkles, Building2, Scale,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { InstitutionalLogo } from "@/components/institutional-logo";
import { cn } from "@/lib/utils";

// ─── Variants ─────────────────────────────────────────────────────────────────
const FADE_UP = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1, y: 0,
    transition: { type: "spring" as const, stiffness: 90, damping: 22 },
  },
};

const STAGGER = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.09 } },
};

// ─── Live pipeline panel (isolated perpetual animation) ───────────────────────
const MOCK_DOCS = [
  { id: "d1", name: "Acta Constitutiva",     cat: "GOBERNANZA",  state: "Analizado",   color: "text-status-approved", bg: "bg-status-approved/10" },
  { id: "d2", name: "NOM-035 Evidencia",     cat: "SOCIAL",      state: "Procesando",  color: "text-status-progress", bg: "bg-status-progress/10" },
  { id: "d3", name: "Licencia SEMARNAT",     cat: "AMBIENTAL",   state: "En revisión", color: "text-status-review",   bg: "bg-status-review/10"   },
  { id: "d4", name: "Estados Financieros",   cat: "FINANCIERO",  state: "Pendiente",   color: "text-white/40",        bg: "bg-white/5"            },
  { id: "d5", name: "Código de Ética",       cat: "GOBERNANZA",  state: "Analizado",   color: "text-status-approved", bg: "bg-status-approved/10" },
];

const LivePipelinePanel = memo(function LivePipelinePanel() {
  const [activeIdx, setActiveIdx] = useState(1);

  useEffect(() => {
    const id = setInterval(() => setActiveIdx(i => (i + 1) % MOCK_DOCS.length), 2600);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative w-full max-w-[440px] ml-auto">
      {/* Ambient */}
      <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full blur-[100px] bg-cetiem-green/8 pointer-events-none" />

      {/* Card */}
      <div className="relative rounded-2xl bg-cetiem-surface border border-white/8 overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.55)]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/6 bg-white/[0.015]">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-cetiem-green motion-safe:animate-pulse-green" />
            <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Procesamiento activo</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-cetiem-cyan/50" />
            <span className="text-[9px] font-black text-cetiem-cyan/50 uppercase tracking-wider">NVIDIA NIM</span>
          </div>
        </div>

        {/* Doc list */}
        <div className="p-3.5 space-y-1.5">
          <AnimatePresence>
            {MOCK_DOCS.map((doc, i) => (
              <motion.div
                key={doc.id}
                layout
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: "spring" as const, stiffness: 200, damping: 26, delay: i * 0.05 }}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors duration-500",
                  i === activeIdx ? "bg-white/[0.05]" : "bg-transparent",
                )}
              >
                <FileText className="h-3.5 w-3.5 text-white/25 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-white/75 truncate">{doc.name}</p>
                  <p className="text-[9px] text-white/25 uppercase tracking-wider">{doc.cat}</p>
                </div>
                <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0", doc.color, doc.bg)}>
                  {i === activeIdx ? "Procesando" : doc.state}
                </span>
                {i === activeIdx && (
                  <RefreshCw className="h-3 w-3 text-status-progress motion-safe:animate-spin shrink-0" />
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Dictamen preview */}
        <div className="mx-3.5 mb-3.5 p-3.5 rounded-xl bg-status-approved/5 border border-status-approved/15">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="h-3 w-3 text-cetiem-green" />
            <span className="text-[9px] font-black uppercase tracking-[0.25em] text-cetiem-green">
              Motor VLAP · Dictamen preliminar
            </span>
          </div>
          <p className="text-[11px] text-white/45 leading-relaxed font-light">
            Empresa cumple con 4 de 6 categorías. Se identificaron 2 hallazgos en SOCIAL y AMBIENTAL para revisión del assessor.
          </p>
        </div>
      </div>

      {/* Floating cert badge */}
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring" as const, stiffness: 80, damping: 18, delay: 1.1 }}
        className="absolute -bottom-7 -left-8 bg-cetiem-surface border border-cetiem-green/20 rounded-2xl px-4 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.5)] flex items-center gap-3"
      >
        <div className="h-9 w-9 rounded-xl bg-cetiem-green/10 flex items-center justify-center shrink-0">
          <Award className="h-5 w-5 text-cetiem-green" />
        </div>
        <div>
          <p className="text-[11px] font-black text-white/80">Certificación ESG</p>
          <p className="text-[10px] text-status-approved font-bold">Lista para emisión</p>
        </div>
      </motion.div>
    </div>
  );
});

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [showHeader, setShowHeader] = useState(true);
  const lastScrollY = { current: 0 };

  useEffect(() => {
    const handler = () => {
      const y = window.scrollY;
      setShowHeader(y < lastScrollY.current || y < 80);
      lastScrollY.current = y;
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <div className="min-h-screen bg-cetiem-dark text-white/60">

      {/* ── Header ── */}
      <AnimatePresence>
        {showHeader && (
          <motion.header
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -80, opacity: 0 }}
            transition={{ type: "spring" as const, stiffness: 120, damping: 22 }}
            className="sticky top-0 z-50 border-b border-white/5 bg-cetiem-dark/85 backdrop-blur-md"
          >
            <div className="max-w-7xl mx-auto px-6 lg:px-10 py-3 flex items-center justify-between gap-6">
              <InstitutionalLogo size="md" />

              <nav className="hidden lg:flex items-center gap-10 text-[11px] font-black text-white/35 uppercase tracking-[0.22em]">
                <Link href="#como-funciona" className="hover:text-cetiem-green transition-colors">Funcionamiento</Link>
                <Link href="#acceso" className="hover:text-cetiem-green transition-colors">Acceso</Link>
                <Link href="#tecnologia" className="hover:text-cetiem-green transition-colors">Infraestructura</Link>
              </nav>

              <div className="flex items-center gap-3">
                <Link href="/auth/signin"
                  className="hidden sm:block text-[11px] font-black text-white/35 hover:text-white/65 uppercase tracking-wider transition-colors">
                  Ingresar
                </Link>
                <Link href="/register"
                  className="px-5 py-2 rounded-lg text-[11px] font-black text-white uppercase tracking-widest bg-cetiem-green hover:bg-cetiem-green/90 transition-all active:scale-[0.98]">
                  Registro
                </Link>
              </div>
            </div>
          </motion.header>
        )}
      </AnimatePresence>

      <main>
        {/* ── Hero: split screen ── */}
        <section className="relative min-h-[100dvh] flex items-center border-b border-white/5 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/3 left-[55%] w-[500px] h-[500px] rounded-full blur-[130px] bg-cetiem-green/7 -translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-[300px] h-[300px] rounded-full blur-[100px] bg-cetiem-cyan/5" />
          </div>

          <div className="max-w-7xl mx-auto px-6 lg:px-10 py-24 w-full grid lg:grid-cols-[1fr_1fr] gap-16 lg:gap-10 items-center relative z-10">

            {/* Left: content */}
            <motion.div initial="hidden" animate="show" variants={STAGGER} className="flex flex-col">
              {/* Badge */}
              <motion.div variants={FADE_UP}
                className="inline-flex self-start items-center gap-2.5 border border-cetiem-green/20 bg-cetiem-green/5 px-4 py-1.5 rounded-full mb-8">
                <div className="w-1.5 h-1.5 rounded-full bg-cetiem-green motion-safe:animate-pulse-green" />
                <span className="text-[10px] font-black text-cetiem-green uppercase tracking-[0.35em]">
                  Certificación Hecho en México ESG
                </span>
              </motion.div>

              {/* H1 */}
              <motion.h1 variants={FADE_UP}
                className="font-heading text-[3.25rem] md:text-[4.25rem] font-black text-white/90 leading-[1.02] tracking-tight mb-6">
                Tu expediente<br />
                <span className="text-cetiem-green">analizado.</span><br />
                Tu certificado,<br />
                en semanas.
              </motion.h1>

              {/* Body */}
              <motion.p variants={FADE_UP}
                className="text-[1.0625rem] text-white/42 leading-relaxed mb-10 max-w-[42ch] font-light">
                La IA (Filtro Cero + Motor VLAP) pre-valida tu expediente ESG y genera el dictamen preliminar.
                El assessor humano certifica con toda la evidencia trazable.
              </motion.p>

              {/* CTAs */}
              <motion.div variants={FADE_UP} className="flex flex-wrap items-center gap-5 mb-14">
                <Link href="/register"
                  className="px-8 py-3.5 rounded-xl font-black text-white uppercase tracking-widest text-[12px] bg-cetiem-green hover:bg-cetiem-green/90 transition-all hover:-translate-y-px active:scale-[0.98]">
                  Solicitar certificación
                </Link>
                <Link href="/auth/signin"
                  className="flex items-center gap-2 text-[13px] font-semibold text-white/40 hover:text-white/70 transition-colors group">
                  Acceder al sistema
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </motion.div>

              {/* Standards strip */}
              <motion.div variants={FADE_UP}
                className="pt-8 border-t border-white/6 grid grid-cols-4 gap-3">
                {[
                  { label: "ISO 9001",  desc: "Calidad" },
                  { label: "ISO 14001", desc: "Ambiental" },
                  { label: "NOM-035",   desc: "Laboral" },
                  { label: "V.L.A.P.", desc: "Normativa" },
                ].map(s => (
                  <div key={s.label} className="flex flex-col gap-0.5">
                    <span className="text-xl font-black text-white/55 tracking-tight leading-none">{s.label}</span>
                    <span className="text-[9px] font-bold uppercase tracking-[0.45em] text-white/20 mt-1">{s.desc}</span>
                  </div>
                ))}
              </motion.div>
            </motion.div>

            {/* Right: live panel */}
            <motion.div
              initial={{ opacity: 0, x: 28 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: "spring" as const, stiffness: 70, damping: 20, delay: 0.35 }}
              className="hidden lg:block relative pb-10"
            >
              <LivePipelinePanel />
            </motion.div>
          </div>
        </section>

        {/* ── Process: vertical timeline ── */}
        <section id="como-funciona" className="py-28 border-b border-white/5">
          <div className="max-w-7xl mx-auto px-6 lg:px-10">

            {/* Left-aligned header */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ type: "spring" as const, stiffness: 80, damping: 20 }}
              className="mb-20"
            >
              <span className="text-[10px] font-black uppercase tracking-[0.45em] text-cetiem-cyan mb-4 block">
                Proceso
              </span>
              <h2 className="font-heading text-4xl md:text-5xl font-black text-white/90 leading-tight max-w-md">
                Cómo funciona el sistema
              </h2>
            </motion.div>

            {/* Asymmetric: large numbers left + content right */}
            <div className="grid lg:grid-cols-[80px_1fr] xl:grid-cols-[120px_1fr] gap-0 lg:gap-16">

              {/* Large step numbers — decorative column */}
              <div className="hidden lg:flex flex-col gap-[3.75rem] pt-2">
                {["01", "02", "03", "04"].map((n, i) => (
                  <motion.div key={n}
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1, duration: 0.6 }}
                    className="text-[5.5rem] xl:text-[7rem] font-black text-white/4 select-none leading-none"
                  >
                    {n}
                  </motion.div>
                ))}
              </div>

              {/* Steps */}
              <div className="relative">
                <div className="absolute left-4 top-6 bottom-10 w-px bg-gradient-to-b from-cetiem-green/25 via-cetiem-cyan/15 to-transparent" />

                <div className="space-y-14">
                  {[
                    {
                      n: "01", icon: Upload,
                      color: "text-cetiem-green", iconBg: "bg-cetiem-green/10 border-cetiem-green/20",
                      title: "Carga de documentos",
                      desc: "Sube tu expediente completo: acta constitutiva, estados financieros, permisos SEMARNAT, evidencias NOM-035 y más. La plataforma acepta PDF e inicia el análisis automáticamente.",
                    },
                    {
                      n: "02", icon: Brain,
                      color: "text-cetiem-cyan", iconBg: "bg-cetiem-cyan/10 border-cetiem-cyan/20",
                      title: "Análisis automático con IA",
                      desc: "El Filtro Cero categoriza cada documento. NVIDIA NIM extrae entidades, relaciones y estructura semántica. El Motor VLAP genera el dictamen preliminar con hallazgos clasificados.",
                    },
                    {
                      n: "03", icon: Shield,
                      color: "text-status-review", iconBg: "bg-status-review/10 border-status-review/20",
                      title: "Revisión del assessor ESG",
                      desc: "Un assessor certificado recibe el expediente ya procesado. Valida hallazgos, hace Q&A con la IA, y emite o deniega la certificación formal con evidencia trazable.",
                    },
                    {
                      n: "04", icon: Award,
                      color: "text-status-approved", iconBg: "bg-status-approved/10 border-status-approved/20",
                      title: "Certificado con validez digital",
                      desc: "Obtén la distinción 'Hecho en México ESG' de la Secretaría de Economía. El sello es descargable, verificable y tiene validez jurídica ante autoridades.",
                    },
                  ].map((step, i) => {
                    const Icon = step.icon;
                    return (
                      <motion.div key={step.n}
                        initial={{ opacity: 0, y: 18 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-60px" }}
                        transition={{ type: "spring" as const, stiffness: 80, damping: 20, delay: i * 0.07 }}
                        className="pl-12 relative"
                      >
                        <div className={cn(
                          "absolute left-0 top-0 h-8 w-8 rounded-xl flex items-center justify-center border",
                          step.iconBg
                        )}>
                          <Icon className={cn("h-4 w-4", step.color)} />
                        </div>

                        <span className={cn("text-[10px] font-black uppercase tracking-[0.4em] mb-2 block", step.color)}>
                          Paso {step.n}
                        </span>
                        <h3 className="font-heading text-2xl font-bold text-white/88 mb-3 leading-tight">
                          {step.title}
                        </h3>
                        <p className="text-white/38 leading-relaxed font-light max-w-[52ch]">{step.desc}</p>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Roles: asymmetric 2-col grid ── */}
        <section id="acceso" className="py-28 border-b border-white/5 bg-white/[0.01]">
          <div className="max-w-7xl mx-auto px-6 lg:px-10">

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ type: "spring" as const, stiffness: 80, damping: 20 }}
              className="mb-14"
            >
              <span className="text-[10px] font-black uppercase tracking-[0.45em] text-cetiem-green mb-4 block">
                Acceso
              </span>
              <h2 className="font-heading text-4xl md:text-5xl font-black text-white/90 leading-tight">
                Interfaces por rol
              </h2>
            </motion.div>

            {/* Large left + 2 stacked right — NOT 3 equal columns */}
            <div className="grid lg:grid-cols-[3fr_2fr] gap-4 items-stretch">

              {/* Empresa — large card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ type: "spring" as const, stiffness: 80, damping: 20 }}
                className="relative rounded-2xl p-10 border border-white/8 bg-white/[0.02] overflow-hidden group hover:-translate-y-px transition-transform duration-300 flex flex-col"
              >
                <div className="absolute top-0 right-0 w-72 h-72 rounded-full blur-[90px] bg-cetiem-green/6 pointer-events-none" />

                <div className="h-12 w-12 rounded-2xl bg-cetiem-green/10 border border-cetiem-green/20 flex items-center justify-center mb-8">
                  <Building2 className="h-6 w-6 text-cetiem-green" />
                </div>

                <span className="text-[10px] font-black uppercase tracking-[0.45em] text-cetiem-green block mb-3">
                  Empresa
                </span>
                <h3 className="font-heading text-[1.75rem] font-black text-white/90 mb-4 leading-tight">
                  Portal de Empresa y PyMEs
                </h3>
                <p className="text-[0.9375rem] text-white/38 leading-relaxed font-light mb-8 max-w-[44ch]">
                  Sube tu expediente completo, sigue el avance de cada documento en tiempo real, y descarga
                  tu certificado ESG cuando el assessor lo emita.
                </p>

                <ul className="grid sm:grid-cols-2 gap-y-3 gap-x-4 mb-10">
                  {[
                    "Dashboard ESG en tiempo real",
                    "Subida masiva de documentos",
                    "Seguimiento de dictamen IA",
                    "Descarga de certificado",
                  ].map(f => (
                    <li key={f} className="flex items-center gap-2.5 text-[13px] text-white/55">
                      <CheckCircle className="h-3.5 w-3.5 text-cetiem-green shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link href="/register"
                  className="mt-auto inline-flex items-center gap-2 text-[12px] font-black text-cetiem-green uppercase tracking-wider group/link self-start">
                  Registrar empresa
                  <ArrowRight className="h-4 w-4 group-hover/link:translate-x-1 transition-transform" />
                </Link>
              </motion.div>

              {/* Right column: Assessor + Admin stacked */}
              <div className="flex flex-col gap-4">

                {/* Assessor */}
                <motion.div
                  initial={{ opacity: 0, x: 16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ type: "spring" as const, stiffness: 80, damping: 20, delay: 0.1 }}
                  className="flex-1 rounded-2xl p-7 border border-white/8 bg-white/[0.02] relative overflow-hidden hover:-translate-y-px transition-transform duration-300"
                >
                  <div className="absolute top-0 right-0 w-44 h-44 rounded-full blur-[70px] bg-cetiem-cyan/6 pointer-events-none" />
                  <div className="h-10 w-10 rounded-xl bg-cetiem-cyan/10 border border-cetiem-cyan/20 flex items-center justify-center mb-5">
                    <Shield className="h-5 w-5 text-cetiem-cyan" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.4em] text-cetiem-cyan block mb-2">
                    Assessor ESG
                  </span>
                  <h3 className="font-heading text-xl font-black text-white/90 mb-3">Consola de Revisión</h3>
                  <p className="text-[13px] text-white/38 leading-relaxed font-light">
                    Múltiples empresas activas, visor split-view con dictamen IA y Q&A en tiempo real. Densidad
                    de información como feature.
                  </p>
                </motion.div>

                {/* Admin */}
                <motion.div
                  initial={{ opacity: 0, x: 16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ type: "spring" as const, stiffness: 80, damping: 20, delay: 0.18 }}
                  className="flex-1 rounded-2xl p-7 border border-white/8 bg-white/[0.02] relative overflow-hidden hover:-translate-y-px transition-transform duration-300"
                >
                  <div className="absolute top-0 right-0 w-44 h-44 rounded-full blur-[70px] bg-cetiem-lime/4 pointer-events-none" />
                  <div className="h-10 w-10 rounded-xl bg-cetiem-lime/10 border border-cetiem-lime/20 flex items-center justify-center mb-5">
                    <Scale className="h-5 w-5 text-cetiem-lime" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.4em] text-cetiem-lime block mb-2">
                    Administración
                  </span>
                  <h3 className="font-heading text-xl font-black text-white/90 mb-3">Mando Administrativo</h3>
                  <p className="text-[13px] text-white/38 leading-relaxed font-light">
                    Supervisión institucional de todo el pipeline: gestión de assessors, métricas globales y
                    logs de transparencia.
                  </p>
                </motion.div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Tech callout ── */}
        <section id="tecnologia" className="py-20 border-b border-white/5">
          <div className="max-w-7xl mx-auto px-6 lg:px-10">
            <div className="grid lg:grid-cols-[2fr_3fr] gap-10 items-center">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ type: "spring" as const, stiffness: 80, damping: 20 }}
              >
                <span className="text-[10px] font-black uppercase tracking-[0.45em] text-cetiem-cyan mb-4 block">
                  Infraestructura
                </span>
                <h2 className="font-heading text-3xl md:text-4xl font-black text-white/90 leading-tight">
                  IA institucional sobre<br />infraestructura certificada
                </h2>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ type: "spring" as const, stiffness: 80, damping: 20, delay: 0.1 }}
                className="grid sm:grid-cols-3 gap-4"
              >
                {[
                  { title: "NVIDIA NIM", desc: "Inferencia de modelos de lenguaje con latencia optimizada para documentos técnicos." },
                  { title: "Kimi K2",    desc: "Razonamiento multimodal de largo contexto para análisis de expedientes complejos." },
                  { title: "Protocolo VLAP", desc: "Motor de dictamen propio con cadena de custodia trazable y hash de documentos." },
                ].map((t) => (
                  <div key={t.title}
                    className="p-5 rounded-xl border border-white/6 bg-white/[0.02]">
                    <p className="text-[12px] font-black text-white/75 mb-2">{t.title}</p>
                    <p className="text-[12px] text-white/33 leading-relaxed font-light">{t.desc}</p>
                  </div>
                ))}
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── CTA: asymmetric ── */}
        <section className="py-24">
          <div className="max-w-7xl mx-auto px-6 lg:px-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ type: "spring" as const, stiffness: 80, damping: 20 }}
              className="relative rounded-3xl overflow-hidden border border-white/8"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-cetiem-surface via-cetiem-dark to-cetiem-surface" />
              <div className="absolute top-0 left-1/3 w-[600px] h-[280px] rounded-full blur-[110px] bg-cetiem-green/7 -translate-x-1/2 pointer-events-none" />

              <div className="relative z-10 grid lg:grid-cols-[3fr_2fr] items-center gap-10 p-12 lg:p-16">
                <div>
                  <h2 className="font-heading text-4xl md:text-5xl font-black text-white/90 leading-[1.06] mb-5">
                    Tu certificación<br />avanza desde hoy.
                  </h2>
                  <p className="text-white/38 leading-relaxed font-light max-w-[44ch]">
                    La digitalización de la confianza comienza con documentar lo que ya haces.
                    Registra tu empresa y sube el primer documento esta semana.
                  </p>
                </div>
                <div className="flex flex-col gap-3 lg:items-start">
                  <Link href="/register"
                    className="px-8 py-4 rounded-xl font-black text-white uppercase tracking-widest text-[12px] bg-cetiem-green hover:bg-cetiem-green/90 transition-all hover:-translate-y-px active:scale-[0.98] whitespace-nowrap self-start">
                    Iniciar registro
                  </Link>
                  <Link href="/auth/signin"
                    className="text-[12px] text-white/30 hover:text-white/55 transition-colors font-semibold">
                    Ya tengo cuenta — Ingresar
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 pt-14 pb-10 bg-cetiem-surface/50">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="grid md:grid-cols-3 gap-10 mb-12">
            <div className="flex flex-col gap-4">
              <InstitutionalLogo size="md" />
              <p className="text-[13px] text-white/25 leading-relaxed font-light max-w-[28ch]">
                Infraestructura crítica para la validación de cumplimiento ESG en PyMEs mexicanas.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <h4 className="text-[10px] font-black uppercase tracking-[0.35em] text-cetiem-cyan">Plataforma</h4>
              <div className="flex flex-col gap-2.5">
                <Link href="/auth/signin" className="text-[13px] text-white/25 hover:text-cetiem-green transition-colors">
                  Iniciar sesión
                </Link>
                <Link href="/register" className="text-[13px] text-white/25 hover:text-cetiem-green transition-colors">
                  Registro empresarial
                </Link>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <h4 className="text-[10px] font-black uppercase tracking-[0.35em] text-cetiem-cyan">Contacto</h4>
              <p className="text-[13px] text-white/25 font-light leading-relaxed">
                CETIEM S.C.<br />
                Ciudad de México, México
              </p>
            </div>
          </div>

          <div className="pt-7 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-5">
            <p className="text-[10px] font-black text-white/15 uppercase tracking-[0.4em]">
              CETIEM S.C. · CIPRE HOLDING · {new Date().getFullYear()}
            </p>
            <div className="flex items-center gap-7 opacity-25">
              <span className="text-[10px] font-black uppercase tracking-widest border-r border-white/10 pr-7">
                NVIDIA NIM CERTIFIED
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest">Agile Audit Hub</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
