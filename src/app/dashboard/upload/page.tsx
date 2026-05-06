"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useRole } from "@/lib/role-context";
import {
  Upload, FileText, X, CheckCircle, AlertCircle, Search,
  ChevronDown, ChevronRight, Plus, Cpu, Loader2, FolderOpen,
  Trash2, ListChecks, HelpCircle, Info, Sparkles, ArrowRight,
  Shield, Leaf, Users, Scale, Settings2, Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CATALOGO_DOCUMENTOS,
  CATEGORIAS,
  ORDEN_CATEGORIAS,
  TOTAL_REQUERIDOS,
  TOTAL_OBLIGATORIOS,
  type TipoDocumento,
  type CategoriaDocumento,
} from "@/lib/document-catalogue";

// ─── HelpTip — ícono ? con tooltip flotante ───────────────────────────────────
// Hover en desktop · click en móvil · cierra al hacer click fuera
function HelpTip({
  content,
  wide = false,
  align = "center",
}: {
  content: React.ReactNode;
  wide?: boolean;
  align?: "center" | "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div
      ref={ref}
      className="relative inline-flex items-center shrink-0"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="h-4 w-4 rounded-full flex items-center justify-center text-muted-foreground/35 hover:text-muted-foreground/70 transition-colors focus:outline-none"
        aria-label="Ayuda"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-50 bottom-full mb-2 px-3.5 py-2.5 rounded-xl bg-card border border-border shadow-2xl text-xs text-foreground/80 leading-relaxed pointer-events-none",
            wide ? "w-72" : "w-56",
            align === "center" && "left-1/2 -translate-x-1/2",
            align === "left"   && "left-0",
            align === "right"  && "right-0",
          )}
        >
          {content}
          {/* Flecha */}
          <span className={cn(
            "absolute top-full w-0 h-0",
            "border-l-[5px] border-r-[5px] border-t-[5px]",
            "border-l-transparent border-r-transparent border-t-border",
            align === "center" && "left-1/2 -translate-x-1/2",
            align === "left"   && "left-3",
            align === "right"  && "right-3",
          )} />
          <span className={cn(
            "absolute border-l-[5px] border-r-[5px] border-t-[5px]",
            "border-l-transparent border-r-transparent border-t-card",
            "w-0 h-0",
            // mt-[-2px] to sit just inside the border arrow
            "top-[calc(100%-1px)]",
            align === "center" && "left-1/2 -translate-x-1/2",
            align === "left"   && "left-3",
            align === "right"  && "right-3",
          )} />
        </div>
      )}
    </div>
  );
}

// ─── Iconos por categoría ─────────────────────────────────────────────────────
const CAT_ICONS: Record<CategoriaDocumento, React.ElementType> = {
  GOBERNANZA:  Building2,
  FINANCIERO:  Scale,
  AMBIENTAL:   Leaf,
  SOCIAL:      Users,
  LEGAL:       Shield,
  OPERACIONES: Settings2,
  OTRO:        FileText,
};

const CAT_HELP: Record<CategoriaDocumento, string> = {
  GOBERNANZA:  "Documentos legales y de gobierno corporativo: acta constitutiva, poderes, códigos de ética, políticas internas.",
  FINANCIERO:  "Estados financieros, declaraciones fiscales SAT e IMSS y dictámenes de auditoría de los últimos 3 años.",
  AMBIENTAL:   "Licencias, permisos SEMARNAT, inventario de emisiones GEI y planes de manejo de residuos.",
  SOCIAL:      "Documentos de personal, nómina, seguridad e higiene (STPS), NOM-035 y políticas de diversidad.",
  LEGAL:       "Contratos con clientes/proveedores, pólizas de seguros, registros de quejas y certificaciones vigentes.",
  OPERACIONES: "Mapa de procesos, manuales de calidad, plan de riesgos, KPIs y sistema de gestión empresarial.",
  OTRO:        "Documentos adicionales que no encajan en las categorías anteriores.",
};

