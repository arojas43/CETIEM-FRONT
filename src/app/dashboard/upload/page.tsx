"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, FileText, X, CheckCircle, AlertCircle, Brain, Database } from "lucide-react";
import { cn } from "@/lib/utils";

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

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
  });

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
    setUploadStatus("uploading");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("description", description);

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
          setTimeout(() => router.push("/dashboard"), 2000);
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

  const removeFile = () => {
    setFile(null);
    setUploadProgress(0);
    setUploadStatus("idle");
    setErrorMessage("");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/5">
        <div>
          <h1 className="font-heading font-bold text-2xl text-white">Subir Documento</h1>
          <p className="text-cetiem-gray text-sm mt-0.5">Análisis con IA para certificaciones ESG</p>
        </div>
      </div>

      <div className="flex-1 p-8 overflow-auto max-w-4xl">
        {/* Info banner */}
        <div className="bg-cetiem-green/10 border border-cetiem-green/20 rounded-xl p-4 mb-6 flex items-start gap-3">
          <Brain className="h-5 w-5 text-cetiem-green mt-0.5 shrink-0" />
          <div>
            <h3 className="font-semibold text-cetiem-green text-sm mb-1">
              Procesamiento Inteligente de Documentos
            </h3>
            <p className="text-cetiem-gray text-sm">
              Tu documento será analizado con <strong className="text-white">PageIndex</strong> para extraer
              la estructura jerárquica y con <strong className="text-white">Cognee + FalkorDB</strong> para identificar
              entidades, normas y requisitos.
            </p>
          </div>
        </div>

        {/* Upload area */}
        <div className="bg-cetiem-card border border-white/5 rounded-2xl p-6 mb-6">
          <h2 className="font-heading font-semibold text-white mb-1 flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Seleccionar Archivo PDF
          </h2>
          <p className="text-cetiem-gray text-sm mb-5">Arrastra un archivo o haz clic para seleccionar</p>

          {!file ? (
            <div
              {...getRootProps()}
              className={cn(
                "border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all",
                isDragActive
                  ? "border-cetiem-green bg-cetiem-green/5"
                  : "border-white/10 hover:border-cetiem-green/40 hover:bg-white/5"
              )}
            >
              <input {...getInputProps()} />
              <Upload className="h-14 w-14 mx-auto mb-4 text-cetiem-gray/40" />
              {isDragActive ? (
                <p className="text-cetiem-green font-medium">Suelta el archivo aquí...</p>
              ) : (
                <>
                  <p className="text-white mb-2">Arrastra un archivo PDF o haz clic para seleccionar</p>
                  <p className="text-sm text-cetiem-gray">Máximo 50MB · Solo archivos PDF</p>
                </>
              )}
            </div>
          ) : (
            <div className="border border-white/10 rounded-xl p-5 bg-white/5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3 flex-1">
                  <div className="h-10 w-10 bg-cetiem-red/10 rounded-lg flex items-center justify-center">
                    <FileText className="h-5 w-5 text-cetiem-red" />
                  </div>
                  <div>
                    <p className="font-medium text-white">{file.name}</p>
                    <p className="text-sm text-cetiem-gray">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                {!uploading && (
                  <button onClick={removeFile} className="text-cetiem-gray hover:text-white transition-colors">
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>

              {uploading && (
                <div className="space-y-2">
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full transition-all duration-300 rounded-full",
                        uploadStatus === "success" ? "bg-cetiem-lime" : "bg-cetiem-green"
                      )}
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-cetiem-gray">
                      {uploadStatus === "uploading" && "Subiendo archivo..."}
                      {uploadStatus === "success" && "¡Archivo subido exitosamente!"}
                    </span>
                    <span className="text-white font-medium">{Math.round(uploadProgress)}%</span>
                  </div>
                </div>
              )}

              {uploadStatus === "success" && (
                <div className="flex items-center gap-2 text-cetiem-lime bg-cetiem-lime/10 border border-cetiem-lime/20 p-3 rounded-lg">
                  <CheckCircle className="h-4 w-4" />
                  <p className="text-sm font-medium">Documento subido. Redirigiendo al dashboard...</p>
                </div>
              )}

              {uploadStatus === "error" && (
                <div className="flex items-center gap-2 text-cetiem-red bg-cetiem-red/10 border border-cetiem-red/20 p-3 rounded-lg">
                  <AlertCircle className="h-4 w-4" />
                  <p className="text-sm font-medium">{errorMessage}</p>
                </div>
              )}
            </div>
          )}

          {file && !uploading && (
            <div className="mt-5 space-y-2">
              <label className="text-sm font-medium text-cetiem-gray">Descripción (opcional)</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ej: Manual de procedimientos ISO 9001..."
                className="bg-white/5 border-white/10 text-white placeholder:text-cetiem-gray/40"
              />
            </div>
          )}

          {file && !uploading && uploadStatus !== "success" && (
            <button
              className="w-full mt-5 bg-cetiem-green hover:bg-cetiem-green/90 text-white font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
              onClick={handleUpload}
              disabled={uploading}
            >
              <Upload className="h-4 w-4" />
              Subir Documento para Análisis
            </button>
          )}
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          {[
            { icon: FileText, color: "cetiem-green", title: "1. Extracción de Texto", desc: "El sistema extrae todo el texto del PDF página por página, manteniendo el formato original." },
            { icon: Brain, color: "cetiem-teal", title: "2. PageIndex Analiza", desc: "La IA detecta la estructura jerárquica: capítulos, secciones, subsecciones. Crea un índice navegable." },
            { icon: Database, color: "cetiem-lime", title: "3. Cognee + FalkorDB", desc: "Extrae entidades (normas, requisitos, empresas) y construye un grafo de conocimiento interconectado." },
          ].map(step => {
            const Icon = step.icon;
            return (
              <div key={step.title} className="bg-cetiem-card border border-white/5 rounded-xl p-4">
                <div className={`h-9 w-9 bg-${step.color}/10 rounded-lg flex items-center justify-center mb-3`}>
                  <Icon className={`h-4 w-4 text-${step.color}`} />
                </div>
                <h3 className="font-heading font-semibold text-sm text-white mb-2">{step.title}</h3>
                <p className="text-cetiem-gray text-xs leading-relaxed">{step.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Use cases */}
        <div className="bg-cetiem-card border border-white/5 rounded-xl p-5">
          <h3 className="font-heading font-semibold text-sm text-white mb-4 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-cetiem-green" />
            Casos de Uso Comunes
          </h3>
          <div className="grid md:grid-cols-2 gap-3">
            {[
              ["Normas ISO", "ISO 9001, ISO 14001, ISO 45001"],
              ["Manuales de Procedimientos", "Documentación interna de procesos"],
              ["Regulaciones", "Normativas legales y compliance"],
              ["Políticas Corporativas", "Gobierno empresarial y lineamientos"],
            ].map(([title, desc]) => (
              <div key={title} className="flex items-start gap-2">
                <div className="h-1.5 w-1.5 bg-cetiem-green rounded-full mt-2 shrink-0" />
                <div>
                  <p className="font-medium text-white text-sm">{title}</p>
                  <p className="text-xs text-cetiem-gray">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
