"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { FileText, Download, ChevronLeft, ChevronRight, FolderOpen } from "lucide-react";

interface Section { id: string; level: number; title: string; page?: number | null; content?: string | null; summary?: string | null }
interface PaginationInfo { page: number; limit: number; total: number; totalPages: number; hasMore: boolean; hasPrev: boolean }
interface DocumentContent {
  document: { id: string; name: string; status: string; totalSections: number };
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
    fetch("/api/documents/" + documentId + "/content")
      .then(r => r.ok ? r.json() : null)
      .then(data => data && setContent(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [documentId]);

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const downloadText = async () => {
    if (!content) return;
    const response = await fetch("/api/documents/" + documentId + "/content?limit=1000");
    const data = await response.json();
    const fullText = data.data.filter((s: Section) => s.content).map((s: Section) => "## " + s.title + "\n\n" + s.content).join("\n\n");
    const blob = new Blob([fullText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = content.document.name.replace(".pdf", "") + "_texto.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const getTotalChars = () => content?.data.reduce((acc, s) => acc + (s.content?.length || 0), 0) ?? 0;
  const getFullText = () => content?.data.filter(s => s.content).map(s => "## " + s.title + "\n\n" + s.content).join("\n\n") ?? "";

  const fetchPage = async (page: number) => {
    setLoading(true);
    const response = await fetch("/api/documents/" + documentId + "/content?page=" + page);
    const data = await response.json();
    setContent(data);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-8 py-5 border-b border-white/5">
          <h1 className="font-heading font-bold text-2xl text-white">Contenido Extraído</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-2 border-cetiem-green rounded-full border-t-transparent mx-auto mb-4" />
            <p className="text-cetiem-gray text-sm">Cargando contenido...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!content?.data) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-8 py-5 border-b border-white/5">
          <h1 className="font-heading font-bold text-2xl text-white">Contenido Extraído</h1>
        </div>
        <div className="p-8">
          <div className="bg-cetiem-card border border-white/5 rounded-2xl p-6">
            <p className="text-cetiem-gray">No se pudo cargar el contenido del documento.</p>
          </div>
        </div>
      </div>
    );
  }

  const sections = content.data;
  const pagination = content.pagination;

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/5">
        <div>
          <h1 className="font-heading font-bold text-2xl text-white">Contenido Extraído</h1>
          <p className="text-cetiem-gray text-sm mt-0.5 truncate max-w-md">{content.document.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowFullText(!showFullText)}
            className="flex items-center gap-2 text-xs border border-white/10 hover:border-cetiem-green/40 text-cetiem-gray hover:text-white px-3 py-1.5 rounded-lg transition-colors">
            <FileText className="h-3.5 w-3.5" />
            {showFullText ? "Ver Secciones" : "Ver Todo"}
          </button>
          <button onClick={downloadText}
            className="flex items-center gap-2 text-xs border border-white/10 hover:border-cetiem-green/40 text-cetiem-gray hover:text-white px-3 py-1.5 rounded-lg transition-colors">
            <Download className="h-3.5 w-3.5" /> Descargar
          </button>
        </div>
      </div>

      <div className="flex-1 p-8 overflow-auto">
        {showFullText ? (
          <div className="bg-cetiem-card border border-white/5 rounded-2xl p-6">
            <h2 className="font-heading font-semibold text-white mb-1">Texto Completo Extraído</h2>
            <p className="text-cetiem-gray text-xs mb-4">{getTotalChars().toLocaleString()} caracteres</p>
            <pre className="whitespace-pre-wrap text-xs text-cetiem-gray font-mono bg-white/5 p-5 rounded-xl max-h-[65vh] overflow-y-auto">
              {getFullText()}
            </pre>
          </div>
        ) : (
          <div className="space-y-3">
            {sections.length === 0 ? (
              <div className="bg-cetiem-card border border-white/5 rounded-2xl p-6">
                <p className="text-cetiem-gray text-sm">
                  Este documento aún no tiene contenido extraído. Estado: <strong className="text-white">{content.document.status}</strong>
                </p>
              </div>
            ) : (
              <>
                {sections.map(section => (
                  <div key={section.id} className="bg-cetiem-card border border-white/5 rounded-xl overflow-hidden">
                    <button
                      className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/5 transition-colors"
                      onClick={() => toggleSection(section.id)}
                    >
                      {section.level === 0
                        ? <FolderOpen className="h-4 w-4 text-cetiem-green shrink-0" />
                        : <ChevronRight className={`h-4 w-4 text-cetiem-gray shrink-0 transition-transform ${expandedSections.has(section.id) ? "rotate-90" : ""}`} />
                      }
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white text-sm">{section.title}</p>
                        {section.page && <p className="text-xs text-cetiem-gray">Página {section.page} · Nivel {section.level}</p>}
                      </div>
                      {section.content && (
                        <span className="text-xs text-cetiem-gray shrink-0">{section.content.length.toLocaleString()} chars</span>
                      )}
                    </button>

                    {expandedSections.has(section.id) && section.content && (
                      <div className="px-4 pb-4">
                        <pre className="whitespace-pre-wrap text-xs text-cetiem-gray font-mono bg-white/5 p-4 rounded-xl">
                          {section.content}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}

                {pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-cetiem-gray">
                      Mostrando {sections.length} de {pagination.total} secciones
                    </p>
                    <div className="flex items-center gap-2">
                      <button onClick={() => fetchPage(pagination.page - 1)} disabled={!pagination.hasPrev}
                        className="flex items-center gap-1 text-xs border border-white/10 hover:border-cetiem-green/40 text-cetiem-gray hover:text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-30">
                        <ChevronLeft className="h-3.5 w-3.5" /> Anterior
                      </button>
                      <span className="text-xs text-cetiem-gray">Pág {pagination.page} de {pagination.totalPages}</span>
                      <button onClick={() => fetchPage(pagination.page + 1)} disabled={!pagination.hasMore}
                        className="flex items-center gap-1 text-xs border border-white/10 hover:border-cetiem-green/40 text-cetiem-gray hover:text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-30">
                        Siguiente <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="bg-cetiem-card border border-white/5 rounded-2xl p-5 mt-6">
          <h3 className="font-heading font-semibold text-white text-sm mb-4">Estadísticas de Extracción</h3>
          <div className="grid md:grid-cols-4 gap-4">
            {[
              ["Total Caracteres", getTotalChars().toLocaleString()],
              ["Secciones (página)", sections.length.toString()],
              ["Total Secciones", content.document.totalSections.toString()],
              ["Estado", content.document.status],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-cetiem-gray mb-0.5">{label}</p>
                <p className="font-heading font-bold text-xl text-white">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
