"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Upload, FileText, X, CheckCircle, AlertCircle, Search,
  ChevronDown, ChevronRight, Info, Cpu,
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

// Agrupado por categoría para el selector
const POR_CATEGORIA = ORDEN_CATEGORIAS.reduce<Record<CategoriaDocumento, TipoDocumento[]>>(
  (acc, cat) => {
    acc[cat] = CATALOGO_DOCUMENTOS.filter(d => d.categoria === cat);
    return acc;
  },
  {} as any
);

export default function UploadPage() {
  const router = useRouter();

  // Paso 1: selección de tipo
  const [tipoSeleccionado, setTipoSeleccionado] = useState<TipoDocumento | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [categoriasAbiertas, setCategoriasAbiertas] = useState<Set<CategoriaDocumento>>(
    new Set(["GOBERNANZA"])
  );

  // Paso 2: archivo
  const [file, setFile] = useState<File | null>(null);
  const [notas, setNotas] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const filtrados = busqueda.trim()
    ? CATALOGO_DOCUMENTOS.filter(d =>
        d.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        d.descripcion.toLowerCase().includes(busqueda.toLowerCase())
      )
    : null;

  const toggleCategoria = (cat: CategoriaDocumento) => {
    setCategoriasAbiertas(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    if (rejectedFiles.length > 0) {
      setErrorMessage("Solo se permiten archivos PDF");
      return;
    }
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setErrorMessage("");
      setUploadStatus("idle");
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    disabled: !tipoSeleccionado,
  });

  const handleUpload = async () => {
    if (!file || !tipoSeleccionado) return;
    setUploading(true);
    setUploadProgress(0);
    setUploadStatus("uploading");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("description", notas);
      formData.append("tipoDocumento", tipoSeleccionado.id);
      formData.append("categoriaDoc", tipoSeleccionado.categoria);

      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          setUploadProgress((event.loaded / event.total) * 100);
        }
      });

      xhr.onload = () => {
        if (xhr.status === 200) {
          setUploadProgress(100);
          setUploadStatus("success");
          setTimeout(() => router.push("/dashboard/documents"), 2000);
        } else {
          setUploadStatus("error");
          setErrorMessage("Error al subir el documento");
          setUploading(false);
        }
      };

      xhr.onerror = () => {
        setUploadStatus("error");
        setErrorMessage("Error de conexión");
        setUploading(false);
      };

      xhr.open("POST", "/api/documents");
      xhr.send(formData);
    } catch {
      setUploadStatus("error");
      setErrorMessage("Error al subir el documento");
      setUploading(false);
    }
  };

  const resetTodo = () => {
    setFile(null);
    setNotas("");
    setUploadProgress(0);
    setUploadStatus("idle");
    setErrorMessage("");
  };

  const cancelarTipo = () => {
    setTipoSeleccionado(null);
    resetTodo();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/5">
        <div>
          <h1 className="font-heading font-bold text-2xl text-white">Subir Documento</h1>
          <p className="text-cetiem-gray text-sm mt-0.5">
            {TOTAL_REQUERIDOS} documentos requeridos para la certificación ESG
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="p-8 max-w-5xl">

          {/* Steps indicator */}
          <div className="flex items-center gap-3 mb-8">
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
              !tipoSeleccionado
                ? "bg-cetiem-green text-white"
                : "bg-cetiem-green/10 text-cetiem-green"
            )}>
              <span className="h-5 w-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">1</span>
              Tipo de documento
              {tipoSeleccionado && <CheckCircle className="h-3.5 w-3.5" />}
            </div>
            <ChevronRight className="h-4 w-4 text-cetiem-gray/30" />
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
              tipoSeleccionado && !file
                ? "bg-cetiem-teal text-white"
                : tipoSeleccionado && file
                  ? "bg-cetiem-teal/10 text-cetiem-teal"
                  : "bg-white/5 text-cetiem-gray"
            )}>
              <span className="h-5 w-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">2</span>
              Archivo PDF
              {file && <CheckCircle className="h-3.5 w-3.5" />}
            </div>
            <ChevronRight className="h-4 w-4 text-cetiem-gray/30" />
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium",
              tipoSeleccionado && file
                ? "bg-white/10 text-white"
                : "bg-white/5 text-cetiem-gray"
            )}>
              <span className="h-5 w-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">3</span>
              Confirmar
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">

            {/* ─── PASO 1: Selector de tipo ──────────────────────────────── */}
            <div className="bg-cetiem-card border border-white/5 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-heading font-semibold text-white flex items-center gap-2">
                  <span className="h-6 w-6 rounded-full bg-cetiem-green/20 text-cetiem-green flex items-center justify-center text-xs font-bold">1</span>
                  ¿Qué documento es?
                </h2>
                {tipoSeleccionado && (
                  <button onClick={cancelarTipo} className="text-xs text-cetiem-gray hover:text-white flex items-center gap-1">
                    <X className="h-3 w-3" /> Cambiar
                  </button>
                )}
              </div>

              {tipoSeleccionado ? (
                /* Tipo ya seleccionado */
                <div className="bg-white/5 border border-cetiem-green/20 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "px-2 py-0.5 rounded text-xs font-medium shrink-0 mt-0.5",
                      CATEGORIAS[tipoSeleccionado.categoria].bgColor,
                      CATEGORIAS[tipoSeleccionado.categoria].color,
                    )}>
                      {CATEGORIAS[tipoSeleccionado.categoria].label}
                    </div>
                    <div>
                      <p className="font-medium text-white text-sm">{tipoSeleccionado.nombre}</p>
                      <p className="text-xs text-cetiem-gray mt-1 leading-relaxed">{tipoSeleccionado.descripcion}</p>
                      {tipoSeleccionado.obligatorio && (
                        <span className="inline-flex items-center gap-1 mt-2 text-xs text-cetiem-amber">
                          <Info className="h-3 w-3" /> Documento obligatorio
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Buscador + lista */
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-cetiem-gray/50" />
                    <input
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                      placeholder="Buscar tipo de documento..."
                      className="w-full h-9 pl-9 pr-3 text-sm bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-cetiem-gray/40 focus:outline-none focus:border-cetiem-green/40"
                    />
                  </div>

                  <div className="max-h-[420px] overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                    {filtrados ? (
                      /* Resultados de búsqueda */
                      filtrados.length > 0 ? (
                        filtrados.map(doc => (
                          <button
                            key={doc.id}
                            onClick={() => { setTipoSeleccionado(doc); setBusqueda(""); }}
                            className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/10 transition-all group"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className={cn(
                                "px-1.5 py-0.5 rounded text-[10px] font-medium",
                                CATEGORIAS[doc.categoria].bgColor,
                                CATEGORIAS[doc.categoria].color,
                              )}>
                                {CATEGORIAS[doc.categoria].label}
                              </span>
                              {doc.obligatorio && (
                                <span className="text-[10px] text-cetiem-amber">Obligatorio</span>
                              )}
                            </div>
                            <p className="text-sm text-white group-hover:text-cetiem-green transition-colors">{doc.nombre}</p>
                          </button>
                        ))
                      ) : (
                        <p className="text-center text-cetiem-gray text-sm py-4">Sin resultados</p>
                      )
                    ) : (
                      /* Lista agrupada por categoría */
                      ORDEN_CATEGORIAS.filter(cat => cat !== "OTRO").map(cat => (
                        <div key={cat}>
                          <button
                            onClick={() => toggleCategoria(cat)}
                            className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "h-2 w-2 rounded-full",
                                CATEGORIAS[cat].bgColor.replace("/10", ""),
                              )} />
                              <span className={cn("text-xs font-semibold uppercase tracking-wider", CATEGORIAS[cat].color)}>
                                {CATEGORIAS[cat].label}
                              </span>
                              <span className="text-[10px] text-cetiem-gray">
                                ({POR_CATEGORIA[cat]?.length || 0})
                              </span>
                            </div>
                            {categoriasAbiertas.has(cat)
                              ? <ChevronDown className="h-3.5 w-3.5 text-cetiem-gray/50" />
                              : <ChevronRight className="h-3.5 w-3.5 text-cetiem-gray/50" />
                            }
                          </button>

                          {categoriasAbiertas.has(cat) && (
                            <div className="ml-2 border-l border-white/5 pl-2 mb-1">
                              {POR_CATEGORIA[cat]?.map(doc => (
                                <button
                                  key={doc.id}
                                  onClick={() => setTipoSeleccionado(doc)}
                                  className="w-full text-left px-2 py-2 rounded-lg hover:bg-white/5 transition-colors group flex items-start gap-2"
                                >
                                  <div className="h-1.5 w-1.5 rounded-full bg-white/20 mt-1.5 shrink-0 group-hover:bg-cetiem-green transition-colors" />
                                  <div>
                                    <span className="text-sm text-cetiem-gray group-hover:text-white transition-colors">
                                      {doc.nombre}
                                    </span>
                                    {doc.obligatorio && (
                                      <span className="ml-2 text-[10px] text-cetiem-amber/60">*</span>
                                    )}
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  <p className="text-[10px] text-cetiem-gray/50 text-center">
                    * Obligatorio · {TOTAL_REQUERIDOS} tipos en total
                  </p>
                </div>
              )}
            </div>

            {/* ─── PASO 2 y 3: Archivo + confirmación ──────────────────── */}
            <div className="space-y-4">
              <div className={cn(
                "bg-cetiem-card border rounded-2xl p-5 transition-all",
                tipoSeleccionado ? "border-white/5" : "border-white/5 opacity-50 pointer-events-none"
              )}>
                <h2 className="font-heading font-semibold text-white flex items-center gap-2 mb-4">
                  <span className="h-6 w-6 rounded-full bg-cetiem-teal/20 text-cetiem-teal flex items-center justify-center text-xs font-bold">2</span>
                  Archivo PDF
                </h2>

                {!file ? (
                  <div
                    {...getRootProps()}
                    className={cn(
                      "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
                      isDragActive
                        ? "border-cetiem-green bg-cetiem-green/5"
                        : "border-white/10 hover:border-cetiem-green/40 hover:bg-white/5"
                    )}
                  >
                    <input {...getInputProps()} />
                    <Upload className="h-10 w-10 mx-auto mb-3 text-cetiem-gray/30" />
                    {isDragActive ? (
                      <p className="text-cetiem-green font-medium text-sm">Suelta el archivo aquí...</p>
                    ) : (
                      <>
                        <p className="text-white text-sm mb-1">Arrastra un PDF o haz clic</p>
                        <p className="text-xs text-cetiem-gray">Máximo 50MB · Solo PDF</p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="border border-white/10 rounded-xl p-4 bg-white/5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 bg-cetiem-red/10 rounded-lg flex items-center justify-center">
                          <FileText className="h-4 w-4 text-cetiem-red" />
                        </div>
                        <div>
                          <p className="font-medium text-white text-sm">{file.name}</p>
                          <p className="text-xs text-cetiem-gray">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      </div>
                      {!uploading && (
                        <button onClick={resetTodo} className="text-cetiem-gray hover:text-white transition-colors">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    {uploading && (
                      <div className="space-y-2 mt-2">
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full transition-all duration-300 rounded-full",
                              uploadStatus === "success" ? "bg-cetiem-lime" : "bg-cetiem-green"
                            )}
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-cetiem-gray">
                          <span>{uploadStatus === "success" ? "¡Subido!" : "Subiendo..."}</span>
                          <span>{Math.round(uploadProgress)}%</span>
                        </div>
                      </div>
                    )}

                    {uploadStatus === "success" && (
                      <div className="flex items-center gap-2 text-cetiem-lime bg-cetiem-lime/10 border border-cetiem-lime/20 p-2.5 rounded-lg mt-2">
                        <CheckCircle className="h-4 w-4" />
                        <p className="text-xs font-medium">Documento subido. Redirigiendo...</p>
                      </div>
                    )}

                    {uploadStatus === "error" && (
                      <div className="flex items-center gap-2 text-cetiem-red bg-cetiem-red/10 border border-cetiem-red/20 p-2.5 rounded-lg mt-2">
                        <AlertCircle className="h-4 w-4" />
                        <p className="text-xs font-medium">{errorMessage}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* NVIDIA NIM badge */}
          {!tipoSeleccionado && (
            <div className="flex items-center gap-2 px-3 py-2 bg-white/3 border border-white/5 rounded-xl">
              <Cpu className="h-3.5 w-3.5 text-cetiem-green shrink-0" />
              <p className="text-cetiem-gray text-xs">
                Los documentos son analizados automáticamente con <strong className="text-white">IA impulsada por NVIDIA NIM</strong>. El contenido es revisado por un Assessor ESG certificado.
              </p>
            </div>
          )}

          {/* Notas opcionales */}
              {file && !uploading && (
                <div className="bg-cetiem-card border border-white/5 rounded-2xl p-5">
                  <h2 className="font-heading font-semibold text-white flex items-center gap-2 mb-3">
                    <span className="h-6 w-6 rounded-full bg-white/10 text-cetiem-gray flex items-center justify-center text-xs font-bold">3</span>
                    Notas adicionales
                    <span className="text-xs text-cetiem-gray font-normal">(opcional)</span>
                  </h2>
                  <Input
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    placeholder="Ej: Versión actualizada a enero 2025, incluye anexo A..."
                    className="bg-white/5 border-white/10 text-white placeholder:text-cetiem-gray/40"
                  />
                </div>
              )}

              {/* Botón subir */}
              {tipoSeleccionado && file && !uploading && uploadStatus !== "success" && (
                <div className="bg-cetiem-card border border-white/5 rounded-2xl p-5">
                  <div className="mb-4 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-cetiem-gray">Tipo:</span>
                      <span className="text-white font-medium">{tipoSeleccionado.nombre}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-cetiem-gray">Categoría:</span>
                      <span className={CATEGORIAS[tipoSeleccionado.categoria].color}>
                        {CATEGORIAS[tipoSeleccionado.categoria].label}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-cetiem-gray">Archivo:</span>
                      <span className="text-white">{file.name}</span>
                    </div>
                  </div>
                  <button
                    onClick={handleUpload}
                    className="w-full bg-cetiem-green hover:bg-cetiem-green/90 text-white font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Subir Documento
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
