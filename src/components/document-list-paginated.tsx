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
  user?: { id: string; companyName: string | null; name: string | null; email: string } | null;
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
  ANALYZED: "bg-economia-success/10 text-economia-success",
  INDEXED: "bg-economia-info/10 text-economia-info",
  FAILED: "bg-economia-error/10 text-economia-error",
  PROCESSING: "bg-economia-warning/10 text-economia-warning",
  PENDING: "bg-muted text-muted-foreground",
};

const statusLabel: Record<string, string> = {
  ANALYZED: "✓ Analizado",
  INDEXED: "✓ Indexado",
  FAILED: "✗ Error",
  PROCESSING: "⏳ Procesando",
  PENDING: "⏳ Pendiente",
};

const certStatusColor: Record<string, string> = {
  APPROVED: "bg-economia-success/10 text-economia-success border border-economia-success/20",
  IN_REVIEW: "bg-economia-warning/10 text-economia-warning border border-economia-warning/20",
  REJECTED: "bg-economia-error/10 text-economia-error border border-economia-error/20",
  REVOKED: "bg-economia-error/10 text-economia-error border border-economia-error/20",
  CAPA_OPEN: "bg-economia-warning/10 text-economia-warning border border-economia-warning/20",
};
const certStatusLabel: Record<string, string> = {
  APPROVED: "✓ Aprobado",
  IN_REVIEW: "↩ Cambios",
  REJECTED: "✗ Rechazado",
  REVOKED: "✗ Revocado",
  CAPA_OPEN: "⚠ CAPA",
};

function getLatestCert(certs?: Certification[]) {
  if (!certs || certs.length === 0) return null;
  return certs.reduce((a, b) => new Date(a.createdAt) > new Date(b.createdAt) ? a : b);
}

