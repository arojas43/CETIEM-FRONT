"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, ChevronLeft, ChevronRight, FolderOpen } from "lucide-react";

interface Section {
  id: string;
  level: number;
  title: string;
  page?: number | null;
  content?: string | null;
  summary?: string | null;
  hasChildren?: boolean;
  childrenCount?: number;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
  hasPrev: boolean;
}

interface DocumentContent {
  document: {
    id: string;
    name: string;
    status: string;
    totalSections: number;
  };
  data: Section[];
  pagination: PaginationInfo;
}

export default function DocumentContentPage() {
  const params = useParams();
  const documentId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState<DocumentContent | null>(null);
  const [showFullText, setShowFullText] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const response = await fetch("/api/documents/" + documentId + "/content");
        if (response.ok) {
          const data = await response.json();
          setContent(data);
        }
      } catch (error) {
        console.error("Error fetching content:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, [documentId]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const downloadText = async () => {
    if (!content) return;
    
    try {
      const response = await fetch("/api/documents/" + documentId + "/content?limit=1000");
      const data = await response.json();
      
      const fullText = data.data
        .filter((s: Section) => s.content)
        .map((s: Section) => "## " + s.title + "\n\n" + s.content)
        .join("\n\n");
      
      const blob = new Blob([fullText], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = content.document.name.replace(".pdf", "") + "_texto.txt";
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading text:", error);
    }
  };

  const getTotalChars = () => {
    if (!content) return 0;
    return content.data.reduce((acc, s) => acc + (s.content?.length || 0), 0);
  };

  const getFullText = () => {
    if (!content) return "";
    return content.data
      .filter(s => s.content)
      .map(s => "## " + s.title + "\n\n" + s.content)
      .join("\n\n");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-blue-600 rounded-full border-t-transparent mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando contenido...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!content || !content.data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardHeader>
              <CardTitle>Error</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">No se pudo cargar el contenido del documento.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const sections = content.data;
  const pagination = content.pagination;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => window.history.back()}>
              ← Volver
            </Button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Contenido Extraído</h1>
              <p className="text-sm text-gray-500">{content.document.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFullText(!showFullText)}
            >
              <FileText className="h-4 w-4 mr-2" />
              {showFullText ? "Ver Secciones" : "Ver Todo"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadText}
            >
              <Download className="h-4 w-4 mr-2" />
              Descargar
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {showFullText ? (
          <Card>
            <CardHeader>
              <CardTitle>Texto Completo Extraído</CardTitle>
              <CardDescription>
                {getTotalChars().toLocaleString()} caracteres
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose max-w-none">
                <pre className="whitespace-pre-wrap text-sm font-mono bg-gray-50 p-6 rounded-lg max-h-[70vh] overflow-y-auto">
                  {getFullText()}
                </pre>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {sections.length === 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Sin contenido</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">
                    Este documento aún no tiene contenido extraído. 
                    El documento está en estado: <strong>{content.document.status}</strong>
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="space-y-4">
                  {sections.map((section) => (
                    <Card key={section.id}>
                      <CardHeader>
                        <div
                          className="flex items-center gap-2 cursor-pointer"
                          onClick={() => toggleSection(section.id)}
                        >
                          {section.level === 0 ? (
                            <FolderOpen className="h-5 w-5 text-blue-600" />
                          ) : (
                            <ChevronRight 
                              className={
                                "h-4 w-4 text-gray-400 transition-transform " + 
                                (expandedSections.has(section.id) ? "rotate-90" : "")
                              } 
                            />
                          )}
                          <div className="flex-1">
                            <CardTitle className="text-lg">{section.title}</CardTitle>
                            {section.page && (
                              <CardDescription>
                                Página {section.page} • Nivel {section.level}
                              </CardDescription>
                            )}
                          </div>
                          {section.content && (
                            <span className="text-xs text-gray-500">
                              {section.content.length.toLocaleString()} chars
                            </span>
                          )}
                        </div>
                      </CardHeader>
                      {expandedSections.has(section.id) && section.content && (
                        <CardContent>
                          <div className="prose max-w-none">
                            <pre className="whitespace-pre-wrap text-sm font-mono bg-gray-50 p-4 rounded-lg">
                              {section.content}
                            </pre>
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>

                {pagination.totalPages > 1 && (
                  <Card className="mt-4">
                    <CardContent className="flex items-center justify-between py-4">
                      <p className="text-sm text-gray-500">
                        Mostrando {sections.length} de {pagination.total} secciones
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            if (pagination.hasPrev) {
                              setLoading(true);
                              const response = await fetch(
                                "/api/documents/" + documentId + "/content?page=" + (pagination.page - 1)
                              );
                              const data = await response.json();
                              setContent(data);
                              setLoading(false);
                            }
                          }}
                          disabled={!pagination.hasPrev}
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Anterior
                        </Button>
                        
                        <span className="text-sm text-gray-600">
                          Página {pagination.page} de {pagination.totalPages}
                        </span>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            if (pagination.hasMore) {
                              setLoading(true);
                              const response = await fetch(
                                "/api/documents/" + documentId + "/content?page=" + (pagination.page + 1)
                              );
                              const data = await response.json();
                              setContent(data);
                              setLoading(false);
                            }
                          }}
                          disabled={!pagination.hasMore}
                        >
                          Siguiente
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        )}

        {/* Stats */}
        <Card className="mt-8 bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-lg">Estadísticas de Extracción</CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">Total Caracteres</p>
              <p className="text-2xl font-bold text-blue-900">
                {getTotalChars().toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Secciones (página)</p>
              <p className="text-2xl font-bold text-blue-900">
                {sections.length}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Secciones</p>
              <p className="text-2xl font-bold text-blue-900">
                {content.document.totalSections}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Estado</p>
              <p className="text-2xl font-bold text-blue-900">
                {content.document.status}
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
