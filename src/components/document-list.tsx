"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Document } from "@prisma/client";
import { FileText, Trash2, Edit2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface DocumentWithRelations extends Document {
  pageIndices?: { length: number };
  certifications?: { length: number };
}

interface DocumentListProps {
  documents: DocumentWithRelations[];
  onDocumentDeleted?: () => void;
}

export function DocumentList({ documents, onDocumentDeleted }: DocumentListProps) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleEdit = (doc: DocumentWithRelations) => {
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
        onDocumentDeleted?.();
      } else {
        alert("Error al actualizar el documento");
      }
    } catch (error) {
      console.error("Error updating document:", error);
      alert("Error al actualizar el documento");
    }
  };

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
        onDocumentDeleted?.();
      } else {
        alert("Error al eliminar el documento");
      }
    } catch (error) {
      console.error("Error deleting document:", error);
      alert("Error al eliminar el documento");
    } finally {
      setDeletingId(null);
    }
  };

  if (documents.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="h-16 w-16 text-white/30 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-white/90 mb-2">
          No hay documentos
        </h3>
        <p className="text-white/50 mb-6">
          Sube tu primer documento para comenzar
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className={cn(
            "flex items-center justify-between p-4 border rounded-lg transition-all",
            deletingId === doc.id ? "bg-red-50 border-red-200" : "hover:bg-white/4"
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
                    <X className="h-4 w-4 text-white/60" />
                  </Button>
                </div>
              ) : (
                <>
                  <p className="font-medium text-white/90">{doc.name}</p>
                  <p className="text-sm text-white/50">
                    {doc.description || "Sin descripción"}
                  </p>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => router.push(`/dashboard/documents/${doc.id}`)}
              title="Ver detalles"
            >
              <FileText className="h-4 w-4" />
            </Button>
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
              <span className="text-xs text-white/50">Eliminando...</span>
            )}
            <div
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium",
                doc.status === "INDEXED" || doc.status === "ANALYZED"
                  ? "bg-green-100 text-green-700"
                  : doc.status === "PROCESSING"
                  ? "bg-yellow-100 text-yellow-700"
                  : doc.status === "FAILED"
                  ? "bg-red-100 text-red-700"
                  : "bg-white/6 text-white/70"
              )}
            >
              {doc.status === "INDEXED" && "✓ Listo"}
              {doc.status === "ANALYZED" && "✓ Analizado"}
              {doc.status === "PROCESSING" && "⏳ Procesando"}
              {doc.status === "FAILED" && "✗ Error"}
              {doc.status === "PENDING" && "⏳ Pendiente"}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
