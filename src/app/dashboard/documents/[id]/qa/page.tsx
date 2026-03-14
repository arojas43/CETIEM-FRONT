"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Send, Brain, Network, FileText, ChevronRight, Sparkles, BookOpen } from "lucide-react";
import { MarkdownRenderer } from "@/components/markdown-renderer";

interface Entity {
  id: string;
  type: string;
  name: string;
  description?: string;
}

interface Relation {
  id: string;
  source: string;
  target: string;
  type: string;
}

interface Reference {
  page?: number;
  section?: string;
  title?: string;
}

interface SearchResponse {
  answer: string;
  entities: Entity[];
  relations: Relation[];
  context: string;
  references: Reference[];
  stats: {
    entityCount: number;
    relationCount: number;
    contextPages?: number[];
  };
}

interface GraphStats {
  entityCount: number;
  relationCount: number;
  entityTypes: Record<string, number>;
}

export default function DocumentQAPage() {
  const params = useParams();
  const documentId = params.id as string;

  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [stats, setStats] = useState<GraphStats | null>(null);
  const [showEntities, setShowEntities] = useState(false);
  const [showRelations, setShowRelations] = useState(false);

  // Cargar estadísticas del grafo (GET /api/documents/[id]/search)
  useEffect(() => {
    const loadStats = async () => {
      try {
        const res = await fetch(`/api/documents/${documentId}/search`);
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (error) {
        console.error("Error loading stats:", error);
      }
    };

    loadStats();
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
        body: JSON.stringify({
          query: question,
          includeRelations: true,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setResponse(data);
      } else {
        const error = await res.json();
        setResponse({
          answer: `Error: ${error.error}`,
          entities: [],
          relations: [],
          context: "",
          references: [],
          stats: { entityCount: 0, relationCount: 0 },
        });
      }
    } catch (error: any) {
      setResponse({
        answer: `Error de conexión: ${error.message}`,
        entities: [],
        relations: [],
        context: "",
        references: [],
        stats: { entityCount: 0, relationCount: 0 },
      });
    } finally {
      setLoading(false);
    }
  };

  const suggestedQuestions = [
    "¿Cuáles son los temas principales de este documento?",
    "¿Qué dice la página 1?",
    "¿Qué requisitos o condiciones se mencionan?",
    "Resume el contenido de la sección 1",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Preguntar al Documento</h1>
              <p className="text-sm text-gray-500">IA + Grafo de Conocimiento</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => window.history.back()}>
            ← Volver
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Entidades</CardTitle>
                <Brain className="h-4 w-4 text-indigo-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">{stats.entityCount}</div>
                <p className="text-xs text-gray-500 mt-1">En el grafo</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Relaciones</CardTitle>
                <Network className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">{stats.relationCount}</div>
                <p className="text-xs text-gray-500 mt-1">Conexiones</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Tipos</CardTitle>
                <Sparkles className="h-4 w-4 text-pink-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">
                  {Object.keys(stats.entityTypes || {}).length}
                </div>
                <p className="text-xs text-gray-500 mt-1">Categorías</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search Box */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-indigo-600" />
              Haz una pregunta sobre este documento
            </CardTitle>
            <CardDescription>
              La IA buscará en el grafo de conocimiento y el contenido extraído
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ej: ¿Qué dice sobre liposarcomas?"
                className="flex-1"
                disabled={loading}
              />
              <Button type="submit" disabled={loading}>
                <Send className="h-4 w-4 mr-2" />
                {loading ? "Buscando..." : "Preguntar"}
              </Button>
            </form>

            {/* Preguntas sugeridas */}
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="text-sm text-gray-500">Sugerencias:</span>
              {suggestedQuestions.map((q, i) => (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  onClick={() => setQuestion(q)}
                  className="text-xs"
                >
                  {q}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Response */}
        {response && (
          <div className="space-y-6">
            {/* Answer */}
            <Card className="border-indigo-200 bg-indigo-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-indigo-900">
                  <Sparkles className="h-5 w-5" />
                  Respuesta
                </CardTitle>
              </CardHeader>
              <CardContent>
                <MarkdownRenderer content={response.answer} />
              </CardContent>
            </Card>

            {/* Stats de la búsqueda */}
            <div className="flex gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <Brain className="h-4 w-4" />
                {response.stats.entityCount} entidades encontradas
              </span>
              <span className="flex items-center gap-1">
                <Network className="h-4 w-4" />
                {response.stats.relationCount} relaciones
              </span>
            </div>

            {/* Entities */}
            {response.entities.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="h-5 w-5 text-indigo-600" />
                      Entidades Encontradas
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowEntities(!showEntities)}
                    >
                      <ChevronRight
                        className={`h-4 w-4 transition-transform ${showEntities ? "rotate-90" : ""}`}
                      />
                    </Button>
                  </div>
                </CardHeader>
                {showEntities && (
                  <CardContent>
                    <div className="space-y-2">
                      {response.entities.map((entity) => (
                        <div
                          key={entity.id}
                          className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="h-8 w-8 bg-indigo-100 rounded flex items-center justify-center flex-shrink-0">
                            <FileText className="h-4 w-4 text-indigo-600" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">{entity.name}</span>
                              <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">
                                {entity.type}
                              </span>
                            </div>
                            {entity.description && (
                              <p className="text-sm text-gray-600 mt-1">{entity.description}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            )}

            {/* Relations */}
            {response.relations.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Network className="h-5 w-5 text-purple-600" />
                      Relaciones
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowRelations(!showRelations)}
                    >
                      <ChevronRight
                        className={`h-4 w-4 transition-transform ${showRelations ? "rotate-90" : ""}`}
                      />
                    </Button>
                  </div>
                </CardHeader>
                {showRelations && (
                  <CardContent>
                    <div className="space-y-2">
                      {response.relations.map((relation, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg text-sm"
                        >
                          <span className="font-medium text-gray-900">{relation.source}</span>
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                            {relation.type}
                          </span>
                          <span className="font-medium text-gray-900">{relation.target}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            )}

            {/* Referencias de página/sección */}
            {response.references && response.references.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-blue-600" />
                    Referencias en el Documento
                  </CardTitle>
                  <CardDescription>Páginas y secciones consultadas para esta respuesta</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {response.references
                      .filter((r, i, arr) => {
                        // Deduplicar por página+sección
                        const key = `${r.page ?? ''}-${r.section ?? ''}`;
                        return arr.findIndex(x => `${x.page ?? ''}-${x.section ?? ''}` === key) === i;
                      })
                      .map((ref, i) => (
                        <div key={i} className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-full px-3 py-1 text-sm text-blue-800">
                          <BookOpen className="h-3 w-3" />
                          {ref.page && <span className="font-medium">Pág. {ref.page}</span>}
                          {ref.page && ref.section && <span className="text-blue-400">·</span>}
                          {ref.section && <span className="truncate max-w-[180px]">{ref.section}</span>}
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Context */}
            {response.context && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-green-600" />
                    Contexto del Documento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
                    {response.context}
                  </pre>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Empty State */}
        {!response && !loading && (
          <Card className="border-dashed">
            <CardContent className="text-center py-12">
              <MessageSquare className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Haz una pregunta sobre este documento
              </h3>
              <p className="text-gray-500">
                La IA buscará en el grafo de conocimiento y el contenido extraído para responderte
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
