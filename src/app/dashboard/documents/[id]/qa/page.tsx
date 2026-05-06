"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
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

  // All hooks BEFORE any early return (Rules of Hooks)
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [stats, setStats] = useState<GraphStats | null>(null);
  const [showEntities, setShowEntities] = useState(false);
  const [showRelations, setShowRelations] = useState(false);

  useEffect(() => { if (role === "company") router.replace(`/dashboard/documents/${documentId}`); }, [role, router, documentId]);

  useEffect(() => {
    fetch(`/api/documents/${documentId}/search`)
      .then(r => r.ok ? r.json() : null)
      .then(data => data && setStats(data))
      .catch(console.error);
  }, [documentId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (role === "company") return null;

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
      <div className="flex items-center justify-between px-8 py-5 border-b border-border">
        <div>
          <h1 className="font-sans font-bold text-2xl text-foreground">Preguntar al Documento</h1>
          <p className="text-muted-foreground text-sm mt-0.5">IA + Grafo de Conocimiento</p>
        </div>
        <button onClick={() => window.history.back()} className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 border border-border rounded-lg">
          ← Volver
        </button>
      </div>

      <div className="flex-1 p-8 overflow-auto max-w-4xl">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: "Entidades", value: stats.entityCount, sub: "En el grafo", icon: Brain, color: "economia-info" },
              { label: "Relaciones", value: stats.relationCount, sub: "Conexiones", icon: Network, color: "economia-success" },
              { label: "Tipos", value: Object.keys(stats.entityTypes || {}).length, sub: "Categorías", icon: Sparkles, color: "economia-warning" },
            ].map(s => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">{s.label}</span>
                    <Icon className={`h-4 w-4 text-${s.color}`} />
                  </div>
                  <div className="text-2xl font-sans font-bold text-foreground">{s.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">{s.sub}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Search */}
        <div className="bg-card border border-border rounded-2xl p-5 mb-6">
          <h2 className="font-sans font-semibold text-foreground mb-1 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-economia-info" />
            Haz una pregunta sobre este documento
          </h2>
          <p className="text-muted-foreground text-xs mb-4">La IA analizará el contenido del documento para responderte con precisión</p>

          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ej: ¿Qué dice sobre liposarcomas?"
              className="flex-1 bg-muted border-border text-foreground placeholder:text-muted-foreground/40"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 bg-economia-info hover:bg-economia-info/90 text-primary-foreground text-sm font-medium px-4 rounded-xl transition-colors disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {loading ? "Buscando..." : "Preguntar"}
            </button>
          </form>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-xs text-muted-foreground self-center">Sugerencias:</span>
            {suggested.map((q, i) => (
              <button key={i} onClick={() => setQuestion(q)}
                className="text-xs border border-border hover:border-[#00D47A]/40 text-muted-foreground hover:text-foreground px-3 py-1 rounded-lg transition-colors">
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Response */}
        {response && (
          <div className="space-y-4">
            <div className="bg-economia-info/5 border border-economia-info/20 rounded-2xl p-5">
              <h3 className="font-sans font-semibold text-economia-info mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> Respuesta
              </h3>
              <div className="text-foreground text-sm">
                <MarkdownRenderer content={response.answer} />
              </div>
            </div>

            <div className="flex gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Brain className="h-3 w-3" />{response.stats.entityCount} entidades encontradas</span>
              <span className="flex items-center gap-1"><Network className="h-3 w-3" />{response.stats.relationCount} relaciones</span>
            </div>

            {response.entities.length > 0 && (
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <button
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-muted transition-colors"
                  onClick={() => setShowEntities(!showEntities)}
                >
                  <span className="font-sans font-semibold text-foreground flex items-center gap-2">
                    <Brain className="h-4 w-4 text-economia-info" /> Entidades Encontradas ({response.entities.length})
                  </span>
                  <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${showEntities ? "rotate-90" : ""}`} />
                </button>
                {showEntities && (
                  <div className="px-5 pb-5 space-y-2">
                    {response.entities.map(entity => (
                      <div key={entity.id} className="flex items-start gap-3 p-3 bg-muted rounded-xl">
                        <div className="h-7 w-7 bg-economia-info/10 rounded-lg flex items-center justify-center shrink-0">
                          <FileText className="h-3.5 w-3.5 text-economia-info" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-medium text-foreground text-sm">{entity.name}</span>
                            <span className="text-xs bg-economia-info/10 text-economia-info px-2 py-0.5 rounded">{entity.type}</span>
                          </div>
                          {entity.description && <p className="text-xs text-muted-foreground">{entity.description}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {response.relations.length > 0 && (
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <button
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-muted transition-colors"
                  onClick={() => setShowRelations(!showRelations)}
                >
                  <span className="font-sans font-semibold text-foreground flex items-center gap-2">
                    <Network className="h-4 w-4 text-economia-success" /> Relaciones ({response.relations.length})
                  </span>
                  <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${showRelations ? "rotate-90" : ""}`} />
                </button>
                {showRelations && (
                  <div className="px-5 pb-5 space-y-2">
                    {response.relations.map((rel, i) => (
                      <div key={i} className="flex items-center gap-2 p-3 bg-muted rounded-xl text-sm">
                        <span className="font-medium text-foreground">{rel.source}</span>
                        <span className="text-xs bg-economia-success/10 text-economia-success px-2 py-0.5 rounded">{rel.type}</span>
                        <span className="font-medium text-foreground">{rel.target}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {response.references && response.references.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="font-sans font-semibold text-foreground mb-3 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-[#00D47A]" /> Referencias en el Documento
                </h3>
                <div className="flex flex-wrap gap-2">
                  {response.references
                    .filter((r, i, arr) => arr.findIndex(x => `${x.page ?? ''}-${x.section ?? ''}` === `${r.page ?? ''}-${r.section ?? ''}`) === i)
                    .map((ref, i) => (
                      <div key={i} className="flex items-center gap-1.5 bg-[#00D47A]/10 border border-[#00D47A]/20 rounded-full px-3 py-1 text-xs text-[#00D47A]">
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
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="font-sans font-semibold text-foreground mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" /> Contexto del Documento
                </h3>
                <pre className="whitespace-pre-wrap text-xs text-muted-foreground bg-muted p-4 rounded-xl max-h-72 overflow-y-auto">
                  {response.context}
                </pre>
              </div>
            )}
          </div>
        )}

        {!response && !loading && (
          <div className="bg-card border border-dashed border-border rounded-2xl p-12 text-center">
            <MessageSquare className="h-14 w-14 text-muted-foreground/20 mx-auto mb-4" />
            <h3 className="font-sans font-semibold text-foreground mb-2">Haz una pregunta sobre este documento</h3>
            <p className="text-muted-foreground text-sm">La IA analizará el contenido del documento para responderte con precisión</p>
          </div>
        )}
      </div>
    </div>
  );
}
