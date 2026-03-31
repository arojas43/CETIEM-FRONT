"use client";

import { useState, useCallback, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";
import {
  Upload, FileText, X, CheckCircle, AlertCircle, Search,
  ChevronDown, ChevronRight, Plus, Cpu, Loader2, FolderOpen,
  Trash2, ListChecks,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CATALOGO_DOCUMENTOS,
  CATEGORIAS,
  ORDEN_CATEGORIAS,
  TOTAL_REQUERIDOS,
  type TipoDocumento,
  type CategoriaDocumento,
} from "@/lib/document-catalogue";

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

// ─── Selector de tipo (reutilizable por item) ─────────────────────────────────
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
            ? "border-white/10 bg-white/5"
            : "border-dashed border-white/15 bg-white/3 hover:border-cetiem-green/40"
        )}
      >
        {value ? (
          <>
            <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0",
              CATEGORIAS[value.categoria].bgColor, CATEGORIAS[value.categoria].color
            )}>
              {CATEGORIAS[value.categoria].label}
            </span>
            <span className="text-white flex-1 truncate">{value.nombre}</span>
            <ChevronDown className="h-3.5 w-3.5 text-cetiem-gray/40 shrink-0" />
          </>
        ) : (
          <>
            <Search className="h-4 w-4 text-cetiem-gray/40 shrink-0" />
            <span className="text-cetiem-gray/50">Seleccionar tipo de documento...</span>
          </>
        )}
      </button>
    );
  }

  return (
    <div className="border border-cetiem-green/30 rounded-xl bg-cetiem-card shadow-xl">
      {/* Buscador */}
      <div className="relative p-2 border-b border-white/5">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-cetiem-gray/40" />
        <input
          autoFocus
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar tipo..."
          className="w-full h-8 pl-8 pr-8 text-sm bg-white/5 rounded-lg text-white placeholder:text-cetiem-gray/40 focus:outline-none"
        />
        <button onClick={() => { setOpen(false); setBusqueda(""); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-cetiem-gray/40 hover:text-white">
          <X className="h-3.5 w-3.5" />
        </button>
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
                    : "hover:bg-white/5"
                )}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded",
                    CATEGORIAS[doc.categoria].bgColor, CATEGORIAS[doc.categoria].color
                  )}>
                    {CATEGORIAS[doc.categoria].label}
                  </span>
                  {doc.obligatorio && <span className="text-[10px] text-cetiem-amber">*</span>}
                  {ocupados.has(doc.id) && <span className="text-[10px] text-cetiem-gray/40">ya en cola</span>}
                </div>
                <p className="text-sm text-white">{doc.nombre}</p>
              </button>
            ))
          ) : <p className="text-center text-cetiem-gray text-sm py-4">Sin resultados</p>
        ) : (
          ORDEN_CATEGORIAS.filter(c => c !== "OTRO").map(cat => (
            <div key={cat}>
              <button onClick={() => toggle(cat)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
                <span className={cn("h-2 w-2 rounded-full", CATEGORIAS[cat].bgColor.replace("/10",""))} />
                <span className={cn("text-xs font-semibold uppercase tracking-wider flex-1 text-left",
                  CATEGORIAS[cat].color)}>
                  {CATEGORIAS[cat].label}
                </span>
                <span className="text-[10px] text-cetiem-gray/40">({POR_CATEGORIA[cat]?.length})</span>
                {cats.has(cat) ? <ChevronDown className="h-3 w-3 text-cetiem-gray/40" /> : <ChevronRight className="h-3 w-3 text-cetiem-gray/40" />}
              </button>
              {cats.has(cat) && (
                <div className="ml-2 border-l border-white/5 pl-2 mb-1">
                  {POR_CATEGORIA[cat]?.map(doc => (
                    <button key={doc.id}
                      onClick={() => { onChange(doc); setOpen(false); setBusqueda(""); }}
                      disabled={ocupados.has(doc.id)}
                      className={cn(
                        "w-full text-left px-2 py-1.5 rounded-lg transition-colors flex items-center gap-2",
                        ocupados.has(doc.id)
                          ? "opacity-30 cursor-not-allowed"
                          : "hover:bg-white/5 group"
                      )}
                    >
                      <span className={cn("text-sm transition-colors",
                        ocupados.has(doc.id) ? "text-cetiem-gray/40" : "text-cetiem-gray group-hover:text-white"
                      )}>
                        {doc.nombre}
                      </span>
                      {doc.obligatorio && <span className="text-[10px] text-cetiem-amber/60 ml-auto">*</span>}
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
  item, onTipo, onFile, onNotas, onRemove, ocupados,
}: {
  item: ItemCola;
  onTipo: (t: TipoDocumento) => void;
  onFile: (f: File) => void;
  onNotas: (n: string) => void;
  onRemove: () => void;
  ocupados: Set<string>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && f.type === "application/pdf") onFile(f);
  };

  const isDone = item.estado === "ok";
  const isErr  = item.estado === "error";
  const isBusy = item.estado === "subiendo";

  return (
    <div className={cn(
      "border rounded-xl p-3 transition-all",
      isDone ? "bg-cetiem-lime/3 border-cetiem-lime/20" :
      isErr  ? "bg-cetiem-red/5 border-cetiem-red/20" :
               "bg-white/[0.02] border-white/8"
    )}>
      <div className="flex items-start gap-3">
        {/* Status icon / remove */}
        <div className="shrink-0 mt-0.5">
          {isDone ? (
            <CheckCircle className="h-5 w-5 text-cetiem-lime" />
          ) : isErr ? (
            <AlertCircle className="h-5 w-5 text-cetiem-red" />
          ) : isBusy ? (
            <Loader2 className="h-5 w-5 text-cetiem-amber animate-spin" />
          ) : (
            <button onClick={onRemove}
              className="h-5 w-5 flex items-center justify-center rounded text-cetiem-gray/40 hover:text-cetiem-red transition-colors">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          {/* Tipo selector */}
          {!isDone && (
            <TipoSelector value={item.tipo} onChange={onTipo} ocupados={ocupados} />
          )}
          {isDone && item.tipo && (
            <div className="flex items-center gap-2">
              <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium",
                CATEGORIAS[item.tipo.categoria].bgColor, CATEGORIAS[item.tipo.categoria].color
              )}>
                {CATEGORIAS[item.tipo.categoria].label}
              </span>
              <span className="text-white text-sm">{item.tipo.nombre}</span>
            </div>
          )}

          {/* File picker */}
          {!isDone && (
            <div>
              <input ref={fileInputRef} type="file" accept="application/pdf"
                className="hidden" onChange={handleFileChange} />
              {item.file ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg">
                  <FileText className="h-4 w-4 text-cetiem-red/70 shrink-0" />
                  <span className="text-white text-xs truncate flex-1">{item.file.name}</span>
                  <span className="text-cetiem-gray/40 text-xs shrink-0">
                    {(item.file.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                  {!isBusy && (
                    <button onClick={() => fileInputRef.current?.click()}
                      className="text-cetiem-gray/40 hover:text-white transition-colors shrink-0">
                      <FolderOpen className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ) : (
                <button onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center gap-2 px-3 py-2 border border-dashed border-white/10 rounded-lg hover:border-cetiem-green/30 hover:bg-white/3 transition-all text-sm text-cetiem-gray/50">
                  <FolderOpen className="h-4 w-4 shrink-0" />
                  Seleccionar PDF...
                </button>
              )}
            </div>
          )}

          {/* Progreso */}
          {isBusy && (
            <div className="space-y-1">
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-cetiem-green rounded-full transition-all"
                  style={{ width: `${item.progreso}%` }} />
              </div>
              <p className="text-[10px] text-cetiem-gray/50">{item.progreso}%</p>
            </div>
          )}

          {/* Filename when done */}
          {isDone && item.file && (
            <p className="text-xs text-cetiem-gray/40">{item.file.name}</p>
          )}

          {/* Error */}
          {isErr && (
            <p className="text-xs text-cetiem-red">{item.errorMsg || "Error al subir"}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Drop zone global (drag & drop múltiple) ─────────────────────────────────
function GlobalDropZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [active, setActive] = useState(false);

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setActive(true); };
  const onDragLeave = () => setActive(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setActive(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type === "application/pdf");
    if (files.length > 0) onFiles(files);
  };

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "border-2 border-dashed rounded-2xl py-8 text-center transition-all",
        active ? "border-cetiem-green bg-cetiem-green/5" : "border-white/8 hover:border-white/15"
      )}
    >
      <Upload className={cn("h-8 w-8 mx-auto mb-2 transition-colors",
        active ? "text-cetiem-green" : "text-cetiem-gray/20"
      )} />
      <p className="text-sm text-cetiem-gray/50">
        {active ? "Suelta los PDFs aquí" : "Arrastra varios PDFs aquí para añadirlos de golpe"}
      </p>
      <p className="text-[11px] text-cetiem-gray/30 mt-1">Se crearán entradas automáticamente</p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function UploadPage() {
  const router = useRouter();
  const [cola, setCola] = useState<ItemCola[]>([emptyItem()]);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);

  // IDs de tipos ya en la cola (para deshabilitar duplicados en selector)
  const ocupados = new Set(cola.map(i => i.tipo?.id).filter(Boolean) as string[]);

  const updateItem = (uid: string, patch: Partial<ItemCola>) => {
    setCola(prev => prev.map(i => i.uid === uid ? { ...i, ...patch } : i));
  };

  const addItem = () => setCola(prev => [...prev, emptyItem()]);

  const removeItem = (uid: string) => setCola(prev => prev.filter(i => i.uid !== uid));

  // Añadir varios archivos de golpe (drag-drop global)
  const handleDropFiles = (files: File[]) => {
    setCola(prev => {
      const next = [...prev];
      // Si hay un slot vacío (sin tipo ni archivo), llenarlo primero
      let idx = next.findIndex(i => !i.tipo && !i.file);
      for (const f of files) {
        if (idx >= 0 && idx < next.length) {
          next[idx] = { ...next[idx], file: f };
          idx = next.findIndex((i, j) => j > idx && !i.tipo && !i.file);
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
            if (e.lengthComputable) {
              updateItem(item.uid, { progreso: Math.round((e.loaded / e.total) * 100) });
            }
          });
          xhr.onload = () => {
            if (xhr.status === 200) {
              updateItem(item.uid, { estado: "ok", progreso: 100 });
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
        // continue with next item even if this one failed
      }
    }

    setUploading(false);
    const errores = cola.filter(i => i.estado === "error").length;
    if (errores === 0) {
      setDone(true);
      setTimeout(() => router.push("/dashboard/documents"), 2000);
    }
  };

  if (done) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-4 p-8">
        <CheckCircle className="h-16 w-16 text-cetiem-lime" />
        <h2 className="font-heading font-bold text-2xl text-white">
          {colaOk} documento{colaOk !== 1 ? "s" : ""} subido{colaOk !== 1 ? "s" : ""}
        </h2>
        <p className="text-cetiem-gray text-sm">Redirigiendo a tus documentos...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/5">
        <div>
          <h1 className="font-heading font-bold text-2xl text-white">Subir Documentos</h1>
          <p className="text-cetiem-gray text-sm mt-0.5">
            Puedes subir varios documentos a la vez — {TOTAL_REQUERIDOS} tipos requeridos en total
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-cetiem-gray/40 font-medium">
          <Cpu className="h-3.5 w-3.5" />
          Análisis IA · NVIDIA NIM
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-3xl mx-auto space-y-4">

          {/* Drop zone global */}
          <GlobalDropZone onFiles={handleDropFiles} />

          {/* Cola de documentos */}
          <div className="space-y-2">
            {cola.map(item => (
              <ItemFila
                key={item.uid}
                item={item}
                onTipo={t => updateItem(item.uid, { tipo: t })}
                onFile={f => updateItem(item.uid, { file: f })}
                onNotas={n => updateItem(item.uid, { notas: n })}
                onRemove={() => removeItem(item.uid)}
                ocupados={ocupados}
              />
            ))}
          </div>

          {/* Añadir más */}
          {!uploading && (
            <button
              onClick={addItem}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-white/10 rounded-xl text-cetiem-gray/50 hover:text-white hover:border-cetiem-green/30 text-sm transition-all"
            >
              <Plus className="h-4 w-4" /> Añadir otro documento
            </button>
          )}

          {/* Barra de acción */}
          <div className="sticky bottom-0 pt-2 pb-1">
            <div className="bg-cetiem-card/95 backdrop-blur border border-white/10 rounded-2xl p-4 flex items-center gap-4">
              {/* Resumen */}
              <div className="flex items-center gap-3 flex-1 text-sm">
                <div className="flex items-center gap-1.5">
                  <ListChecks className="h-4 w-4 text-cetiem-gray/40" />
                  <span className="text-cetiem-gray">{colaTotal} en cola</span>
                </div>
                {colaValida.length > 0 && (
                  <span className="text-cetiem-green font-medium">
                    {colaValida.length} listo{colaValida.length !== 1 ? "s" : ""} para subir
                  </span>
                )}
                {colaOk > 0 && (
                  <span className="text-cetiem-lime font-medium flex items-center gap-1">
                    <CheckCircle className="h-3.5 w-3.5" /> {colaOk} subido{colaOk !== 1 ? "s" : ""}
                  </span>
                )}
                {colaErr > 0 && (
                  <span className="text-cetiem-red font-medium">{colaErr} error{colaErr !== 1 ? "es" : ""}</span>
                )}

                {/* Alertas */}
                {cola.some(i => i.tipo && !i.file && i.estado === "pendiente") && (
                  <span className="text-cetiem-amber/70 text-xs">
                    {cola.filter(i => i.tipo && !i.file && i.estado === "pendiente").length} sin archivo
                  </span>
                )}
                {cola.some(i => !i.tipo && i.file && i.estado === "pendiente") && (
                  <span className="text-cetiem-amber/70 text-xs">
                    {cola.filter(i => !i.tipo && i.file && i.estado === "pendiente").length} sin tipo
                  </span>
                )}
              </div>

              {/* Botón */}
              <button
                onClick={handleUploadAll}
                disabled={colaValida.length === 0 || uploading}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all shrink-0",
                  colaValida.length > 0 && !uploading
                    ? "bg-cetiem-green hover:bg-cetiem-green/90 text-white"
                    : "bg-white/5 text-cetiem-gray/40 cursor-not-allowed"
                )}
              >
                {uploading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Subiendo...</>
                ) : (
                  <><Upload className="h-4 w-4" />
                    Subir {colaValida.length > 0 ? colaValida.length : ""} documento{colaValida.length !== 1 ? "s" : ""}
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