export function DocumentListPaginated({ onDocumentDeleted }: DocumentListPaginatedProps) {
  const router = useRouter();
  const { role } = useRole();
  const isCompany = role === 'company';
  const isAssessor = role === 'assessor';

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
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPagination(prev => ({ ...prev, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadDocuments = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(statusFilter !== "all" && { status: statusFilter }),
      });

      const response = await fetch(`/api/documents?${params}`, { signal });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al cargar documentos");
      }

      const data: PaginatedResponse = await response.json();
      setDocuments(data.data);
      setPagination(data.pagination);
    } catch (error: any) {
      if (error.name === "AbortError") return; // request cancelado — ignorar
      console.error("Error loading documents:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, debouncedSearch, statusFilter]);

  useEffect(() => {
    const controller = new AbortController();
    loadDocuments(controller.signal);
    return () => controller.abort();
  }, [loadDocuments]);

  useEffect(() => {
    const hasActiveDocuments = documents.some(d => d.status === "PROCESSING" || d.status === "PENDING");
    if (!hasActiveDocuments) return;
    const interval = setInterval(() => {
      const controller = new AbortController();
      loadDocuments(controller.signal);
    }, 5000);
    return () => clearInterval(interval);
  }, [documents, loadDocuments]);

  const handleEdit = (doc: Document) => { setEditingId(doc.id); setEditingName(doc.name); };
  const handleCancelEdit = () => { setEditingId(null); setEditingName(""); };

  const showError = (msg: string) => { setActionError(msg); setTimeout(() => setActionError(null), 5000); };
  const showSuccess = (msg: string) => { setActionSuccess(msg); setTimeout(() => setActionSuccess(null), 3000); };

  const handleSaveEdit = async (docId: string) => {
    try {
      const response = await fetch(`/api/documents/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingName }),
      });
      if (response.ok) {
        setEditingId(null);
        showSuccess("Nombre actualizado.");
        loadDocuments();
        onDocumentDeleted?.();
      } else {
        const errorData = await response.json();
        showError(errorData.error || "Error al actualizar el documento.");
      }
    } catch {
      showError("Error de conexión al actualizar el documento.");
    }
  };

  const handleDelete = async (docId: string) => {
    setConfirmDeleteId(null);
    setDeletingId(docId);
    try {
      const response = await fetch(`/api/documents/${docId}`, { method: "DELETE" });
      if (response.ok) {
        showSuccess("Documento eliminado.");
        loadDocuments();
        onDocumentDeleted?.();
      } else {
        const errorData = await response.json();
        showError(errorData.error || "Error al eliminar el documento.");
      }
    } catch {
      showError("Error de conexión al eliminar el documento.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleProcess = async (docId: string, domain: string) => {
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
        showSuccess("Documento procesado correctamente.");
        loadDocuments();
        onDocumentDeleted?.();
      } else {
        showError(result.error || result.message || "Error al procesar el documento.");
        loadDocuments();
      }
    } catch (error: any) {
      showError(error.message || "Error al procesar el documento.");
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
        showError(errorData.error || "Error al actualizar el dominio.");
      }
    } catch {
      showError("Error de conexión al actualizar el dominio.");
    }
  };

  const goToPrevPage = () => { if (pagination.hasPrev) setPagination(prev => ({ ...prev, page: prev.page - 1 })); };
  const goToNextPage = () => { if (pagination.hasMore) setPagination(prev => ({ ...prev, page: prev.page + 1 })); };

  if (loading && documents.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-economia-guinda rounded-full border-t-transparent mx-auto mb-4" />
        <p className="text-muted-foreground text-sm">Cargando documentos...</p>
      </div>
    );
  }

  if (error && documents.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
        <h3 className="font-heading font-semibold text-foreground mb-1">Error al cargar</h3>
        <p className="text-muted-foreground text-sm mb-4">{error}</p>
        <button onClick={() => loadDocuments()}
          className="text-sm border border-border hover:border-economia-guinda/40 text-muted-foreground hover:text-foreground px-4 py-2 rounded-lg transition-colors">
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Action feedback toasts */}
      {actionError && (
        <div className="flex items-center justify-between gap-2 px-4 py-3 bg-economia-error/10 border border-economia-error/20 rounded-xl text-economia-error text-sm">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="shrink-0 text-economia-error/60 hover:text-economia-error transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {actionSuccess && (
        <div className="px-4 py-3 bg-economia-success/10 border border-economia-success/20 rounded-xl text-economia-success text-sm">
          {actionSuccess}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
          <input
            placeholder="Buscar documentos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-3 border border-border rounded-xl text-sm bg-muted text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-economia-guinda/40"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 pointer-events-none" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 pl-10 pr-8 border border-border rounded-xl bg-muted text-foreground text-sm focus:outline-none focus:border-economia-guinda/40 appearance-none"
          >
            <option value="all" className="bg-economia-verdeDark">Todos</option>
            <option value="PENDING" className="bg-economia-verdeDark">Pendiente</option>
            <option value="PROCESSING" className="bg-economia-verdeDark">Procesando</option>
            <option value="INDEXED" className="bg-economia-verdeDark">Indexado</option>
            <option value="ANALYZED" className="bg-economia-verdeDark">Analizado</option>
            <option value="FAILED" className="bg-economia-verdeDark">Fallido</option>
          </select>
        </div>
      </div>

      {/* Document list */}
      {documents.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
          <h3 className="font-heading font-semibold text-foreground mb-1">
            {search || statusFilter !== "all" ? "Sin resultados" : "No hay documentos"}
          </h3>
          <p className="text-muted-foreground text-sm mb-4">
            {search || statusFilter !== "all"
              ? "No se encontraron documentos con los filtros actuales"
              : "Sube tu primer documento para comenzar"}
          </p>
          {(search || statusFilter !== "all") && (
            <button
              onClick={() => { setSearch(""); setStatusFilter("all"); }}
              className="text-sm border border-border hover:border-economia-guinda/40 text-muted-foreground hover:text-foreground px-4 py-2 rounded-lg transition-colors"
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
                  "border rounded-xl transition-all overflow-hidden",
                  confirmDeleteId === doc.id || deletingId === doc.id
                    ? "bg-economia-error/5 border-economia-error/20"
                    : "bg-muted/30 border-border hover:bg-muted hover:border-border"
                )}
              >
              <div className="flex items-center gap-4 p-4">
                {/* Icon */}
                <div className="h-9 w-9 bg-economia-guinda/10 rounded-lg flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4 text-economia-guinda" />
                </div>

                {/* Name + meta */}
                <div className="flex-1 min-w-0">
                  {editingId === doc.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="flex-1 h-8 px-2 border border-economia-info/40 rounded-lg text-sm bg-muted text-foreground focus:outline-none"
                        autoFocus
                      />
                      <button onClick={() => handleSaveEdit(doc.id)} className="text-economia-guinda hover:text-foreground transition-colors">
                        <Save className="h-4 w-4" />
                      </button>
                      <button onClick={handleCancelEdit} className="text-muted-foreground hover:text-foreground transition-colors">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-foreground text-sm truncate">{doc.name}</p>
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
                      <p className="text-xs text-muted-foreground truncate">
                        {!isCompany && doc.user && (
                          <span className="text-economia-info/70 font-medium mr-1">
                            {doc.user.companyName || doc.user.name || doc.user.email} ·{" "}
                          </span>
                        )}
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
                      className="h-8 px-2 border border-border rounded-lg text-xs bg-muted text-foreground focus:outline-none focus:border-economia-guinda/40 disabled:opacity-50"
                    >
                      <option value="INDUSTRIA" className="bg-economia-verdeDark">🏭 Industria</option>
                      <option value="CONSTRUCCION" className="bg-economia-verdeDark">🏗️ Construcción</option>
                      <option value="TECNOLOGIA" className="bg-economia-verdeDark">💻 Tecnología</option>
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
                        ? "border-economia-warning/30 text-economia-warning hover:bg-economia-warning/10"
                        : "border-border text-muted-foreground hover:border-economia-guinda/40 hover:text-foreground"
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
                    className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:border-economia-guinda/40 hover:text-economia-guinda transition-colors"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </a>

                  {/* View details */}
                  <button
                    onClick={() => router.push(`/dashboard/documents/${doc.id}`)}
                    title="Ver detalles"
                    className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:border-economia-info/40 hover:text-foreground transition-colors"
                  >
                    <FileText className="h-3.5 w-3.5" />
                  </button>

                  {/* Edit & delete — company and admin only, not assessors */}
                  {editingId !== doc.id && !isAssessor && (
                    <>
                      <button
                        onClick={() => handleEdit(doc)}
                        title="Editar nombre"
                        className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:border-border hover:text-foreground transition-colors"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(doc.id)}
                        disabled={deletingId === doc.id}
                        title="Eliminar documento"
                        className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-economia-error/60 hover:border-economia-error/30 hover:text-economia-error transition-colors disabled:opacity-40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}

                  {deletingId === doc.id && (
                    <span className="text-xs text-muted-foreground">Eliminando...</span>
                  )}

                  {/* Status badge */}
                  <div className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-medium min-w-[90px] text-center",
                    processingId === doc.id
                      ? "bg-economia-warning/10 text-economia-warning"
                      : statusColor[doc.status] || "bg-muted text-muted-foreground"
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
              {/* Inline delete confirmation strip */}
              {confirmDeleteId === doc.id && (
                <div className="border-t border-economia-error/20 px-4 py-3 flex items-center justify-between gap-3">
                  <p className="text-xs text-foreground truncate">
                    ¿Eliminar <span className="font-semibold">{doc.name}</span>? Esta acción no se puede deshacer.
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleDelete(doc.id)}
                      disabled={deletingId === doc.id}
                      className="text-xs bg-economia-error hover:bg-economia-error/90 text-white font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {deletingId === doc.id ? "Eliminando..." : "Confirmar"}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Mostrando {documents.length} de {pagination.total} documentos
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={goToPrevPage}
                disabled={!pagination.hasPrev}
                className="flex items-center gap-1 text-xs border border-border hover:border-economia-guinda/40 text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg transition-colors disabled:opacity-30"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Anterior
              </button>
              <span className="text-xs text-muted-foreground">
                Pág {pagination.page} de {pagination.totalPages || 1}
              </span>
              <button
                onClick={goToNextPage}
                disabled={!pagination.hasMore}
                className="flex items-center gap-1 text-xs border border-border hover:border-economia-guinda/40 text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg transition-colors disabled:opacity-30"
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
