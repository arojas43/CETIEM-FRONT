"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FileText, Trash2, Edit2, Save, X, ChevronLeft, ChevronRight, Search, Filter, Brain, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Document {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  domain?: string;
  createdAt: string;
  pageIndices?: { length: number };
  certifications?: { length: number };
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

export function DocumentListPaginated({ onDocumentDeleted }: DocumentListPaginatedProps) {
  const router = useRouter();
  
  // Estado de datos
  const [documents, setDocuments] = useState<Document[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
    hasMore: false,
    hasPrev: false,
  });
  
  // Estado de UI
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [processingDomain, setProcessingDomain] = useState<Record<string, string>>({});
  
  // Estado de filtros
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce para búsqueda
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPagination(prev => ({ ...prev, page: 1 }));
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  // Cargar documentos
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

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Manejadores de edición
  const handleEdit = (doc: Document) => {
    setEditingId(doc.id);
    setEditingName(doc.name);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

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
      console.error("Error updating document:", error);
      alert("Error al actualizar el documento");
    }
  };

  // Manejador de eliminación
  const handleDelete = async (docId: string) => {
    if (!confirm("¿Estás seguro de eliminar este documento? Esta acción no se puede deshacer.")) {
      return;
    }

    setDeletingId(docId);
    try {
      const response = await fetch(`/api/documents/${docId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        loadDocuments();
        onDocumentDeleted?.();
      } else {
        const errorData = await response.json();
        alert(`Error al eliminar: ${errorData.error}`);
      }
    } catch (error: any) {
      console.error("Error deleting document:", error);
      alert("Error al eliminar el documento");
    } finally {
      setDeletingId(null);
    }
  };

  // Manejador de procesamiento manual
  const handleProcess = async (docId: string, domain: string) => {
    if (!confirm(`¿Procesar documento con dominio ${domain}? Esto puede tomar varios minutos.`)) {
      return;
    }

    setProcessingId(docId);
    try {
      const response = await fetch(`/api/documents/${docId}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        alert(`✅ Documento procesado exitosamente!\n\nEntidades: ${result.document.entities}\nÍndices: ${result.document.indices}\nTiempo: ${result.document.duration}s`);
        loadDocuments();
        onDocumentDeleted?.();
      } else {
        alert(`❌ Error al procesar: ${result.error || result.message}`);
      }
    } catch (error: any) {
      console.error("Error processing document:", error);
      alert(`Error al procesar documento: ${error.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  // Manejador de cambio de dominio
  const handleDomainChange = async (docId: string, domain: string) => {
    try {
      const response = await fetch(`/api/documents/${docId}/domain`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });

      if (response.ok) {
        // Actualizar dominio localmente
        setDocuments(prev => prev.map(d => d.id === docId ? { ...d, domain } : d));
      } else {
        const errorData = await response.json();
        alert(`Error al actualizar dominio: ${errorData.error}`);
      }
    } catch (error: any) {
      console.error("Error updating domain:", error);
      alert("Error al actualizar dominio");
    }
  };

  // Navegación de paginación
  const goToPage = (page: number) => {
    setPagination(prev => ({ ...prev, page }));
  };

  const goToPrevPage = () => {
    if (pagination.hasPrev) {
      setPagination(prev => ({ ...prev, page: prev.page - 1 }));
    }
  };

  const goToNextPage = () => {
    if (pagination.hasMore) {
      setPagination(prev => ({ ...prev, page: prev.page + 1 }));
    }
  };

  // Render de estado
  if (loading && documents.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-gray-500">Cargando documentos...</p>
      </div>
    );
  }

  if (error && documents.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="h-16 w-16 text-red-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Error al cargar</h3>
        <p className="text-gray-500 mb-4">{error}</p>
        <Button onClick={loadDocuments}>Reintentar</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar documentos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 pl-10 pr-8 border rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos</option>
            <option value="PENDING">Pendiente</option>
            <option value="PROCESSING">Procesando</option>
            <option value="INDEXED">Indexado</option>
            <option value="ANALYZED">Analizado</option>
            <option value="FAILED">Fallido</option>
          </select>
        </div>
      </div>

      {/* Lista de documentos */}
      {documents.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No hay documentos
          </h3>
          <p className="text-gray-500 mb-6">
            {search || statusFilter !== "all" 
              ? "No se encontraron documentos con los filtros actuales"
              : "Sube tu primer documento para comenzar"}
          </p>
          {(search || statusFilter !== "all") && (
            <Button variant="outline" onClick={() => { setSearch(""); setStatusFilter("all"); }}>
              Limpiar filtros
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className={cn(
                  "flex items-center justify-between p-4 border rounded-lg transition-all",
                  deletingId === doc.id ? "bg-red-50 border-red-200" : "hover:bg-gray-50"
                )}
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="h-10 w-10 bg-red-100 rounded-lg flex items-center justify-center">
                    <FileText className="h-5 w-5 text-red-600" />
                  </div>
                  <div className="flex-1">
                    {editingId === doc.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="h-8"
                          autoFocus
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSaveEdit(doc.id)}
                        >
                          <Save className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleCancelEdit}
                        >
                          <X className="h-4 w-4 text-gray-600" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <p className="font-medium text-gray-900">{doc.name}</p>
                        <p className="text-sm text-gray-500">
                          {doc.description || "Sin descripción"}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(doc.createdAt).toLocaleDateString('es-ES')}
                        </p>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Selector de dominio */}
                  <select
                    value={doc.domain || "LEGAL"}
                    onChange={(e) => handleDomainChange(doc.id, e.target.value)}
                    disabled={processingId === doc.id}
                    className="h-8 px-2 border rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                    title="Seleccionar dominio de análisis"
                  >
                    <option value="LEGAL">📜 Legal</option>
                    <option value="MEDICAL">🏥 Médico</option>
                    <option value="TECHNICAL">⚙️ Técnico</option>
                    <option value="ACADEMIC">🎓 Académico</option>
                    <option value="CUSTOM">📝 Custom</option>
                  </select>

                  {/* Botón de procesar */}
                  <Button
                    size="sm"
                    variant={doc.status === "FAILED" || doc.status === "PENDING" ? "default" : "outline"}
                    onClick={() => handleProcess(doc.id, doc.domain || "LEGAL")}
                    disabled={processingId === doc.id || doc.status === "PROCESSING"}
                    title={
                      doc.status === "FAILED" || doc.status === "PENDING"
                        ? "Procesar documento"
                        : "Reprocesar documento"
                    }
                    className={cn(
                      processingId === doc.id && "animate-pulse"
                    )}
                  >
                    <RefreshCw className={cn(
                      "h-4 w-4",
                      processingId === doc.id && "animate-spin"
                    )} />
                  </Button>

                  {/* Botón ver detalles */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => router.push(`/dashboard/documents/${doc.id}`)}
                    title="Ver detalles"
                  >
                    <FileText className="h-4 w-4" />
                  </Button>

                  {/* Editar y eliminar */}
                  {editingId !== doc.id && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(doc)}
                        title="Editar nombre"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(doc.id)}
                        disabled={deletingId === doc.id}
                        title="Eliminar documento"
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}

                  {deletingId === doc.id && (
                    <span className="text-xs text-gray-500">Eliminando...</span>
                  )}

                  {/* Badge de estado */}
                  <div
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium min-w-[100px] text-center",
                      doc.status === "INDEXED" || doc.status === "ANALYZED"
                        ? "bg-green-100 text-green-700"
                        : doc.status === "PROCESSING"
                        ? "bg-yellow-100 text-yellow-700"
                        : doc.status === "FAILED"
                        ? "bg-red-100 text-red-700"
                        : "bg-gray-100 text-gray-700"
                    )}
                  >
                    {processingId === doc.id ? (
                      <span className="flex items-center gap-1">
                        <RefreshCw className="h-3 w-3 animate-spin" />
                        Procesando...
                      </span>
                    ) : (
                      <>
                        {doc.status === "INDEXED" && "✓ Listo"}
                        {doc.status === "ANALYZED" && "✓ Analizado"}
                        {doc.status === "PROCESSING" && "⏳ Procesando"}
                        {doc.status === "FAILED" && "✗ Error"}
                        {doc.status === "PENDING" && "⏳ Pendiente"}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Paginación */}
          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-sm text-gray-500">
              Mostrando {documents.length} de {pagination.total} documentos
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={goToPrevPage}
                disabled={!pagination.hasPrev}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Anterior
              </Button>
              
              <span className="text-sm text-gray-600">
                Página {pagination.page} de {pagination.totalPages || 1}
              </span>
              
              <Button
                variant="outline"
                size="sm"
                onClick={goToNextPage}
                disabled={!pagination.hasMore}
              >
                Siguiente
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
