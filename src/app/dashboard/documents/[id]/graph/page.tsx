"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Database, Network, RefreshCw, Link, Bug } from "lucide-react";

interface Entity {
  id: string;
  type: string;
  name: string;
  description?: string;
}

interface Relation {
  source: string;
  type: string;
  target: string;
  sourceId?: string;
  targetId?: string;
}

interface GraphStats {
  entityCount: number;
  relationCount: number;
  documentInGraph: boolean;
}

interface DebugInfo {
  allEntities: any[];
  documentEntities: any[];
  allRelations: any[];
  countByDocument: any[];
  entitiesWithoutDocId: any[];
  stats: {
    totalEntities: number;
    docEntities: number;
    totalRelations: number;
    documentsWithEntities: number;
    entitiesWithoutDocId: number;
  };
}

export default function DocumentGraphPage() {
  const params = useParams();
  const documentId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [relations, setRelations] = useState<Relation[]>([]);
  const [stats, setStats] = useState<GraphStats>({ entityCount: 0, relationCount: 0, documentInGraph: false });
  const [showDebug, setShowDebug] = useState(false);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);

  const loadGraphData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/documents/${documentId}/graph`);
      if (response.ok) {
        const data = await response.json();
        setEntities(data.entities || []);
        setRelations(data.relations || []);
        setStats(data.stats || { entityCount: 0, relationCount: 0, documentInGraph: false });
        console.log('[Graph Page] Datos cargados:', data);
      } else {
        console.error('[Graph Page] Error en respuesta:', response.status);
      }
    } catch (error) {
      console.error('Error loading graph:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDebugInfo = async () => {
    try {
      const response = await fetch(`/api/documents/${documentId}/graph/debug`);
      if (response.ok) {
        const data = await response.json();
        setDebugInfo(data.debug);
        setShowDebug(true);
      }
    } catch (error) {
      console.error('Error loading debug:', error);
    }
  };

  useEffect(() => {
    loadGraphData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  const groupEntitiesByType = () => {
    const groups: Record<string, Entity[]> = {};
    entities.forEach(entity => {
      const type = entity.type || 'OTHER';
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(entity);
    });
    return groups;
  };

  const entityGroups = groupEntitiesByType();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Network className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Grafo de Conocimiento</h1>
              <p className="text-sm text-gray-500">Cognee + FalkorDB</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadDebugInfo} disabled={loading}>
              <Bug className="h-4 w-4 mr-2" />
              Debug
            </Button>
            <Button variant="outline" size="sm" onClick={loadGraphData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Recargar
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Entidades</CardTitle>
              <Database className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{stats.entityCount}</div>
              <p className="text-xs text-gray-500 mt-1">Nodos en este documento</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Relaciones</CardTitle>
              <Link className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{stats.relationCount}</div>
              <p className="text-xs text-gray-500 mt-1">Conexiones entre entidades</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Tipos</CardTitle>
              <Database className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{Object.keys(entityGroups).length}</div>
              <p className="text-xs text-gray-500 mt-1">Tipos de entidades</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Estado</CardTitle>
              <Database className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {stats.documentInGraph ? '✓' : stats.entityCount > 0 ? '⚠' : '⏳'}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {stats.documentInGraph ? 'Grafo disponible' : 
                 stats.entityCount > 0 ? 'Datos sin ID' : 'Procesando...'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Debug Info */}
        {showDebug && debugInfo && (
          <Card className="mb-8 bg-yellow-50 border-yellow-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bug className="h-5 w-5 text-yellow-600" />
                Debug Information
              </CardTitle>
              <CardDescription>
                Información detallada del grafo en FalkorDB
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-5 gap-4 mb-4">
                <div className="text-center p-4 bg-white rounded-lg">
                  <p className="text-2xl font-bold text-purple-600">{debugInfo.stats.totalEntities}</p>
                  <p className="text-xs text-gray-500">Total Entidades</p>
                </div>
                <div className="text-center p-4 bg-white rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{debugInfo.stats.docEntities}</p>
                  <p className="text-xs text-gray-500">De este Documento</p>
                </div>
                <div className="text-center p-4 bg-white rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{debugInfo.stats.totalRelations}</p>
                  <p className="text-xs text-gray-500">Total Relaciones</p>
                </div>
                <div className="text-center p-4 bg-white rounded-lg">
                  <p className="text-2xl font-bold text-indigo-600">{debugInfo.stats.documentsWithEntities}</p>
                  <p className="text-xs text-gray-500">Documentos con Grafo</p>
                </div>
                <div className="text-center p-4 bg-white rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{debugInfo.stats.entitiesWithoutDocId}</p>
                  <p className="text-xs text-gray-500">Sin documentId</p>
                </div>
              </div>

              {debugInfo.countByDocument.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-medium mb-2">Entidades por Documento:</h4>
                  <div className="space-y-1">
                    {debugInfo.countByDocument.map((doc, i) => (
                      <div key={i} className="flex justify-between text-sm p-2 bg-white rounded">
                        <span className="font-mono text-xs truncate flex-1">{doc.docId}</span>
                        <span className="font-bold text-purple-600 ml-4">{doc.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {debugInfo.entitiesWithoutDocId.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 text-red-600">Entidades SIN documentId:</h4>
                  <div className="space-y-1">
                    {debugInfo.entitiesWithoutDocId.map((entity, i) => (
                      <div key={i} className="text-sm p-2 bg-white rounded">
                        <span className="font-mono text-xs">{entity.type}</span>
                        <span className="ml-2">{entity.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Entities List */}
        <Card>
          <CardHeader>
            <CardTitle>Entidades Extraídas</CardTitle>
            <CardDescription>
              Entidades identificadas por Cognee en el documento
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12 text-gray-500">
                <RefreshCw className="h-8 w-8 mx-auto mb-3 animate-spin" />
                <p>Cargando grafo de conocimiento...</p>
              </div>
            ) : entities.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Database className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No se encontraron entidades</p>
                <p className="text-sm mt-2">
                  El documento puede estar procesándose aún o no tener entidades extraíbles
                </p>
                <div className="mt-4 text-xs text-gray-400">
                  <p>Estado del documento: {stats.documentInGraph ? '✓ En grafo' : '⏳ Pendiente'}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(entityGroups).map(([type, typeEntities]) => (
                  <div key={type}>
                    <h3 className="text-sm font-medium text-gray-500 mb-3 uppercase tracking-wide">
                      {type} ({typeEntities.length})
                    </h3>
                    <div className="space-y-3">
                      {typeEntities.map((entity) => (
                        <div
                          key={entity.id}
                          className="flex items-start gap-3 p-4 border rounded-lg hover:bg-purple-50 transition-colors"
                        >
                          <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Database className="h-5 w-5 text-purple-600" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-gray-900">{entity.name}</span>
                              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                                {entity.type}
                              </span>
                            </div>
                            {entity.description && (
                              <p className="text-sm text-gray-600">{entity.description}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Relations */}
        {relations.length > 0 && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Relaciones</CardTitle>
              <CardDescription>
                Conexiones entre entidades extraídas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {relations.map((relation, i) => (
                  <div key={i} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium text-gray-900">{relation.source}</span>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                      {relation.type}
                    </span>
                    <span className="font-medium text-gray-900">{relation.target}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info */}
        <Card className="mt-8 bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-lg">¿Qué es Cognee?</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-700">
            <p className="mb-2">
              <strong>Cognee</strong> es un motor de conocimiento que transforma documentos en grafos de conocimiento persistentes.
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li key="1">Extrae entidades (empresas, normas, requisitos)</li>
              <li key="2">Identifica relaciones entre ellas</li>
              <li key="3">Guarda en FalkorDB para consultas complejas</li>
              <li key="4">Permite búsqueda semántica</li>
            </ul>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
