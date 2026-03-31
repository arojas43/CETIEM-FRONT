"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FileText, Trash2, Edit2, Save, X, ChevronLeft, ChevronRight, Search, Filter, RefreshCw, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProcessingProgress } from "@/components/processing-progress";
import { useRole } from "@/lib/role-context";
import { CATEGORIAS, getCatalogoById } from "@/lib/document-catalogue";

interface Certification {
  id: string;
  status: string;
  createdAt: string;
  requirements?: { verdict?: string; notes?: string } | null;
}

interface Document {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  domain?: string;
  tipoDocumento?: string | null;
  categoriaDoc?: string | null;
  storageUrl: string;
  createdAt: string;
  pageIndices?: { length: number };
  certifications?: Certification[];
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
  hasPrev: boolean;
}

interface PaginatedResponse {
  data: Document[];
  pagination: PaginationInfo;
}

interface DocumentListPaginatedProps {
  onDocumentDeleted?: () => void;
}

const statusColor: Record<string, string> = {
  ANALYZED:   "bg-cetiem-lime/10 text-cetiem-lime",
  INDEXED:    "bg-cetiem-teal/10 text-cetiem-teal",
  FAILED:     "bg-cetiem-red/10 text-cetiem-red",
  PROCESSING: "bg-cetiem-amber/10 text-cetiem-amber",
  PENDING:    "bg-white/5 text-cetiem-gray",
};

const statusLabel: Record<string, string> = {
  ANALYZED:   "✓ Analizado",
  INDEXED:    "✓ Indexado",
  FAILED:     "✗ Error",
  PROCESSING: "⏳ Procesando",
  PENDING:    "⏳ Pendiente",
};

const certStatusColor: Record<string, string> = {
  APPROVED:  "bg-cetiem-lime/10 text-cetiem-lime border border-cetiem-lime/20",
  IN_REVIEW: "bg-cetiem-amber/10 text-cetiem-amber border border-cetiem-amber/20",
  REJECTED:  "bg-cetiem-red/10 text-cetiem-red border border-cetiem-red/20",
};
const certStatusLabel: Record<string, string> = {
  APPROVED:  "✓ Aprobado",
  IN_REVIEW: "↩ Cambios",
  REJECTED:  "✗ Rechazado",
};

function getLatestCert(certs?: Certification[]) {
  if (!certs || certs.length === 0) return null;
  return certs.reduce((a, b) => new Date(a.createdAt) > new Date(b.createdAt) ? a : b);
}

