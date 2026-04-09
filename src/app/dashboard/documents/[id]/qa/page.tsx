"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Send, Brain, Network, FileText, ChevronRight, Sparkles, BookOpen } from "lucide-react";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { useRole } from "@/lib/role-context";

interface Entity { id: string; type: string; name: string; description?: string }
interface Relation { id: string; source: string; target: string; type: string }
interface Reference { page?: number; section?: string; title?: string }
interface SearchResponse {
  answer: string; entities: Entity[]; relations: Relation[];
  context: string; references: Reference[];
  stats: { entityCount: number; relationCount: number; contextPages?: number[] };
}
interface GraphStats { entityCount: number; relationCount: number; entityTypes: Record<string, number> }

export default function DocumentQAPage() {
  const params = useParams();
  const documentId = params.id as string;
  const { role } = useRole();
  const router = useRouter();
  useEffect(() => { if (role === "company") router.replace(`/dashboard/documents/${documentId}`); }, [role, router, documentId]);
  if (role === "company") return null;

  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [stats, setStats] = useState<GraphStats | null>(null);
  const [showEntities, setShowEntities] = useState(false);
  const [showRelations, setShowRelations] = useState(false);

  useEffect(() => {
    fetch(`/api/documents/${documentId}/search`)
      .then(r => r.ok ? r.json() : null)
      .then(data => data && setStats(data))
      .catch(console.error);
  }, [documentId]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    setResponse(null);

    try {
      const res = await fetch(`/api/documents/${documentId}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: question, includeRelations: true }),
      });

      const data = await res.json();
      setResponse(res.ok ? data : { answer: `Error: ${data.error}`, entities: [], relations: [], context: "", references: [], stats: { entityCount: 0, relationCount: 0 } });
    } catch (error: any) {
      setResponse({ answer: `Error de conexión: ${error.message}`, entities: [], relations: [], context: "", references: [], stats: { entityCount: 0, relationCount: 0 } });
    } finally {
      setLoading(false);
    }
  };

  const suggested = [
    "¿Cuáles son los temas principales de este documento?",
    "¿Qué dice la página 1?",
    "¿Qué requisitos o condiciones se mencionan?",
    "Resume el contenido de la sección 1",
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/5">
        <div>
          <h1 className="font-heading font-bold text-2xl text-white">Preguntar al Documento</h1>
          <p className="text-cetiem-gray text-sm mt-0.5">IA + Grafo de Conocimiento</p>
        </div>
        <button onClick={() => window.history.back()} className="text-sm text-cetiem-gray hover:text-white transition-colors px-3 py-1.5 border border-white/10 rounded-lg">
          ← Volver
        </button>
      </div>

      <div className="flex-1 p-8 overflow-auto max-w-4xl">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: "Entidades", value: stats.entityCount, sub: "En el grafo", icon: Brain, color: "cetiem-teal" },
              { label: "Relaciones", value: stats.relationCount, sub: "Conexiones", icon: Network, color: "cetiem-lime" },
              { label: "Tipos", value: Object.keys(stats.entityTypes || {}).length, sub: "Categorías", icon: Sparkles, color: "cetiem-amber" },
            ].map(s => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="bg-cetiem-card border border-white/5 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-cetiem-gray">{s.label}</span>
                    <Icon className={`h-4 w-4 text-${s.color}`} />
                  </div>
                  <div className="text-2xl font-heading font-bold text-white">{s.value}</div>
                  <p className="text-xs text-cetiem-gray mt-1">{s.sub}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Search */}
        <div className="bg-cetiem-card border border-white/5 rounded-2xl p-5 mb-6">
          <h2 className="font-heading font-semibold text-white mb-1 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-cetiem-teal" />
            Haz una pregunta sobre este documento
          </h2>
          <p className="text-cetiem-gray text-xs mb-4">La IA analizará el contenido del documento para responderte con precisión</p>

          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ej: ¿Qué dice sobre liposarcomas?"
              className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-cetiem-gray/40"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 bg-cetiem-teal hover:bg-cetiem-teal/90 text-white text-sm font-medium px-4 rounded-xl transition-colors disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {loading ? "Buscando..." : "Preguntar"}
            </button>
          </form>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-xs text-cetiem-gray self-center">Sugerencias:</span>
            {suggested.map((q, i) => (
              <button key={i} onClick={() => setQuestion(q)}
                className="text-xs border border-white/10 hover:border-cetiem-green/40 text-cetiem-gray hover:text-white px-3 py-1 rounded-lg transition-colors">
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Response */}
        {response && (
          <div className="space-y-4">
            <div className="bg-cetiem-teal/5 border border-cetiem-teal/20 rounded-2xl p-5">
              <h3 className="font-heading font-semibold text-cetiem-teal mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> Respuesta
              </h3>
              <div className="text-white text-sm">
                <MarkdownRenderer content={response.answer} />
              </div>
            </div>

            <div className="flex gap-4 text-xs text-cetiem-gray">
              <span className="flex items-center gap-1"><Brain className="h-3 w-3" />{response.stats.entityCount} entidades encontradas</span>
              <span className="flex items-center gap-1"><Network className="h-3 w-3" />{response.stats.relationCount} relaciones</span>
            </div>

            {response.entities.length > 0 && (
              <div className="bg-cetiem-card border border-white/5 rounded-2xl overflow-hidden">
                <button
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-white/5 transition-colors"
                  onClick={() => setShowEntities(!showEntities)}
                >
                  <span className="font-heading font-semibold text-white flex items-center gap-2">
                    <Brain className="h-4 w-4 text-cetiem-teal" /> Entidades Encontradas ({response.entities.length})
                  </span>
                  <ChevronRight className={`h-4 w-4 text-cetiem-gray transition-transform ${showEntities ? "rotate-90" : ""}`} />
                </button>
                {showEntities && (
                  <div className="px-5 pb-5 space-y-2">
                    {response.entities.map(entity => (
                      <div key={entity.id} className="flex items-start gap-3 p-3 bg-white/5 rounded-xl">
                        <div className="h-7 w-7 bg-cetiem-teal/10 rounded-lg flex items-center justify-center shrink-0">
                          <FileText className="h-3.5 w-3.5 text-cetiem-teal" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-medium text-white text-sm">{entity.name}</span>
                            <span className="text-xs bg-cetiem-teal/10 text-cetiem-teal px-2 py-0.5 rounded">{entity.type}</span>
                          </div>
                          {entity.description && <p className="text-xs text-cetiem-gray">{entity.description}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {response.relations.length > 0 && (
              <div className="bg-cetiem-card border border-white/5 rounded-2xl overflow-hidden">
                <button
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-white/5 transition-colors"
                  onClick={() => setShowRelations(!showRelations)}
                >
                  <span className="font-heading font-semibold text-white flex items-center gap-2">
                    <Network className="h-4 w-4 text-cetiem-lime" /> Relaciones ({response.relations.length})
                  </span>
                  <ChevronRight className={`h-4 w-4 text-cetiem-gray transition-transform ${showRelations ? "rotate-90" : ""}`} />
                </button>
                {showRelations && (
                  <div className="px-5 pb-5 space-y-2">
                    {response.relations.map((rel, i) => (
                      <div key={i} className="flex items-center gap-2 p-3 bg-white/5 rounded-xl text-sm">
                        <span className="font-medium text-white">{rel.source}</span>
                        <span className="text-xs bg-cetiem-lime/10 text-cetiem-lime px-2 py-0.5 rounded">{rel.type}</span>
                        <span className="font-medium text-white">{rel.target}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {response.references && response.references.length > 0 && (
              <div className="bg-cetiem-card border border-white/5 rounded-2xl p-5">
                <h3 className="font-heading font-semibold text-white mb-3 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-cetiem-green" /> Referencias en el Documento
                </h3>
                <div className="flex flex-wrap gap-2">
                  {response.references
                    .filter((r, i, arr) => arr.findIndex(x => `${x.page ?? ''}-${x.section ?? ''}` === `${r.page ?? ''}-${r.section ?? ''}`) === i)
                    .map((ref, i) => (
                      <div key={i} className="flex items-center gap-1.5 bg-cetiem-green/10 border border-cetiem-green/20 rounded-full px-3 py-1 text-xs text-cetiem-green">
                        <BookOpen className="h-3 w-3" />
                        {ref.page && <span className="font-medium">Pág. {ref.page}</span>}
                        {ref.page && ref.section && <span className="opacity-40">·</span>}
                        {ref.section && <span className="truncate max-w-[180px]">{ref.section}</span>}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {response.context && (
              <div className="bg-cetiem-card border border-white/5 rounded-2xl p-5">
                <h3 className="font-heading font-semibold text-white mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-cetiem-gray" /> Contexto del Documento
                </h3>
                <pre className="whitespace-pre-wrap text-xs text-cetiem-gray bg-white/5 p-4 rounded-xl max-h-72 overflow-y-auto">
                  {response.context}
                </pre>
              </div>
            )}
          </div>
        )}

        {!response && !loading && (
          <div className="bg-cetiem-card border border-dashed border-white/10 rounded-2xl p-12 text-center">
            <MessageSquare className="h-14 w-14 text-cetiem-gray/20 mx-auto mb-4" />
            <h3 className="font-heading font-semibold text-white mb-2">Haz una pregunta sobre este documento</h3>
            <p className="text-cetiem-gray text-sm">La IA analizará el contenido del documento para responderte con precisión</p>
          </div>
        )}
      </div>
    </div>
  );
}
