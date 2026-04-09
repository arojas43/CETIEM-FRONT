"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Database, Network, RefreshCw, Link, Bug } from "lucide-react";
import { useRole } from "@/lib/role-context";

interface Entity { id: string; type: string; name: string; description?: string }
interface Relation { source: string; type: string; target: string; sourceId?: string; targetId?: string }
interface GraphStats { entityCount: number; relationCount: number; documentInGraph: boolean }
interface DebugInfo {
  allEntities: any[]; documentEntities: any[]; allRelations: any[]; countByDocument: any[]; entitiesWithoutDocId: any[];
  stats: { totalEntities: number; docEntities: number; totalRelations: number; documentsWithEntities: number; entitiesWithoutDocId: number };
}

export default function DocumentGraphPage() {
  const params = useParams();
  const documentId = params.id as string;
  const { role } = useRole();
  const router = useRouter();
  useEffect(() => { if (role === "company") router.replace(`/dashboard/documents/${documentId}`); }, [role, router, documentId]);
  if (role === "company") return null;

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
      }
    } catch (error) { console.error('Error loading graph:', error); }
    finally { setLoading(false); }
  };

  const loadDebugInfo = async () => {
    try {
      const response = await fetch(`/api/documents/${documentId}/graph/debug`);
      if (response.ok) {
        const data = await response.json();
        setDebugInfo(data.debug);
        setShowDebug(true);
      }
    } catch (error) { console.error('Error loading debug:', error); }
  };

  useEffect(() => { loadGraphData(); }, [documentId]);

  const entityGroups = entities.reduce<Record<string, Entity[]>>((acc, e) => {
    const t = e.type || 'OTHER';
    acc[t] = acc[t] || [];
    acc[t].push(e);
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/5">
        <div>
          <h1 className="font-heading font-bold text-2xl text-white">Grafo de Conocimiento</h1>
          <p className="text-cetiem-gray text-sm mt-0.5">Entidades y relaciones extraídas por IA</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadDebugInfo} disabled={loading}
            className="flex items-center gap-2 text-xs border border-white/10 hover:border-cetiem-amber/40 text-cetiem-gray hover:text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
            <Bug className="h-3.5 w-3.5" /> Debug
          </button>
          <button onClick={loadGraphData} disabled={loading}
            className="flex items-center gap-2 text-xs border border-white/10 hover:border-cetiem-green/40 text-cetiem-gray hover:text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Recargar
          </button>
        </div>
      </div>

      <div className="flex-1 p-8 overflow-auto">
        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Entidades", value: stats.entityCount, sub: "Nodos en este documento", icon: Database, color: "cetiem-teal" },
            { label: "Relaciones", value: stats.relationCount, sub: "Conexiones entre entidades", icon: Link, color: "cetiem-green" },
            { label: "Tipos", value: Object.keys(entityGroups).length, sub: "Tipos de entidades", icon: Database, color: "cetiem-lime" },
            { label: "Estado", value: stats.documentInGraph ? '✓' : stats.entityCount > 0 ? '⚠' : '⏳', sub: stats.documentInGraph ? 'Grafo disponible' : stats.entityCount > 0 ? 'Datos sin ID' : 'Procesando...', icon: Database, color: "cetiem-gray" },
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

        {/* Debug */}
        {showDebug && debugInfo && (
          <div className="bg-cetiem-amber/5 border border-cetiem-amber/20 rounded-2xl p-5 mb-6">
            <h3 className="font-heading font-semibold text-cetiem-amber mb-4 flex items-center gap-2">
              <Bug className="h-4 w-4" /> Debug Information
            </h3>
            <div className="grid md:grid-cols-5 gap-3 mb-4">
              {[
                { v: debugInfo.stats.totalEntities, l: "Total Entidades", c: "cetiem-teal" },
                { v: debugInfo.stats.docEntities, l: "De este Documento", c: "cetiem-lime" },
                { v: debugInfo.stats.totalRelations, l: "Total Relaciones", c: "cetiem-green" },
                { v: debugInfo.stats.documentsWithEntities, l: "Docs con Grafo", c: "cetiem-teal" },
                { v: debugInfo.stats.entitiesWithoutDocId, l: "Sin documentId", c: "cetiem-red" },
              ].map(item => (
                <div key={item.l} className="text-center p-3 bg-white/5 rounded-xl">
                  <p className={`text-2xl font-bold text-${item.c}`}>{item.v}</p>
                  <p className="text-xs text-cetiem-gray mt-1">{item.l}</p>
                </div>
              ))}
            </div>

            {debugInfo.countByDocument.length > 0 && (
              <div className="space-y-1">
                <h4 className="text-xs font-medium text-cetiem-gray mb-2">Entidades por Documento:</h4>
                {debugInfo.countByDocument.map((doc, i) => (
                  <div key={i} className="flex justify-between text-xs p-2 bg-white/5 rounded-lg">
                    <span className="font-mono text-cetiem-gray truncate flex-1">{doc.docId}</span>
                    <span className="font-bold text-cetiem-teal ml-4">{doc.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Entities */}
        <div className="bg-cetiem-card border border-white/5 rounded-2xl p-5 mb-4">
          <h2 className="font-heading font-semibold text-white mb-1">Entidades Extraídas</h2>
          <p className="text-cetiem-gray text-xs mb-4">Entidades identificadas por IA en el documento</p>

          {loading ? (
            <div className="text-center py-12">
              <RefreshCw className="h-7 w-7 mx-auto mb-3 animate-spin text-cetiem-gray" />
              <p className="text-cetiem-gray text-sm">Cargando grafo de conocimiento...</p>
            </div>
          ) : entities.length === 0 ? (
            <div className="text-center py-12">
              <Database className="h-10 w-10 mx-auto mb-3 text-cetiem-gray/20" />
              <p className="font-medium text-white mb-1">No se encontraron entidades</p>
              <p className="text-sm text-cetiem-gray">El documento puede estar procesándose aún</p>
            </div>
          ) : (
            <div className="space-y-5">
              {Object.entries(entityGroups).map(([type, typeEntities]) => (
                <div key={type}>
                  <h3 className="text-xs font-medium text-cetiem-gray uppercase tracking-widest mb-2">
                    {type} ({typeEntities.length})
                  </h3>
                  <div className="space-y-2">
                    {typeEntities.map(entity => (
                      <div key={entity.id} className="flex items-start gap-3 p-3 bg-white/5 rounded-xl hover:bg-white/[0.07] transition-colors">
                        <div className="h-8 w-8 bg-cetiem-teal/10 rounded-lg flex items-center justify-center shrink-0">
                          <Database className="h-4 w-4 text-cetiem-teal" />
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
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Relations */}
        {relations.length > 0 && (
          <div className="bg-cetiem-card border border-white/5 rounded-2xl p-5 mb-4">
            <h2 className="font-heading font-semibold text-white mb-1">Relaciones</h2>
            <p className="text-cetiem-gray text-xs mb-4">Conexiones entre entidades extraídas</p>
            <div className="space-y-2">
              {relations.map((rel, i) => (
                <div key={i} className="flex items-center gap-2 p-3 bg-white/5 rounded-xl text-sm">
                  <span className="font-medium text-white">{rel.source}</span>
                  <span className="text-xs bg-cetiem-green/10 text-cetiem-green px-2 py-0.5 rounded">{rel.type}</span>
                  <span className="font-medium text-white">{rel.target}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info */}
        <div className="bg-cetiem-teal/5 border border-cetiem-teal/10 rounded-2xl p-5">
          <h3 className="font-heading font-semibold text-cetiem-teal text-sm mb-3">¿Qué es el Grafo de Conocimiento?</h3>
          <p className="text-cetiem-gray text-sm mb-2">
            El motor de IA transforma cada documento en un grafo de conocimiento estructurado y persistente.
          </p>
          <ul className="space-y-1 text-sm text-cetiem-gray">
            {["Extrae entidades clave (empresas, normas, requisitos)", "Identifica y mapea relaciones entre ellas", "Permite búsqueda semántica avanzada sobre el contenido", "Enriquece el análisis del Assessor ESG"].map(item => (
              <li key={item} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 bg-cetiem-teal rounded-full shrink-0" />{item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