export function DocumentListPaginated({ onDocumentDeleted }: DocumentListPaginatedProps) {
  const router = useRouter();
  const { role } = useRole();
  const isCompany = role === 'company';

  const [documents, setDocuments] = useState<Document[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1, limit: 10, total: 0, totalPages: 0, hasMore: false, hasPrev: false,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPagination(prev => ({ ...prev, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(statusFilter !== "all" && { status: statusFilter }),
      });

      const response = await fetch(`/api/documents?${params}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al cargar documentos");
      }

      const data: PaginatedResponse = await response.json();
      setDocuments(data.data);
      setPagination(data.pagination);
    } catch (error: any) {
      console.error("Error loading documents:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, debouncedSearch, statusFilter]);

  useEffect(() => { loadDocuments(); }, [loadDocuments]);

  useEffect(() => {
    const hasActiveDocuments = documents.some(d => d.status === "PROCESSING" || d.status === "PENDING");
    if (!hasActiveDocuments) return;
    const interval = setInterval(() => { loadDocuments(); }, 5000);
    return () => clearInterval(interval);
  }, [documents, loadDocuments]);

  const handleEdit = (doc: Document) => { setEditingId(doc.id); setEditingName(doc.name); };
  const handleCancelEdit = () => { setEditingId(null); setEditingName(""); };

  const handleSaveEdit = async (docId: string) => {
    try {
      const response = await fetch(`/api/documents/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingName }),
      });
      if (response.ok) {
        setEditingId(null);
        loadDocuments();
        onDocumentDeleted?.();
      } else {
        const errorData = await response.json();
        alert(`Error al actualizar: ${errorData.error}`);
      }
    } catch (error: any) {
      alert("Error al actualizar el documento");
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm("¿Estás seguro de eliminar este documento? Esta acción no se puede deshacer.")) return;
    setDeletingId(docId);
    try {
      const response = await fetch(`/api/documents/${docId}`, { method: "DELETE" });
      if (response.ok) {
        loadDocuments();
        onDocumentDeleted?.();
      } else {
        const errorData = await response.json();
        alert(`Error al eliminar: ${errorData.error}`);
      }
    } catch {
      alert("Error al eliminar el documento");
    } finally {
      setDeletingId(null);
    }
  };

  const handleProcess = async (docId: string, domain: string) => {
    if (!confirm(`¿Procesar documento con dominio ${domain}? Esto puede tomar varios minutos.`)) return;
    setProcessingId(docId);
    setDocuments(prev => prev.map(d => d.id === docId ? { ...d, status: "PROCESSING" } : d));
    try {
      const response = await fetch(`/api/documents/${docId}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        loadDocuments();
        onDocumentDeleted?.();
      } else {
        alert(`❌ Error al procesar: ${result.error || result.message}`);
        loadDocuments();
      }
    } catch (error: any) {
      alert(`Error al procesar documento: ${error.message}`);
      loadDocuments();
    } finally {
      setProcessingId(null);
    }
  };

  const handleDomainChange = async (docId: string, domain: string) => {
    try {
      const response = await fetch(`/api/documents/${docId}/domain`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      if (response.ok) {
        setDocuments(prev => prev.map(d => d.id === docId ? { ...d, domain } : d));
      } else {
        const errorData = await response.json();
        alert(`Error al actualizar dominio: ${errorData.error}`);
      }
    } catch {
      alert("Error al actualizar dominio");
    }
  };

  const goToPrevPage = () => { if (pagination.hasPrev) setPagination(prev => ({ ...prev, page: prev.page - 1 })); };
  const goToNextPage = () => { if (pagination.hasMore) setPagination(prev => ({ ...prev, page: prev.page + 1 })); };

  if (loading && documents.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-cetiem-green rounded-full border-t-transparent mx-auto mb-4" />
        <p className="text-cetiem-gray text-sm">Cargando documentos...</p>
      </div>
    );
  }

  if (error && documents.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 text-cetiem-gray/20 mx-auto mb-4" />
        <h3 className="font-heading font-semibold text-white mb-1">Error al cargar</h3>
        <p className="text-cetiem-gray text-sm mb-4">{error}</p>
        <button onClick={loadDocuments}
          className="text-sm border border-white/10 hover:border-cetiem-green/40 text-cetiem-gray hover:text-white px-4 py-2 rounded-lg transition-colors">
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cetiem-gray/50" />
          <input
            placeholder="Buscar documentos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-3 border border-white/10 rounded-xl text-sm bg-white/5 text-white placeholder:text-cetiem-gray/40 focus:outline-none focus:border-cetiem-green/40"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cetiem-gray/50 pointer-events-none" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 pl-10 pr-8 border border-white/10 rounded-xl bg-white/5 text-white text-sm focus:outline-none focus:border-cetiem-green/40 appearance-none"
          >
            <option value="all" className="bg-cetiem-dark">Todos</option>
            <option value="PENDING" className="bg-cetiem-dark">Pendiente</option>
            <option value="PROCESSING" className="bg-cetiem-dark">Procesando</option>
            <option value="INDEXED" className="bg-cetiem-dark">Indexado</option>
            <option value="ANALYZED" className="bg-cetiem-dark">Analizado</option>
            <option value="FAILED" className="bg-cetiem-dark">Fallido</option>
          </select>
        </div>
      </div>

      {/* Document list */}
      {documents.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-cetiem-gray/20 mx-auto mb-4" />
          <h3 className="font-heading font-semibold text-white mb-1">
            {search || statusFilter !== "all" ? "Sin resultados" : "No hay documentos"}
          </h3>
          <p className="text-cetiem-gray text-sm mb-4">
            {search || statusFilter !== "all"
              ? "No se encontraron documentos con los filtros actuales"
              : "Sube tu primer documento para comenzar"}
          </p>
          {(search || statusFilter !== "all") && (
            <button
              onClick={() => { setSearch(""); setStatusFilter("all"); }}
              className="text-sm border border-white/10 hover:border-cetiem-green/40 text-cetiem-gray hover:text-white px-4 py-2 rounded-lg transition-colors"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className={cn(
                  "flex items-center gap-4 p-4 border rounded-xl transition-all",
                  deletingId === doc.id
                    ? "bg-cetiem-red/5 border-cetiem-red/20"
                    : "bg-white/[0.02] border-white/5 hover:bg-white/5 hover:border-white/10"
                )}
              >
                {/* Icon */}
                <div className="h-9 w-9 bg-cetiem-green/10 rounded-lg flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4 text-cetiem-green" />
                </div>

                {/* Name + meta */}
                <div className="flex-1 min-w-0">
                  {editingId === doc.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="flex-1 h-8 px-2 border border-cetiem-teal/40 rounded-lg text-sm bg-white/5 text-white focus:outline-none"
                        autoFocus
                      />
                      <button onClick={() => handleSaveEdit(doc.id)} className="text-cetiem-green hover:text-white transition-colors">
                        <Save className="h-4 w-4" />
                      </button>
                      <button onClick={handleCancelEdit} className="text-cetiem-gray hover:text-white transition-colors">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-white text-sm truncate">{doc.name}</p>
                        {doc.tipoDocumento && (() => {
                          const tipo = getCatalogoById(doc.tipoDocumento!);
                          const cat = tipo?.categoria ?? (doc.categoriaDoc as any);
                          if (!cat || cat === "OTRO") return null;
                          const info = CATEGORIAS[cat as keyof typeof CATEGORIAS];
                          return info ? (
                            <span className={cn(
                              "px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0",
                              info.bgColor, info.color
                            )}>
                              {tipo ? tipo.nombre : info.label}
                            </span>
                          ) : null;
                        })()}
                      </div>
                      <p className="text-xs text-cetiem-gray truncate">
                        {doc.description || new Date(doc.createdAt).toLocaleDateString('es-ES')}
                      </p>
                      {(doc.status === "PROCESSING" || doc.status === "PENDING" || processingId === doc.id) && (
                        <ProcessingProgress
                          documentId={doc.id}
                          status={processingId === doc.id ? "PROCESSING" : doc.status}
                          className="mt-2"
                        />
                      )}
                    </>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Domain selector — assessor/admin only */}
                  {!isCompany && (
                  <select
                    value={doc.domain || "INDUSTRIA"}
                    onChange={(e) => handleDomainChange(doc.id, e.target.value)}
                    disabled={processingId === doc.id}
                    className="h-8 px-2 border border-white/10 rounded-lg text-xs bg-white/5 text-white focus:outline-none focus:border-cetiem-green/40 disabled:opacity-50"
                  >
                    <option value="INDUSTRIA" className="bg-cetiem-dark">🏭 Industria</option>
                    <option value="CONSTRUCCION" className="bg-cetiem-dark">🏗️ Construcción</option>
                    <option value="TECNOLOGIA" className="bg-cetiem-dark">💻 Tecnología</option>
                  </select>
                  )}

                  {/* Process button — assessor/admin only; company must upload new doc */}
                  {!isCompany && <button
                    onClick={() => handleProcess(doc.id, doc.domain || "INDUSTRIA")}
                    disabled={processingId === doc.id || doc.status === "PROCESSING"}
                    title={doc.status === "FAILED" || doc.status === "PENDING" ? "Procesar" : "Reprocesar"}
                    className={cn(
                      "h-8 w-8 flex items-center justify-center rounded-lg border transition-colors disabled:opacity-40",
                      doc.status === "FAILED" || doc.status === "PENDING"
                        ? "border-cetiem-amber/30 text-cetiem-amber hover:bg-cetiem-amber/10"
                        : "border-white/10 text-cetiem-gray hover:border-cetiem-green/40 hover:text-white"
                    )}
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", processingId === doc.id && "animate-spin")} />
                  </button>}

                  {/* View PDF */}
                  <a
                    href={doc.storageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Ver PDF"
                    className="h-8 w-8 flex items-center justify-center rounded-lg border border-white/10 text-cetiem-gray hover:border-cetiem-green/40 hover:text-cetiem-green transition-colors"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </a>

                  {/* View details */}
                  <button
                    onClick={() => router.push(`/dashboard/documents/${doc.id}`)}
                    title="Ver detalles"
                    className="h-8 w-8 flex items-center justify-center rounded-lg border border-white/10 text-cetiem-gray hover:border-cetiem-teal/40 hover:text-white transition-colors"
                  >
                    <FileText className="h-3.5 w-3.5" />
                  </button>

                  {/* Edit & delete */}
                  {editingId !== doc.id && (
                    <>
                      <button
                        onClick={() => handleEdit(doc)}
                        title="Editar nombre"
                        className="h-8 w-8 flex items-center justify-center rounded-lg border border-white/10 text-cetiem-gray hover:border-white/20 hover:text-white transition-colors"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(doc.id)}
                        disabled={deletingId === doc.id}
                        title="Eliminar documento"
                        className="h-8 w-8 flex items-center justify-center rounded-lg border border-white/10 text-cetiem-red/60 hover:border-cetiem-red/30 hover:text-cetiem-red transition-colors disabled:opacity-40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}

                  {deletingId === doc.id && (
                    <span className="text-xs text-cetiem-gray">Eliminando...</span>
                  )}

                  {/* Status badge */}
                  <div className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-medium min-w-[90px] text-center",
                    processingId === doc.id
                      ? "bg-cetiem-amber/10 text-cetiem-amber"
                      : statusColor[doc.status] || "bg-white/5 text-cetiem-gray"
                  )}>
                    {processingId === doc.id ? (
                      <span className="flex items-center justify-center gap-1">
                        <RefreshCw className="h-3 w-3 animate-spin" /> Procesando
                      </span>
                    ) : (
                      statusLabel[doc.status] || doc.status
                    )}
                  </div>

                  {/* Certification status badge */}
                  {(() => {
                    const cert = getLatestCert(doc.certifications);
                    if (!cert) return null;
                    return (
                      <div className={cn("px-2.5 py-1 rounded-full text-xs font-medium min-w-[90px] text-center", certStatusColor[cert.status])}>
                        {certStatusLabel[cert.status] || cert.status}
                      </div>
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-4 border-t border-white/5">
            <p className="text-xs text-cetiem-gray">
              Mostrando {documents.length} de {pagination.total} documentos
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={goToPrevPage}
                disabled={!pagination.hasPrev}
                className="flex items-center gap-1 text-xs border border-white/10 hover:border-cetiem-green/40 text-cetiem-gray hover:text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-30"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Anterior
              </button>
              <span className="text-xs text-cetiem-gray">
                Pág {pagination.page} de {pagination.totalPages || 1}
              </span>
              <button
                onClick={goToNextPage}
                disabled={!pagination.hasMore}
                className="flex items-center gap-1 text-xs border border-white/10 hover:border-cetiem-green/40 text-cetiem-gray hover:text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-30"
              >
                Siguiente <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
