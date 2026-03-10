import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { FileText, Brain, MessageSquare, Network, ChevronRight, ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ProcessDocumentButton from "./process-button";

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user) {
    redirect("/auth/signin");
  }

  // Obtener documento
  const document = await prisma.document.findUnique({
    where: { id },
    include: {
      pageIndices: {
        orderBy: { level: "asc" },
        take: 10,
      },
    },
  });

  if (!document) {
    redirect("/dashboard/documents");
  }

  if (document.userId !== session.user.id) {
    redirect("/dashboard/documents");
  }

  // Contar secciones totales
  const totalSections = await prisma.pageIndex.count({
    where: { documentId: id },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/documents">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver
              </Button>
            </Link>
            <div className="h-10 w-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{document.name}</h1>
              <p className="text-sm text-gray-500">
                {document.status} • {totalSections} secciones
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Action Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          {/* Botón de Procesar */}
          <ProcessDocumentButton
            documentId={id}
            currentDomain={document.domain || "LEGAL"}
            currentStatus={document.status}
          />

          {/* Q&A */}
          <Link href={`/dashboard/documents/${id}/qa`}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full border-indigo-200">
              <CardHeader>
                <div className="h-12 w-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-3">
                  <MessageSquare className="h-6 w-6 text-indigo-600" />
                </div>
                <CardTitle>Preguntar al Documento</CardTitle>
                <CardDescription>
                  Haz preguntas específicas sobre el contenido
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-indigo-600 hover:bg-indigo-700">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Iniciar Q&A
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </Link>

          {/* Contenido */}
          <Link href={`/dashboard/documents/${id}/content`}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardHeader>
                <div className="h-12 w-12 bg-blue-100 rounded-xl flex items-center justify-center mb-3">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle>Ver Contenido</CardTitle>
                <CardDescription>
                  Explora el texto extraído y secciones
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  <FileText className="mr-2 h-4 w-4" />
                  Ver Texto
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </Link>

          {/* Grafo */}
          <Link href={`/dashboard/documents/${id}/graph`}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardHeader>
                <div className="h-12 w-12 bg-purple-100 rounded-xl flex items-center justify-center mb-3">
                  <Network className="h-6 w-6 text-purple-600" />
                </div>
                <CardTitle>Grafo de Conocimiento</CardTitle>
                <CardDescription>
                  Entidades y relaciones extraídas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  <Brain className="mr-2 h-4 w-4" />
                  Ver Grafo
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Document Info */}
        <Card>
          <CardHeader>
            <CardTitle>Información del Documento</CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Nombre</p>
              <p className="font-medium">{document.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Estado</p>
              <p className="font-medium">
                <span className={
                  document.status === "ANALYZED" ? "text-green-600" :
                  document.status === "INDEXED" ? "text-blue-600" :
                  document.status === "FAILED" ? "text-red-600" :
                  "text-yellow-600"
                }>
                  {document.status}
                </span>
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Tamaño</p>
              <p className="font-medium">{(document.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Fecha de subida</p>
              <p className="font-medium">{new Date(document.createdAt).toLocaleDateString('es-ES')}</p>
            </div>
            {document.description && (
              <div className="md:col-span-2">
                <p className="text-sm text-gray-500">Descripción</p>
                <p className="font-medium text-sm">{document.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Secciones Preview */}
        {document.pageIndices.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Vista Previa de Secciones</CardTitle>
              <CardDescription>
                Primeras {document.pageIndices.length} secciones de {totalSections}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {document.pageIndices.map((index) => (
                  <div
                    key={index.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="h-8 w-8 bg-blue-100 rounded flex items-center justify-center">
                      <span className="text-xs font-bold text-blue-600">{index.level}</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{index.title}</p>
                      {index.page && (
                        <p className="text-xs text-gray-500">Página {index.page}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info Box */}
        <Card className="mt-6 bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Brain className="h-5 w-5 text-blue-600" />
              Integración PageIndex + Cognee + FalkorDB
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-700 space-y-2">
            <p>
              <strong>PageIndex:</strong> Extrajo la estructura jerárquica del documento ({totalSections} secciones)
            </p>
            <p>
              <strong>Cognee:</strong> Extrae entidades y relaciones del texto médico
            </p>
            <p>
              <strong>FalkorDB:</strong> Almacena el grafo de conocimiento de forma aislada por documento
            </p>
            <p className="mt-4 text-gray-600">
              Usa la función <strong>&quot;Preguntar al Documento&quot;</strong> para hacer preguntas específicas sobre el contenido.
              La IA buscará en el grafo de conocimiento y el texto extraído para responderte con contexto.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
