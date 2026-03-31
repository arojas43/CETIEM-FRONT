/**
 * Catálogo de documentos requeridos para la certificación ESG CETIEM.
 * Cada empresa debe subir los 60 documentos de este catálogo.
 * El assessor evalúa el conjunto completo antes de emitir el dictamen.
 */

export type CategoriaDocumento =
  | "GOBERNANZA"
  | "FINANCIERO"
  | "AMBIENTAL"
  | "SOCIAL"
  | "LEGAL"
  | "OPERACIONES"
  | "OTRO";

export interface TipoDocumento {
  id: string;
  nombre: string;
  descripcion: string;
  categoria: CategoriaDocumento;
  obligatorio: boolean;
}

export const CATALOGO_DOCUMENTOS: TipoDocumento[] = [
  // ─── GOBERNANZA (12) ────────────────────────────────────────────────────
  {
    id: "ACTA_CONSTITUTIVA",
    nombre: "Acta Constitutiva",
    descripcion: "Documento de constitución legal de la empresa ante notario público.",
    categoria: "GOBERNANZA",
    obligatorio: true,
  },
  {
    id: "MODIFICACIONES_ACTA",
    nombre: "Modificaciones al Acta Constitutiva",
    descripcion: "Todas las escrituras de modificación al acta original (si aplica).",
    categoria: "GOBERNANZA",
    obligatorio: false,
  },
  {
    id: "PODER_NOTARIAL",
    nombre: "Poder Notarial del Representante Legal",
    descripcion: "Instrumento notarial que acredita la facultad de representación.",
    categoria: "GOBERNANZA",
    obligatorio: true,
  },
  {
    id: "CONSTANCIA_FISCAL",
    nombre: "Constancia de Situación Fiscal (RFC)",
    descripcion: "Constancia actualizada emitida por el SAT que acredita el RFC.",
    categoria: "GOBERNANZA",
    obligatorio: true,
  },
  {
    id: "COMPROBANTE_DOMICILIO",
    nombre: "Comprobante de Domicilio Fiscal",
    descripcion: "Comprobante de domicilio con vigencia no mayor a 3 meses.",
    categoria: "GOBERNANZA",
    obligatorio: true,
  },
  {
    id: "ORGANIGRAMA",
    nombre: "Organigrama Organizacional",
    descripcion: "Estructura organizacional actualizada con nombres y cargos.",
    categoria: "GOBERNANZA",
    obligatorio: true,
  },
  {
    id: "CODIGO_ETICA",
    nombre: "Código de Ética Empresarial",
    descripcion: "Documento que define los valores, principios y conductas esperadas.",
    categoria: "GOBERNANZA",
    obligatorio: true,
  },
  {
    id: "POLITICA_ANTICORRUPCION",
    nombre: "Política Anticorrupción y Antisoborno",
    descripcion: "Política formal de prevención de actos de corrupción y soborno.",
    categoria: "GOBERNANZA",
    obligatorio: true,
  },
  {
    id: "POLITICA_PRIVACIDAD",
    nombre: "Política de Privacidad y Protección de Datos",
    descripcion: "Aviso de privacidad y política de tratamiento de datos personales (LFPDPPP).",
    categoria: "GOBERNANZA",
    obligatorio: true,
  },
  {
    id: "REGLAMENTO_INTERIOR",
    nombre: "Reglamento Interior de Trabajo",
    descripcion: "Reglamento registrado ante la STPS que regula las relaciones laborales.",
    categoria: "GOBERNANZA",
    obligatorio: true,
  },
  {
    id: "ACTA_ASAMBLEA",
    nombre: "Acta de Asamblea más Reciente",
    descripcion: "Última acta de asamblea de socios o accionistas.",
    categoria: "GOBERNANZA",
    obligatorio: true,
  },
  {
    id: "MANUAL_ORGANIZACION",
    nombre: "Manual de Organización",
    descripcion: "Documento que describe funciones, responsabilidades y líneas de reporte.",
    categoria: "GOBERNANZA",
    obligatorio: false,
  },

  // ─── FINANCIERO (8) ─────────────────────────────────────────────────────
  {
    id: "ESTADOS_FINANCIEROS_A1",
    nombre: "Estados Financieros — Año más reciente",
    descripcion: "Balance general, estado de resultados y flujo de efectivo del último año.",
    categoria: "FINANCIERO",
    obligatorio: true,
  },
  {
    id: "ESTADOS_FINANCIEROS_A2",
    nombre: "Estados Financieros — Año anterior",
    descripcion: "Estados financieros del año previo al más reciente.",
    categoria: "FINANCIERO",
    obligatorio: true,
  },
  {
    id: "ESTADOS_FINANCIEROS_A3",
    nombre: "Estados Financieros — Hace dos años",
    descripcion: "Estados financieros del año más antiguo del período de evaluación.",
    categoria: "FINANCIERO",
    obligatorio: true,
  },
  {
    id: "DECLARACION_ANUAL_ISR",
    nombre: "Declaración Anual ISR",
    descripcion: "Declaración anual del Impuesto Sobre la Renta presentada ante el SAT.",
    categoria: "FINANCIERO",
    obligatorio: true,
  },
  {
    id: "OPINION_CUMPLIMIENTO_SAT",
    nombre: "Opinión de Cumplimiento SAT",
    descripcion: "Opinión positiva de cumplimiento de obligaciones fiscales vigente.",
    categoria: "FINANCIERO",
    obligatorio: true,
  },
  {
    id: "CONSTANCIA_IMSS",
    nombre: "Constancia de Situación Fiscal IMSS",
    descripcion: "Constancia que acredita estar al corriente con obligaciones ante el IMSS.",
    categoria: "FINANCIERO",
    obligatorio: true,
  },
  {
    id: "PRESUPUESTO_ANUAL",
    nombre: "Presupuesto Anual Aprobado",
    descripcion: "Presupuesto de ingresos y egresos aprobado por la dirección.",
    categoria: "FINANCIERO",
    obligatorio: false,
  },
  {
    id: "AUDITORIA_EXTERNA",
    nombre: "Dictamen de Auditoría Externa",
    descripcion: "Dictamen de auditor externo independiente (si aplica por tamaño).",
    categoria: "FINANCIERO",
    obligatorio: false,
  },

  // ─── AMBIENTAL (11) ─────────────────────────────────────────────────────
  {
    id: "POLITICA_AMBIENTAL",
    nombre: "Política Ambiental Corporativa",
    descripcion: "Declaración formal de compromisos ambientales firmada por la dirección.",
    categoria: "AMBIENTAL",
    obligatorio: true,
  },
  {
    id: "LICENCIA_FUNCIONAMIENTO",
    nombre: "Licencia de Funcionamiento Municipal",
    descripcion: "Licencia municipal vigente que autoriza la operación del establecimiento.",
    categoria: "AMBIENTAL",
    obligatorio: true,
  },
  {
    id: "LICENCIA_AMBIENTAL",
    nombre: "Licencia Ambiental Estatal",
    descripcion: "Licencia o autorización ambiental estatal vigente (si aplica).",
    categoria: "AMBIENTAL",
    obligatorio: false,
  },
  {
    id: "PERMISO_SEMARNAT",
    nombre: "Permiso o Autorización SEMARNAT",
    descripcion: "Permiso federal emitido por SEMARNAT para actividades reguladas (si aplica).",
    categoria: "AMBIENTAL",
    obligatorio: false,
  },
  {
    id: "PLAN_RESIDUOS",
    nombre: "Plan de Manejo de Residuos Sólidos",
    descripcion: "Plan documentado para la clasificación, manejo y disposición de residuos.",
    categoria: "AMBIENTAL",
    obligatorio: true,
  },
  {
    id: "MANIFESTO_PELIGROSOS",
    nombre: "Manifiesto de Residuos Peligrosos",
    descripcion: "Registro ante SEMARNAT para el manejo de residuos peligrosos (si aplica).",
    categoria: "AMBIENTAL",
    obligatorio: false,
  },
  {
    id: "INVENTARIO_GEI",
    nombre: "Inventario de Emisiones de GEI",
    descripcion: "Cálculo y reporte de emisiones de gases de efecto invernadero (alcances 1 y 2).",
    categoria: "AMBIENTAL",
    obligatorio: true,
  },
  {
    id: "PLAN_CARBONO",
    nombre: "Plan de Reducción de Huella de Carbono",
    descripcion: "Programa con metas y acciones para reducir emisiones de GEI.",
    categoria: "AMBIENTAL",
    obligatorio: true,
  },
  {
    id: "CONSUMO_ENERGIA",
    nombre: "Registros de Consumo de Energía Eléctrica",
    descripcion: "Historial de consumo eléctrico mensual de los últimos 12 meses.",
    categoria: "AMBIENTAL",
    obligatorio: true,
  },
  {
    id: "CONSUMO_AGUA",
    nombre: "Registros de Consumo de Agua",
    descripcion: "Historial de consumo de agua potable mensual de los últimos 12 meses.",
    categoria: "AMBIENTAL",
    obligatorio: true,
  },
  {
    id: "PROGRAMA_AHORRO",
    nombre: "Programa de Ahorro de Energía y Agua",
    descripcion: "Programa documentado con metas de reducción de consumo de recursos.",
    categoria: "AMBIENTAL",
    obligatorio: false,
  },

  // ─── SOCIAL (12) ────────────────────────────────────────────────────────
  {
    id: "POLITICA_DIVERSIDAD",
    nombre: "Política de Igualdad, Diversidad e Inclusión",
    descripcion: "Política que promueve la equidad de género y no discriminación.",
    categoria: "SOCIAL",
    obligatorio: true,
  },
  {
    id: "POLITICA_SST",
    nombre: "Política de Salud y Seguridad en el Trabajo",
    descripcion: "Política formal de SST firmada por la alta dirección.",
    categoria: "SOCIAL",
    obligatorio: true,
  },
  {
    id: "PROGRAMA_STPS",
    nombre: "Programa de Seguridad y Salud (STPS)",
    descripcion: "Programa anual de seguridad e higiene registrado ante la STPS.",
    categoria: "SOCIAL",
    obligatorio: true,
  },
  {
    id: "REGISTRO_ACCIDENTES",
    nombre: "Registros de Accidentes e Incidentes Laborales",
    descripcion: "Bitácora de accidentes e incidentes del último año con análisis de causa raíz.",
    categoria: "SOCIAL",
    obligatorio: true,
  },
  {
    id: "REGISTRO_STPS",
    nombre: "Comprobante de Registro ante STPS",
    descripcion: "Constancia de registro de la empresa ante la Secretaría del Trabajo.",
    categoria: "SOCIAL",
    obligatorio: true,
  },
  {
    id: "NOMINA_TRIMESTRE",
    nombre: "Nómina del Último Trimestre",
    descripcion: "Muestra de nómina de los últimos 3 meses que acredite pago de prestaciones.",
    categoria: "SOCIAL",
    obligatorio: true,
  },
  {
    id: "ALTAS_BAJAS_IMSS",
    nombre: "Altas y Bajas IMSS (SUA)",
    descripcion: "Reportes SUA de altas, bajas y modificaciones de salario del último trimestre.",
    categoria: "SOCIAL",
    obligatorio: true,
  },
  {
    id: "POLITICA_CAPACITACION",
    nombre: "Política de Desarrollo y Capacitación",
    descripcion: "Política que establece el compromiso de la empresa con el desarrollo del personal.",
    categoria: "SOCIAL",
    obligatorio: true,
  },
  {
    id: "PLAN_CAPACITACION",
    nombre: "Plan de Capacitación Anual",
    descripcion: "Programa anual de capacitación con temas, fechas, participantes y presupuesto.",
    categoria: "SOCIAL",
    obligatorio: true,
  },
  {
    id: "CLIMA_LABORAL",
    nombre: "Resultados de Encuesta de Clima Laboral",
    descripcion: "Informe de resultados de la encuesta de clima organizacional.",
    categoria: "SOCIAL",
    obligatorio: false,
  },
  {
    id: "POLITICA_NOM035",
    nombre: "Política de No Discriminación (NOM-035)",
    descripcion: "Política de identificación y prevención de factores de riesgo psicosocial.",
    categoria: "SOCIAL",
    obligatorio: true,
  },
  {
    id: "EVIDENCIA_NOM035",
    nombre: "Evidencia de Cumplimiento NOM-035-STPS",
    descripcion: "Guías de referencia, encuestas aplicadas y resultados de la NOM-035.",
    categoria: "SOCIAL",
    obligatorio: true,
  },

  // ─── LEGAL (9) ──────────────────────────────────────────────────────────
  {
    id: "REGISTRO_MARCA",
    nombre: "Registro de Marca o Nombre Comercial",
    descripcion: "Título de registro de marca vigente ante el IMPI (si aplica).",
    categoria: "LEGAL",
    obligatorio: false,
  },
  {
    id: "CONTRATO_CLIENTES",
    nombre: "Contrato con Clientes (modelo)",
    descripcion: "Modelo de contrato estándar utilizado con clientes principales.",
    categoria: "LEGAL",
    obligatorio: true,
  },
  {
    id: "CONTRATO_PROVEEDORES",
    nombre: "Contrato con Proveedores (modelo)",
    descripcion: "Modelo de contrato estándar utilizado con proveedores clave.",
    categoria: "LEGAL",
    obligatorio: true,
  },
  {
    id: "POLITICA_PROVEEDORES",
    nombre: "Política de Proveedores Responsables",
    descripcion: "Criterios ESG para la selección, evaluación y desarrollo de proveedores.",
    categoria: "LEGAL",
    obligatorio: true,
  },
  {
    id: "SEGURO_RC",
    nombre: "Seguro de Responsabilidad Civil",
    descripcion: "Póliza vigente de seguro de responsabilidad civil general.",
    categoria: "LEGAL",
    obligatorio: true,
  },
  {
    id: "POLIZAS_SEGUROS",
    nombre: "Pólizas de Seguros Empresariales",
    descripcion: "Resumen de coberturas de seguros vigentes (activos, vida, transportes, etc.).",
    categoria: "LEGAL",
    obligatorio: false,
  },
  {
    id: "REGISTRO_QUEJAS",
    nombre: "Registros de Quejas y Reclamaciones",
    descripcion: "Historial de quejas de clientes y trabajadores con resolución documentada.",
    categoria: "LEGAL",
    obligatorio: true,
  },
  {
    id: "CERTIFICACIONES_VIGENTES",
    nombre: "Certificaciones Vigentes (ISO, NMX u otro)",
    descripcion: "Copia de certificados vigentes bajo normas nacionales o internacionales.",
    categoria: "LEGAL",
    obligatorio: false,
  },
  {
    id: "LICENCIAS_SECTORIALES",
    nombre: "Licencias y Permisos Sectoriales",
    descripcion: "Permisos específicos del sector de actividad (COFEPRIS, SCT, CRE, etc.).",
    categoria: "LEGAL",
    obligatorio: false,
  },

  // ─── OPERACIONES (8) ────────────────────────────────────────────────────
  {
    id: "MAPA_PROCESOS",
    nombre: "Mapa de Procesos Principales",
    descripcion: "Diagrama o descripción de los procesos estratégicos, operativos y de soporte.",
    categoria: "OPERACIONES",
    obligatorio: true,
  },
  {
    id: "MANUAL_CALIDAD",
    nombre: "Manual de Calidad o Procedimientos",
    descripcion: "Manual que describe los sistemas de gestión y procedimientos operativos.",
    categoria: "OPERACIONES",
    obligatorio: true,
  },
  {
    id: "CADENA_SUMINISTRO",
    nombre: "Descripción de Cadena de Suministro",
    descripcion: "Mapa de proveedores críticos, insumos principales y gestión de riesgos.",
    categoria: "OPERACIONES",
    obligatorio: true,
  },
  {
    id: "PLAN_CONTINUIDAD",
    nombre: "Plan de Continuidad de Negocio",
    descripcion: "Plan documentado para la recuperación ante eventos disruptivos.",
    categoria: "OPERACIONES",
    obligatorio: false,
  },
  {
    id: "PLAN_RIESGOS",
    nombre: "Plan de Gestión de Riesgos",
    descripcion: "Matriz de riesgos con probabilidad, impacto y planes de mitigación.",
    categoria: "OPERACIONES",
    obligatorio: true,
  },
  {
    id: "POLITICA_INNOVACION",
    nombre: "Política de Innovación y Tecnología",
    descripcion: "Estrategia y compromisos de la empresa en materia de innovación.",
    categoria: "OPERACIONES",
    obligatorio: false,
  },
  {
    id: "INDICADORES_KPI",
    nombre: "Indicadores de Desempeño (KPIs)",
    descripcion: "Tablero de indicadores clave de desempeño operacional, financiero y ESG.",
    categoria: "OPERACIONES",
    obligatorio: true,
  },
  {
    id: "SISTEMA_GESTION",
    nombre: "Descripción del Sistema de Gestión Empresarial",
    descripcion: "Resumen del sistema de gestión implementado (ERP, ISO, metodologías, etc.).",
    categoria: "OPERACIONES",
    obligatorio: false,
  },
];