// ─── Panel de cobertura de categorías ────────────────────────────────────────
function CoberturaPanel({ cola }: { cola: ItemCola[] }) {
  const cats = ORDEN_CATEGORIAS.filter(c => c !== "OTRO");
  const subidos   = (cat: CategoriaDocumento) => cola.filter(i => i.tipo?.categoria === cat && i.estado === "ok").length;
  const enCola    = (cat: CategoriaDocumento) => cola.filter(i => i.tipo?.categoria === cat && i.estado === "pendiente").length;
  const obligatorios = (cat: CategoriaDocumento) =>
    CATALOGO_DOCUMENTOS.filter(d => d.categoria === cat && d.obligatorio).length;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <ListChecks className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-semibold text-foreground/70 uppercase tracking-wider">
          Cobertura de categorías
        </span>
        <HelpTip
          wide
          align="left"
          content={
            <span>
              Muestra cuántos documentos de cada categoría has agregado a la cola.
              Las categorías con documentos <strong>obligatorios</strong> deben cubrirse
              completamente para aprobar la certificación.
            </span>
          }
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {cats.map(cat => {
          const Icon = CAT_ICONS[cat];
          const ok  = subidos(cat);
          const pending = enCola(cat);
          const total   = ok + pending;
          const oblig   = obligatorios(cat);
          const allObligCovered = cola
            .filter(i => i.tipo?.categoria === cat && i.tipo?.obligatorio && (i.estado === "ok" || i.estado === "pendiente"))
            .length >= oblig;

          return (
            <div
              key={cat}
              className={cn(
                "relative flex items-start gap-2 px-3 py-2.5 rounded-xl border transition-all",
                ok > 0
                  ? allObligCovered
                    ? "bg-economia-success/8 border-economia-success/30"
                    : "bg-economia-warning/8 border-economia-warning/30"
                  : pending > 0
                    ? "bg-economia-guinda/8 border-economia-guinda/30"
                    : "bg-muted border-border"
              )}
            >
              <Icon className={cn(
                "h-3.5 w-3.5 mt-0.5 shrink-0",
                ok > 0 ? (allObligCovered ? "text-economia-success" : "text-economia-warning") :
                pending > 0 ? "text-economia-guinda" : "text-muted-foreground/60"
              )} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className={cn(
                    "text-[11px] font-semibold truncate",
                    ok > 0 || pending > 0 ? "text-foreground" : "text-foreground/70"
                  )}>
                    {CATEGORIAS[cat].label}
                  </span>
                  <HelpTip content={CAT_HELP[cat]} align="center" wide />
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {total > 0 ? `${total} en cola` : "Sin documentos"}
                </span>
              </div>
              {total > 0 && (
                <span className={cn(
                  "text-[10px] font-bold shrink-0",
                  ok > 0 ? "text-economia-success" : "text-economia-guinda"
                )}>
                  {total}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface ItemCola {
  uid: string;
  tipo: TipoDocumento | null;
  file: File | null;
  notas: string;
  estado: "pendiente" | "subiendo" | "ok" | "error";
  progreso: number;
  errorMsg: string;
}

const POR_CATEGORIA = ORDEN_CATEGORIAS.reduce<Record<CategoriaDocumento, TipoDocumento[]>>(
  (acc, cat) => { acc[cat] = CATALOGO_DOCUMENTOS.filter(d => d.categoria === cat); return acc; },
  {} as any
);

let uidCounter = 0;
const newUid = () => `item-${++uidCounter}`;
const emptyItem = (): ItemCola => ({
  uid: newUid(), tipo: null, file: null, notas: "", estado: "pendiente", progreso: 0, errorMsg: "",
});

// ─── Selector de tipo ─────────────────────────────────────────────────────────
function TipoSelector({
  value, onChange, ocupados,
}: { value: TipoDocumento | null; onChange: (t: TipoDocumento) => void; ocupados: Set<string> }) {
  const [open, setOpen] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [cats, setCats] = useState<Set<CategoriaDocumento>>(new Set(["GOBERNANZA"]));

  const filtrados = busqueda.trim()
    ? CATALOGO_DOCUMENTOS.filter(d =>
        d.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        d.descripcion.toLowerCase().includes(busqueda.toLowerCase())
      )
    : null;

  const toggle = (cat: CategoriaDocumento) => {
    setCats(prev => { const n = new Set(prev); n.has(cat) ? n.delete(cat) : n.add(cat); return n; });
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-all text-left",
          value
            ? "border-border bg-muted"
            : "border-dashed border-border bg-muted/50 hover:border-economia-guinda/40 hover:bg-economia-guinda/3"
        )}
      >
        {value ? (
          <>
            <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0",
              CATEGORIAS[value.categoria].bgColor, CATEGORIAS[value.categoria].color
            )}>
              {CATEGORIAS[value.categoria].label}
            </span>
            <span className="text-foreground flex-1 truncate">{value.nombre}</span>
            {value.obligatorio && (
              <span className="text-[10px] text-economia-warning font-semibold shrink-0">★ Oblig.</span>
            )}
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
          </>
        ) : (
          <>
            <Search className="h-4 w-4 text-muted-foreground/60 shrink-0" />
            <span className="text-muted-foreground">Seleccionar tipo de documento...</span>
          </>
        )}
      </button>
    );
  }

  return (
    <div className="border border-economia-guinda/30 rounded-xl bg-card shadow-xl">
      {/* Buscador */}
      <div className="relative p-2 border-b border-border">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
        <input
          autoFocus
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o descripción..."
          className="w-full h-8 pl-8 pr-8 text-sm bg-muted rounded-lg text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
        />
        <button onClick={() => { setOpen(false); setBusqueda(""); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-border text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="text-economia-warning">★</span> Obligatorio para la certificación
        </span>
        <span className="flex items-center gap-1 opacity-60">
          <span>○</span> Opcional / si aplica
        </span>
      </div>

      {/* Lista */}
      <div className="max-h-72 overflow-y-auto p-1.5">
        {filtrados ? (
          filtrados.length > 0 ? (
            filtrados.map(doc => (
              <button key={doc.id}
                onClick={() => { onChange(doc); setOpen(false); setBusqueda(""); }}
                disabled={ocupados.has(doc.id)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg transition-colors",
                  ocupados.has(doc.id)
                    ? "opacity-30 cursor-not-allowed"
                    : "hover:bg-muted"
                )}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded",
                    CATEGORIAS[doc.categoria].bgColor, CATEGORIAS[doc.categoria].color
                  )}>
                    {CATEGORIAS[doc.categoria].label}
                  </span>
                  {doc.obligatorio && <span className="text-[10px] text-economia-warning">★</span>}
                  {ocupados.has(doc.id) && <span className="text-[10px] text-muted-foreground/40">ya en cola</span>}
                </div>
                <p className="text-sm text-foreground">{doc.nombre}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{doc.descripcion}</p>
              </button>
            ))
          ) : <p className="text-center text-muted-foreground text-sm py-4">Sin resultados para "{busqueda}"</p>
        ) : (
          ORDEN_CATEGORIAS.filter(c => c !== "OTRO").map(cat => (
            <div key={cat}>
              <button onClick={() => toggle(cat)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted transition-colors">
                <span className={cn("h-2 w-2 rounded-full", CATEGORIAS[cat].bgColor.replace("/10",""))} />
                <span className={cn("text-xs font-semibold uppercase tracking-wider flex-1 text-left",
                  CATEGORIAS[cat].color)}>
                  {CATEGORIAS[cat].label}
                </span>
                <span className="text-[10px] text-muted-foreground/70">
                  ({POR_CATEGORIA[cat]?.filter(d => !ocupados.has(d.id)).length} disponibles)
                </span>
                {cats.has(cat) ? <ChevronDown className="h-3 w-3 text-muted-foreground/70" /> : <ChevronRight className="h-3 w-3 text-muted-foreground/70" />}
              </button>
              {cats.has(cat) && (
                <div className="ml-2 border-l border-border pl-2 mb-1">
                  {POR_CATEGORIA[cat]?.map(doc => (
                    <button key={doc.id}
                      onClick={() => { onChange(doc); setOpen(false); setBusqueda(""); }}
                      disabled={ocupados.has(doc.id)}
                      className={cn(
                        "w-full text-left px-2 py-1.5 rounded-lg transition-colors group",
                        ocupados.has(doc.id)
                          ? "opacity-30 cursor-not-allowed"
                          : "hover:bg-muted"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className={cn("text-sm transition-colors",
                          ocupados.has(doc.id) ? "text-muted-foreground/50" : "text-foreground/80 group-hover:text-foreground"
                        )}>
                          {doc.nombre}
                        </span>
                        {doc.obligatorio && <span className="text-[10px] text-economia-warning ml-auto">★</span>}
                      </div>
                      {!ocupados.has(doc.id) && (
                        <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{doc.descripcion}</p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Item de la cola ──────────────────────────────────────────────────────────
function ItemFila({
  item, onTipo, onFile, onRemove, ocupados,
}: {
  item: ItemCola;
  onTipo: (t: TipoDocumento) => void;
  onFile: (f: File) => void;
  onRemove: () => void;
  ocupados: Set<string>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isDone = item.estado === "ok";
  const isErr  = item.estado === "error";
  const isBusy = item.estado === "subiendo";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && f.type === "application/pdf") onFile(f);
  };

  return (
    <div className={cn(
      "border rounded-2xl p-3.5 transition-all",
      isDone ? "bg-economia-success/3 border-economia-success/20" :
      isErr  ? "bg-economia-error/5  border-economia-error/20" :
               "bg-card border-border hover:border-muted-foreground/30"
    )}>
      <div className="flex items-start gap-3">
        {/* Status / remove */}
        <div className="shrink-0 mt-1">
          {isDone ? (
            <CheckCircle className="h-5 w-5 text-economia-success" />
          ) : isErr ? (
            <AlertCircle className="h-5 w-5 text-economia-error" />
          ) : isBusy ? (
            <Loader2 className="h-5 w-5 text-economia-warning animate-spin" />
          ) : (
            <button onClick={onRemove}
              className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground/60 hover:text-economia-error transition-colors">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-2">

          {/* ── Tipo selector ── */}
          {!isDone ? (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Tipo de documento
                </span>
                <HelpTip
                  align="left"
                  content={
                    <span>
                      Selecciona la categoría exacta del documento.
                      Los marcados con <strong className="text-economia-warning">★</strong> son
                      obligatorios para completar la certificación ESG.
                    </span>
                  }
                />
              </div>
              <TipoSelector value={item.tipo} onChange={onTipo} ocupados={ocupados} />
            </div>
          ) : (
            /* Tipo completado — mostrar badge + nombre + descripción */
            item.tipo && (
              <div className="flex items-start gap-2">
                <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 mt-0.5",
                  CATEGORIAS[item.tipo.categoria].bgColor, CATEGORIAS[item.tipo.categoria].color
                )}>
                  {CATEGORIAS[item.tipo.categoria].label}
                </span>
                <div>
                  <p className="text-sm text-foreground font-medium">{item.tipo.nombre}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{item.tipo.descripcion}</p>
                </div>
              </div>
            )
          )}

          {/* Descripción del tipo (cuando está seleccionado pero no subido) */}
          {!isDone && item.tipo && (
            <div className="flex items-start gap-2 px-2.5 py-1.5 rounded-lg bg-muted text-[11px] text-muted-foreground">
              <Info className="h-3 w-3 shrink-0 mt-0.5 text-muted-foreground/70" />
              <span>{item.tipo.descripcion}</span>
              {item.tipo.obligatorio && (
                <span className="ml-auto shrink-0 text-economia-warning font-semibold">★ Obligatorio</span>
              )}
            </div>
          )}

          {/* ── File picker ── */}
          {!isDone && (
            <div>
              <input ref={fileInputRef} type="file" accept="application/pdf"
                className="hidden" onChange={handleFileChange} />
              {item.file ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-xl">
                  <FileText className="h-4 w-4 text-economia-error/60 shrink-0" />
                  <span className="text-foreground text-xs truncate flex-1">{item.file.name}</span>
                  <span className="text-muted-foreground/40 text-xs shrink-0">
                    {(item.file.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                  {!isBusy && (
                    <button onClick={() => fileInputRef.current?.click()}
                      className="text-muted-foreground/40 hover:text-foreground transition-colors shrink-0">
                      <FolderOpen className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ) : (
                <button onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 border border-dashed border-border rounded-xl hover:border-economia-guinda/60 hover:bg-economia-guinda/5 transition-all text-sm text-muted-foreground hover:text-foreground">
                  <FolderOpen className="h-4 w-4 shrink-0" />
                  <span>Seleccionar PDF...</span>
                  <span className="ml-auto text-[10px] text-muted-foreground/60">Solo .pdf</span>
                </button>
              )}
            </div>
          )}

          {/* Progreso */}
          {isBusy && (
            <div className="space-y-1">
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-economia-guinda rounded-full transition-all"
                  style={{ width: `${item.progreso}%` }} />
              </div>
              <p className="text-[10px] text-muted-foreground/50">Subiendo… {item.progreso}%</p>
            </div>
          )}

          {/* Archivo cuando ya está ok */}
          {isDone && item.file && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground/40">
              <FileText className="h-3 w-3" />
              <span className="truncate">{item.file.name}</span>
              <span className="shrink-0">{(item.file.size / 1024 / 1024).toFixed(1)} MB</span>
            </div>
          )}

          {/* Warning (subido OK pero sin cola de IA) */}
          {isDone && item.errorMsg && (
            <div className="flex items-start gap-1.5 text-xs text-economia-warning">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              {item.errorMsg}
            </div>
          )}

          {/* Error */}
          {isErr && (
            <div className="flex items-start gap-1.5 text-xs text-economia-error">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              {item.errorMsg || "Error al subir el archivo"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Drop zone global ─────────────────────────────────────────────────────────
function GlobalDropZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [active, setActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setActive(true); };
  const onDragLeave = () => setActive(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setActive(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type === "application/pdf");
    if (files.length > 0) onFiles(files);
  };
  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(f => f.type === "application/pdf");
    if (files.length > 0) onFiles(files);
    e.target.value = "";
  };

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "relative border-2 border-dashed rounded-2xl py-10 text-center transition-all cursor-pointer select-none",
        active
          ? "border-economia-guinda bg-economia-guinda/8 scale-[1.01]"
          : "border-border bg-muted/40 hover:border-economia-guinda/50 hover:bg-economia-guinda/3"
      )}
    >
      <input ref={inputRef} type="file" accept="application/pdf" multiple className="hidden" onChange={onPick} />

      {/* Help tip — posicionado arriba derecha de la zona */}
      <div className="absolute top-3 right-3" onClick={e => e.stopPropagation()}>
        <HelpTip
          wide
          align="right"
          content={
            <div className="space-y-1.5">
              <p className="font-semibold text-foreground/90">Requisitos del archivo</p>
              <ul className="space-y-1 text-muted-foreground/70">
                <li>• Solo archivos <strong>PDF</strong></li>
                <li>• Tamaño recomendado: hasta <strong>50 MB</strong></li>
                <li>• Puedes soltar varios PDFs a la vez</li>
                <li>• Después de subir, la IA los analiza automáticamente</li>
              </ul>
            </div>
          }
        />
      </div>

      <div className={cn(
        "h-12 w-12 rounded-2xl mx-auto mb-3 flex items-center justify-center transition-colors",
        active ? "bg-economia-guinda/20" : "bg-muted"
      )}>
        <Upload className={cn("h-6 w-6 transition-colors", active ? "text-economia-guinda" : "text-muted-foreground")} />
      </div>
      <p className={cn("text-sm font-semibold transition-colors", active ? "text-economia-guinda" : "text-foreground")}>
        {active ? "Suelta los PDFs aquí" : "Arrastra varios PDFs aquí o haz clic para seleccionar"}
      </p>
      <p className="text-xs text-muted-foreground mt-1">Solo archivos PDF · Se crean entradas en la cola automáticamente</p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function UploadPage() {
  const router = useRouter();
  const { role } = useRole();

  useEffect(() => {
    if (role && role !== "company") router.replace("/dashboard");
  }, [role, router]);

  const [cola, setCola]       = useState<ItemCola[]>([emptyItem()]);
  const [uploading, setUploading] = useState(false);
  const [done, setDone]       = useState(false);

  const ocupados = new Set(cola.map(i => i.tipo?.id).filter(Boolean) as string[]);

  const updateItem = (uid: string, patch: Partial<ItemCola>) =>
    setCola(prev => prev.map(i => i.uid === uid ? { ...i, ...patch } : i));

  const addItem    = () => setCola(prev => [...prev, emptyItem()]);
  const removeItem = (uid: string) => setCola(prev => prev.filter(i => i.uid !== uid));

  const handleDropFiles = (files: File[]) => {
    setCola(prev => {
      const next = [...prev];
      let idx = next.findIndex(i => !i.tipo && !i.file);
      for (const f of files) {
        if (idx >= 0 && idx < next.length) {
          next[idx] = { ...next[idx], file: f };
          idx = next.findIndex((item, j) => j > idx && !item.tipo && !item.file);
        } else {
          next.push({ ...emptyItem(), file: f });
        }
      }
      return next;
    });
  };

  const colaValida = cola.filter(i => i.tipo && i.file && i.estado === "pendiente");
  const colaTotal  = cola.length;
  const colaOk     = cola.filter(i => i.estado === "ok").length;
  const colaErr    = cola.filter(i => i.estado === "error").length;

  const handleUploadAll = async () => {
    if (colaValida.length === 0) return;
    setUploading(true);

    for (const item of colaValida) {
      updateItem(item.uid, { estado: "subiendo", progreso: 0 });
      try {
        await new Promise<void>((resolve, reject) => {
          const formData = new FormData();
          formData.append("file", item.file!);
          formData.append("description", item.notas);
          formData.append("tipoDocumento", item.tipo!.id);
          formData.append("categoriaDoc", item.tipo!.categoria);

          const xhr = new XMLHttpRequest();
          xhr.upload.addEventListener("progress", e => {
            if (e.lengthComputable)
              updateItem(item.uid, { progreso: Math.round((e.loaded / e.total) * 100) });
          });
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              let warning = "";
              try { warning = JSON.parse(xhr.responseText)?.warning || ""; } catch {}
              updateItem(item.uid, { estado: "ok", progreso: 100, ...(warning ? { errorMsg: warning } : {}) });
              resolve();
            } else {
              let msg = "Error al subir";
              try { msg = JSON.parse(xhr.responseText)?.error || msg; } catch {}
              updateItem(item.uid, { estado: "error", errorMsg: msg });
              reject(new Error(msg));
            }
          };
          xhr.onerror = () => {
            updateItem(item.uid, { estado: "error", errorMsg: "Error de conexión" });
            reject(new Error("network error"));
          };
          xhr.open("POST", "/api/documents");
          xhr.send(formData);
        });
      } catch {
        // continúa con el siguiente item
      }
    }

    setUploading(false);
    if (cola.filter(i => i.estado === "error").length === 0) {
      setDone(true);
      setTimeout(() => router.push("/dashboard/documents"), 2200);
    }
  };

  // ── Pantalla de éxito ──
  if (done) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-5 p-8">
        <div className="h-20 w-20 rounded-3xl bg-economia-success/10 flex items-center justify-center">
          <CheckCircle className="h-10 w-10 text-economia-success" />
        </div>
        <div className="text-center">
          <h2 className="font-heading font-bold text-2xl text-foreground">
            {colaOk} documento{colaOk !== 1 ? "s" : ""} subido{colaOk !== 1 ? "s" : ""}
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            La IA comenzará el análisis en segundos
          </p>
        </div>
        <div className="flex items-center gap-6 text-xs text-muted-foreground/50 bg-muted/40 rounded-2xl px-6 py-4">
          <Step n="1" label="Subida completada" done />
          <ArrowRight className="h-3 w-3 shrink-0" />
          <Step n="2" label="Análisis IA" active />
          <ArrowRight className="h-3 w-3 shrink-0" />
          <Step n="3" label="Revisión assessor" />
          <ArrowRight className="h-3 w-3 shrink-0" />
          <Step n="4" label="Certificación" />
        </div>
        <p className="text-muted-foreground/40 text-xs">Redirigiendo a tus documentos…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading font-bold text-2xl text-foreground">Subir Documentos</h1>
            <HelpTip
              wide
              align="left"
              content={
                <div className="space-y-2">
                  <p className="font-semibold text-foreground/90">¿Cómo funciona?</p>
                  <ol className="space-y-1.5 text-muted-foreground/70 list-decimal list-inside">
                    <li>Sube tus documentos en PDF</li>
                    <li>La IA extrae entidades, relaciones y estructura</li>
                    <li>Un assessor ESG revisa el conjunto</li>
                    <li>Recibes tu dictamen de certificación</li>
                  </ol>
                  <p className="text-muted-foreground/50 pt-1 border-t border-border">
                    Se requieren <strong>{TOTAL_OBLIGATORIOS}</strong> documentos obligatorios
                    de {TOTAL_REQUERIDOS} en el catálogo.
                  </p>
                </div>
              }
            />
          </div>
          <p className="text-foreground/60 text-sm mt-0.5">
            {TOTAL_OBLIGATORIOS} obligatorios · {TOTAL_REQUERIDOS} en el catálogo completo
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/40 font-medium">
          <Sparkles className="h-3.5 w-3.5" />
          Análisis IA
          <span className="opacity-40 mx-1">·</span>
          <Cpu className="h-3.5 w-3.5" />
          NVIDIA
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-3xl mx-auto space-y-4">

          {/* ── Panel de cobertura ── */}
          <CoberturaPanel cola={cola} />

          {/* ── Drop zone ── */}
          <GlobalDropZone onFiles={handleDropFiles} />

          {/* ── Cola de documentos ── */}
          <div className="space-y-2.5">
            {cola.map(item => (
              <ItemFila
                key={item.uid}
                item={item}
                onTipo={t => updateItem(item.uid, { tipo: t })}
                onFile={f => updateItem(item.uid, { file: f })}
                onRemove={() => removeItem(item.uid)}
                ocupados={ocupados}
              />
            ))}
          </div>

          {/* ── Añadir más ── */}
          {!uploading && (
            <button
              onClick={addItem}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-border rounded-xl text-muted-foreground hover:text-foreground hover:border-economia-guinda/50 hover:bg-economia-guinda/5 text-sm font-medium transition-all"
            >
              <Plus className="h-4 w-4" /> Añadir otro documento
            </button>
          )}

          {/* ── Barra de acción ── */}
          <div className="sticky bottom-0 pt-2 pb-1">
            <div className="bg-card/95 backdrop-blur border border-border rounded-2xl p-4 flex items-center gap-4">
              {/* Resumen */}
              <div className="flex items-center gap-3 flex-1 flex-wrap text-sm">
                <div className="flex items-center gap-1.5 text-foreground/70 font-medium">
                  <ListChecks className="h-4 w-4 text-muted-foreground" />
                  {colaTotal} en cola
                </div>
                {colaValida.length > 0 && (
                  <span className="text-economia-guinda font-medium">
                    {colaValida.length} listo{colaValida.length !== 1 ? "s" : ""}
                  </span>
                )}
                {colaOk > 0 && (
                  <span className="text-economia-success font-medium flex items-center gap-1">
                    <CheckCircle className="h-3.5 w-3.5" />
                    {colaOk} subido{colaOk !== 1 ? "s" : ""}
                  </span>
                )}
                {colaErr > 0 && (
                  <span className="text-economia-error font-medium">{colaErr} con error</span>
                )}
                {cola.some(i => i.tipo && !i.file && i.estado === "pendiente") && (
                  <span className="text-economia-warning/70 text-xs">
                    {cola.filter(i => i.tipo && !i.file && i.estado === "pendiente").length} sin archivo
                  </span>
                )}
                {cola.some(i => !i.tipo && i.file && i.estado === "pendiente") && (
                  <span className="text-economia-warning/70 text-xs">
                    {cola.filter(i => !i.tipo && i.file && i.estado === "pendiente").length} sin tipo
                  </span>
                )}
              </div>

              {/* Mensajes post-upload */}
              {!uploading && cola.some(i => i.estado === "error") && cola.some(i => i.estado === "ok") && (
                <span className="text-economia-warning text-xs font-medium shrink-0">
                  Corrige los marcados en rojo
                </span>
              )}

              {/* Ver documentos */}
              {!uploading && cola.some(i => i.estado === "ok") && (
                <Link href="/dashboard/documents"
                  className="text-xs text-economia-info hover:underline shrink-0">
                  Ver documentos →
                </Link>
              )}

              {/* Help sobre qué pasa al subir */}
              <HelpTip
                wide
                align="right"
                content={
                  <div className="space-y-1.5">
                    <p className="font-semibold text-foreground/90">¿Qué pasa al subir?</p>
                    <ul className="space-y-1 text-muted-foreground/70">
                      <li>① El documento queda en estado <strong>Pendiente</strong></li>
                      <li>② La IA extrae entidades y relaciones (PageIndex + grafo)</li>
                      <li>③ El assessor recibe una notificación para revisar</li>
                      <li>④ Puedes ver el avance en <strong>Mis Documentos</strong></li>
                    </ul>
                  </div>
                }
              />

              {/* Botón principal */}
              <button
                onClick={handleUploadAll}
                disabled={colaValida.length === 0 || uploading}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all shrink-0",
                  colaValida.length > 0 && !uploading
                    ? "bg-economia-guinda hover:bg-economia-guinda/90 text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground/40 cursor-not-allowed"
                )}
              >
                {uploading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Subiendo…</>
                ) : (
                  <><Upload className="h-4 w-4" />
                    Subir{colaValida.length > 0 ? ` ${colaValida.length}` : ""} documento{colaValida.length !== 1 ? "s" : ""}
                  </>
                )}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Mini helper: paso del flujo ──────────────────────────────────────────────
function Step({ n, label, done, active }: { n: string; label: string; done?: boolean; active?: boolean }) {
  return (
    <div className={cn("flex items-center gap-1.5", done ? "text-economia-success" : active ? "text-economia-guinda" : "")}>
      <span className={cn(
        "h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold border",
        done   ? "bg-economia-success/15 border-economia-success/30 text-economia-success" :
        active ? "bg-economia-guinda/15  border-economia-guinda/30  text-economia-guinda" :
                 "bg-muted border-border text-muted-foreground/40"
      )}>
        {done ? "✓" : n}
      </span>
      <span className={cn(
        "text-xs",
        done ? "text-economia-success" : active ? "text-economia-guinda" : "text-muted-foreground/40"
      )}>{label}</span>
    </div>
  );
}
