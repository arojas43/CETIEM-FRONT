import React from "react";

export default function DesignSystemPage() {
    return (
        <div className="container-gob py-12 space-y-12">
            <section className="space-y-4">
                <h1 className="text-4xl font-bold border-b pb-4">Guía Gráfica gob.mx v3 — ECONOMIA</h1>
                <p className="text-gob-body leading-gob text-economia-texto">
                    Esta página sirve para validar que los componentes del proyecto ECONOMIA cumplen con la
                    <strong> Guía de Estilo v3</strong> oficial.
                </p>
            </section>

            <section className="space-y-6">
                <h2 className="text-3xl font-bold">Tipografía</h2>
                <div className="space-y-4 p-6 border bg-white">
                    <h1 className="text-5xl">Encabezado H1 (Patria)</h1>
                    <h2 className="text-4xl">Encabezado H2 (Patria)</h2>
                    <h3 className="text-3xl">Encabezado H3 (Patria)</h3>
                    <p className="text-gob-body leading-gob text-economia-texto">
                        Este es un cuerpo de texto estandarizado a 18px con interlineado de 1.428.
                        Utiliza la fuente Noto Sans según la normativa oficial de gob.mx para legibilidad.
                    </p>
                    <p className="text-sm text-economia-gris italic">
                        Texto pequeño (16px recomendado mínimo).
                    </p>
                </div>
            </section>

            <section className="space-y-6">
                <h2 className="text-3xl font-bold">Colores Institucionales</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                        <div className="h-20 w-full bg-[#9D2449]"></div>
                        <p className="text-xs font-mono">Guinda (#9D2449)</p>
                    </div>
                    <div className="space-y-2">
                        <div className="h-20 w-full bg-[#BC955C]"></div>
                        <p className="text-xs font-mono">Dorado (#BC955C)</p>
                    </div>
                    <div className="space-y-2">
                        <div className="h-20 w-full bg-[#12322B]"></div>
                        <p className="text-xs font-mono">Verde Oscuro (#12322B)</p>
                    </div>
                    <div className="space-y-2">
                        <div className="h-20 w-full bg-[#545454]"></div>
                        <p className="text-xs font-mono">Texto (#545454)</p>
                    </div>
                </div>
            </section>

            <section className="space-y-6">
                <h2 className="text-3xl font-bold">Botones</h2>
                <div className="flex flex-wrap gap-4 p-6 border bg-white">
                    <button className="btn-gob-primary">Botón Primario</button>
                    <button className="btn-gob-secondary">Botón Secundario</button>
                    <button className="btn-gob-outline">Botón Outline</button>
                    <button className="btn-gob-primary opacity-50 cursor-not-allowed">Deshabilitado</button>
                </div>
            </section>

            <section className="space-y-6">
                <h2 className="text-3xl font-bold">Alertas</h2>
                <div className="space-y-4">
                    <div className="alert-gob-success">
                        <strong>¡Éxito!</strong> El documento ha sido procesado correctamente.
                    </div>
                    <div className="alert-gob-info">
                        <strong>Información:</strong> El análisis de IA puede tardar unos minutos.
                    </div>
                    <div className="alert-gob-warning">
                        <strong>Atención:</strong> Faltan campos obligatorios en el perfil.
                    </div>
                    <div className="alert-gob-danger">
                        <strong>Error:</strong> No se pudo conectar con el servicio de NVIDIA NIM.
                    </div>
                </div>
            </section>

            <section className="space-y-6">
                <h2 className="text-3xl font-bold">Tablas</h2>
                <div className="overflow-hidden border">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-[#98989A]/10">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-economia-texto uppercase">Documento</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-economia-texto uppercase">Estado</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-economia-texto uppercase">Fecha</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            <tr>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-economia-texto">Certificado_A.pdf</td>
                                <td className="px-6 py-4 whitespace-nowrap"><span className="text-[#1E5B4F] font-bold">Aprobado</span></td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-economia-gris">12/04/2026</td>
                            </tr>
                            <tr>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-economia-texto">Reporte_ESG.pdf</td>
                                <td className="px-6 py-4 whitespace-nowrap"><span className="text-[#BC955C] font-bold">Pendiente</span></td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-economia-gris">13/04/2026</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

            <div className="pleca-guinda mt-12"></div>
        </div>
    );
}