// Total: 60 documentos (12+8+11+12+9+8)
export const TOTAL_REQUERIDOS = CATALOGO_DOCUMENTOS.length;
export const TOTAL_OBLIGATORIOS = CATALOGO_DOCUMENTOS.filter(d => d.obligatorio).length;

export const CATEGORIAS: Record<CategoriaDocumento, { label: string; color: string; bgColor: string }> = {
  GOBERNANZA:  { label: "Gobernanza",  color: "text-cetiem-teal",  bgColor: "bg-cetiem-teal/10"  },
  FINANCIERO:  { label: "Financiero",  color: "text-cetiem-lime",  bgColor: "bg-cetiem-lime/10"  },
  AMBIENTAL:   { label: "Ambiental",   color: "text-cetiem-green", bgColor: "bg-cetiem-green/10" },
  SOCIAL:      { label: "Social",      color: "text-cetiem-amber", bgColor: "bg-cetiem-amber/10" },
  LEGAL:       { label: "Legal",       color: "text-white",        bgColor: "bg-white/10"        },
  OPERACIONES: { label: "Operaciones", color: "text-purple-400",   bgColor: "bg-purple-400/10"   },
  OTRO:        { label: "Otro",        color: "text-cetiem-gray",  bgColor: "bg-white/5"         },
};

export function getCatalogoById(id: string): TipoDocumento | undefined {
  return CATALOGO_DOCUMENTOS.find(d => d.id === id);
}

export function getCatalogoByCategoria(categoria: CategoriaDocumento): TipoDocumento[] {
  return CATALOGO_DOCUMENTOS.filter(d => d.categoria === categoria);
}

export const ORDEN_CATEGORIAS: CategoriaDocumento[] = [
  "GOBERNANZA",
  "FINANCIERO",
  "AMBIENTAL",
  "SOCIAL",
  "LEGAL",
  "OPERACIONES",
  "OTRO",
];
