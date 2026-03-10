"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    accept: {
      "application/pdf": [".pdf"],
    },
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
          const progress = (event.loaded / event.total) * 100;
          setUploadProgress(progress);
        }
      });

      xhr.onload = () => {
        if (xhr.status === 200) {
          setUploadProgress(100);
          setUploadStatus("success");
          setTimeout(() => {
            router.push("/dashboard");
          }, 2000);
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
    } catch (error) {
      console.error("Upload error:", error);
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => router.back()}>
              ← Volver
            </Button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Subir Documento</h1>
              <p className="text-sm text-gray-500">Análisis con IA para certificaciones</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-8 flex items-start gap-3">
          <Brain className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">
              Procesamiento Inteligente de Documentos
            </h3>
            <p className="text-sm text-blue-700">
              Tu documento será analizado automáticamente con <strong>PageIndex</strong> para extraer 
              la estructura jerárquica y con <strong>Cognee + FalkorDB</strong> para identificar 
              entidades, normas y requisitos.
            </p>
          </div>
        </div>

        {/* Upload Area */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Seleccionar Archivo PDF
            </CardTitle>
            <CardDescription>
              Arrastra un archivo o haz clic para seleccionar
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!file ? (
              <div
                {...getRootProps()}
                className={cn(
                  "border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all",
                  isDragActive
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-blue-400 hover:bg-gray-50"
                )}
              >
                <input {...getInputProps()} />
                <Upload className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                {isDragActive ? (
                  <div>
                    <p className="text-lg text-blue-600 font-medium">
                      📄 Suelta el archivo aquí...
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-lg text-gray-700 mb-2">
                      Arrastra un archivo PDF o haz clic para seleccionar
                    </p>
                    <p className="text-sm text-gray-500">
                      Máximo 50MB • Solo archivos PDF
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="border rounded-xl p-6 bg-gray-50">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="h-12 w-12 bg-red-100 rounded-lg flex items-center justify-center">
                      <FileText className="h-6 w-6 text-red-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{file.name}</p>
                      <p className="text-sm text-gray-500">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  {!uploading && (
                    <Button variant="ghost" size="icon" onClick={removeFile}>
                      <X className="h-5 w-5" />
                    </Button>
                  )}
                </div>

                {uploading && (
                  <div className="space-y-3">
                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full transition-all duration-300",
                          uploadStatus === "success" ? "bg-green-500" : "bg-blue-600"
                        )}
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">
                        {uploadStatus === "uploading" && "Subiendo archivo..."}
                        {uploadStatus === "success" && "¡Archivo subido exitosamente!"}
                      </span>
                      <span className="font-medium">{Math.round(uploadProgress)}%</span>
                    </div>
                  </div>
                )}

                {uploadStatus === "success" && (
                  <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-lg">
                    <CheckCircle className="h-5 w-5" />
                    <p className="text-sm font-medium">
                      Documento subido. Redirigiendo al dashboard...
                    </p>
                  </div>
                )}

                {uploadStatus === "error" && (
                  <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
                    <AlertCircle className="h-5 w-5" />
                    <p className="text-sm font-medium">{errorMessage}</p>
                  </div>
                )}
              </div>
            )}

            {/* Description Input */}
            {file && !uploading && (
              <div className="mt-6 space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Descripción (opcional)
                </label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ej: Manual de procedimientos ISO 9001..."
                />
              </div>
            )}

            {/* Upload Button */}
            {file && !uploading && uploadStatus !== "success" && (
              <Button
                className="w-full mt-6 bg-blue-600 hover:bg-blue-700"
                size="lg"
                onClick={handleUpload}
                disabled={uploading}
              >
                <Upload className="mr-2 h-4 w-4" />
                {uploading ? "Subiendo..." : "Subir Documento para Análisis"}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Process Steps */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-4">
              <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <CardTitle className="text-lg">1. Extracción de Texto</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                El sistema extrae todo el texto del PDF página por página, 
                manteniendo el formato original.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <div className="h-10 w-10 bg-indigo-100 rounded-lg flex items-center justify-center mb-3">
                <Brain className="h-5 w-5 text-indigo-600" />
              </div>
              <CardTitle className="text-lg">2. PageIndex Analiza</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                La IA detecta la estructura jerárquica: capítulos, secciones, 
                subsections. Crea un índice navegable.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center mb-3">
                <Database className="h-5 w-5 text-purple-600" />
              </div>
              <CardTitle className="text-lg">3. Cognee + FalkorDB</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Extrae entidades (normas, requisitos, empresas) y construye 
                un grafo de conocimiento interconectado.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Example Use Cases */}
        <Card className="mt-8 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-blue-600" />
              Casos de Uso Comunes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <div className="h-2 w-2 bg-blue-600 rounded-full mt-2" />
                <div>
                  <p className="font-medium text-gray-900">Normas ISO</p>
                  <p className="text-sm text-gray-600">ISO 9001, ISO 14001, ISO 45001</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-2 w-2 bg-blue-600 rounded-full mt-2" />
                <div>
                  <p className="font-medium text-gray-900">Manuales de Procedimientos</p>
                  <p className="text-sm text-gray-600">Documentación interna de procesos</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-2 w-2 bg-blue-600 rounded-full mt-2" />
                <div>
                  <p className="font-medium text-gray-900">Regulaciones</p>
                  <p className="text-sm text-gray-600">Normativas legales y compliance</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-2 w-2 bg-blue-600 rounded-full mt-2" />
                <div>
                  <p className="font-medium text-gray-900">Políticas Corporativas</p>
                  <p className="text-sm text-gray-600">Gobierno empresarial y lineamientos</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
