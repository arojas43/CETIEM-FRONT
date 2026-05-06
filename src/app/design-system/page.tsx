import React from "react";

export default function DesignSystemPage() {
    return (
        <div className="min-h-screen p-12 space-y-12 text-white/80" style={{ background: '#0A0A0A' }}>
            <section className="space-y-4">
                <h1 className="text-4xl font-black text-white border-b pb-4" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                    CETIEM Design System — Agile Audit Hub
                </h1>
                <p className="text-white/50 text-sm">
                    Guía de componentes y tokens de diseño para la plataforma CETIEM de certificación ESG.
                </p>
            </section>

            <section className="space-y-6">
                <h2 className="text-2xl font-black text-white">Tipografía</h2>
                <div className="space-y-4 p-6 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <h1 className="text-5xl font-black text-white/90">Encabezado H1 — Inter Black</h1>
                    <h2 className="text-4xl font-black text-white/90">Encabezado H2 — Inter Black</h2>
                    <h3 className="text-3xl font-bold text-white/90">Encabezado H3 — Inter Bold</h3>
                    <p className="text-base text-white/60 leading-relaxed">
                        Cuerpo de texto — Inter Regular 16px. Plataforma CETIEM de certificación ESG para PyMEs mexicanas.
                    </p>
                    <p className="text-sm text-white/40 italic">
                        Texto pequeño — 14px mínimo recomendado.
                    </p>
                </div>
            </section>

            <section className="space-y-6">
                <h2 className="text-2xl font-black text-white">Colores CETIEM</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                        <div className="h-20 w-full rounded-xl" style={{ background: '#00D47A' }}></div>
                        <p className="text-xs font-mono text-white/50">Neon Emerald (#00D47A)</p>
                    </div>
                    <div className="space-y-2">
                        <div className="h-20 w-full rounded-xl" style={{ background: '#ADFF4F' }}></div>
                        <p className="text-xs font-mono text-white/50">Lime (#ADFF4F)</p>
                    </div>
                    <div className="space-y-2">
                        <div className="h-20 w-full rounded-xl" style={{ background: '#00C8E0' }}></div>
                        <p className="text-xs font-mono text-white/50">Cyan (#00C8E0)</p>
                    </div>
                    <div className="space-y-2">
                        <div className="h-20 w-full rounded-xl" style={{ background: '#0A0A0A', border: '1px solid rgba(255,255,255,0.15)' }}></div>
                        <p className="text-xs font-mono text-white/50">Dark (#0A0A0A)</p>
                    </div>
                </div>
            </section>

            <section className="space-y-6">
                <h2 className="text-2xl font-black text-white">Botones</h2>
                <div className="flex flex-wrap gap-4 p-6 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <button className="px-6 py-2.5 rounded-lg font-black text-sm text-black uppercase tracking-widest"
                        style={{ background: '#00D47A', boxShadow: '0 0 16px rgba(0,212,122,0.3)' }}>
                        Primario
                    </button>
                    <button className="px-6 py-2.5 rounded-lg font-black text-sm text-black uppercase tracking-widest"
                        style={{ background: '#ADFF4F' }}>
                        Secundario (Lime)
                    </button>
                    <button className="px-6 py-2.5 rounded-lg font-bold text-sm text-white/70 uppercase tracking-widest border"
                        style={{ background: 'transparent', borderColor: 'rgba(255,255,255,0.15)' }}>
                        Outline
                    </button>
                    <button className="px-6 py-2.5 rounded-lg font-black text-sm text-black uppercase tracking-widest opacity-40 cursor-not-allowed"
                        style={{ background: '#00D47A' }}>
                        Deshabilitado
                    </button>
                </div>
            </section>

            <section className="space-y-6">
                <h2 className="text-2xl font-black text-white">Badges</h2>
                <div className="flex flex-wrap gap-3 p-6 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <span className="badge-green">Aprobado</span>
                    <span className="badge-cyan">En revisión</span>
                    <span className="badge-lime">Indexado</span>
                    <span className="badge-amber">Pendiente</span>
                    <span className="badge-red">Error</span>
                </div>
            </section>

            <section className="space-y-6">
                <h2 className="text-2xl font-black text-white">Cards — Glassmorphism</h2>
                <div className="grid md:grid-cols-3 gap-6">
                    <div className="glass p-6 rounded-2xl">
                        <p className="text-xs font-black text-[#00D47A] uppercase tracking-widest mb-2">glass</p>
                        <p className="text-white/60 text-sm">Card con efecto glassmorphism base.</p>
                    </div>
                    <div className="glass-md p-6 rounded-2xl">
                        <p className="text-xs font-black text-[#00C8E0] uppercase tracking-widest mb-2">glass-md</p>
                        <p className="text-white/60 text-sm">Card con vidrio medio opaco.</p>
                    </div>
                    <div className="glass-strong p-6 rounded-2xl">
                        <p className="text-xs font-black text-[#ADFF4F] uppercase tracking-widest mb-2">glass-strong</p>
                        <p className="text-white/60 text-sm">Card con vidrio fuerte.</p>
                    </div>
                </div>
            </section>

            <section className="space-y-6">
                <h2 className="text-2xl font-black text-white">Inputs</h2>
                <div className="space-y-4 p-6 rounded-2xl max-w-md" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div>
                        <label className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-2">Correo electrónico</label>
                        <input className="form-control w-full" placeholder="correo@empresa.com" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-2">Contraseña</label>
                        <input type="password" className="form-control w-full" placeholder="••••••••" />
                    </div>
                </div>
            </section>

            <section className="space-y-6">
                <h2 className="text-2xl font-black text-white">Tabla</h2>
                <div className="overflow-hidden rounded-2xl" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                    <table className="min-w-full divide-y" style={{ divideColor: 'rgba(255,255,255,0.06)' }}>
                        <thead style={{ background: 'rgba(255,255,255,0.04)' }}>
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-white/40 uppercase tracking-widest">Documento</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-white/40 uppercase tracking-widest">Estado</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-white/40 uppercase tracking-widest">Fecha</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.05)' }}>
                            <tr>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-white/70">Certificado_A.pdf</td>
                                <td className="px-6 py-4 whitespace-nowrap"><span className="badge-green">Aprobado</span></td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-white/40">12/04/2026</td>
                            </tr>
                            <tr>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-white/70">Reporte_ESG.pdf</td>
                                <td className="px-6 py-4 whitespace-nowrap"><span className="badge-cyan">En revisión</span></td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-white/40">13/04/2026</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
