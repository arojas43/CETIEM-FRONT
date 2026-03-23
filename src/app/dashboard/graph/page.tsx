"use client";

import { useState } from "react";
import { Database, Search, RefreshCw, Link } from "lucide-react";

interface GraphStats {
  entityTypes: Array<{ type: string; count: number }>;
  relationTypes: Array<{ type: string; count: number }>;
  totalEntities: number;
  totalRelations: number;
}

export default function GraphQueryPage() {
  const [query, setQuery] = useState(
    'MATCH (n) RETURN labels(n)[0] AS tipo, n.name AS nombre LIMIT 20'
  );
  const [results, setResults] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState<GraphStats | null>(null);

  const loadStats = async () => {
    try {
      const response = await fetch("/api/graph/stats");
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Error loading stats:", err);
    }
  };

  const executeQuery = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/graph/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (response.ok) {
        const data = await response.json();
        setResults(data.results);
        setHeaders(data.headers || []);
      } else {
        const error = await response.json();
        setError(error.error || "Error ejecutando consulta");
      }
    } catch (err: any) {
      setError(err.message || "Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const presetQueries = [
    { name: "Todas las entidades", query: 'MATCH (n) RETURN labels(n)[0] AS tipo, n.name AS nombre LIMIT 50' },
    { name: "Todas las relaciones", query: 'MATCH (a)-[r]->(b) RETURN a.name AS origen, type(r) AS relacion, b.name AS destino LIMIT 50' },
    { name: "Organizaciones", query: 'MATCH (n:ORGANIZATION) RETURN n.name AS nombre' },
    { name: "Conceptos", query: 'MATCH (n:CONCEPT) RETURN n.name AS concepto' },
    { name: "Contar por tipo", query: 'MATCH (n) RETURN labels(n)[0] AS tipo, count(n) AS cantidad' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/5">
        <div>
          <h1 className="font-heading font-bold text-2xl text-white">Consultar Grafo</h1>
          <p className="text-cetiem-gray text-sm mt-0.5">FalkorDB + Cognee · Cypher Query</p>
        </div>
        <button
          onClick={loadStats}
          className="flex items-center gap-2 text-xs border border-white/10 hover:border-cetiem-teal/40 text-cetiem-gray hover:text-white px-3 py-1.5 rounded-lg transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Actualizar Stats
        </button>
      </div>

      <div className="flex-1 p-8 overflow-auto">
        {/* Stats */}
        {stats && (
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div className="bg-cetiem-card border border-white/5 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-cetiem-gray">Total Entidades</span>
                <Database className="h-4 w-4 text-cetiem-teal" />
              </div>
              <div className="text-2xl font-heading font-bold text-white">{stats.totalEntities}</div>
              <p className="text-xs text-cetiem-gray mt-1 truncate">
                {stats.entityTypes.map(t => `${t.type}: ${t.count}`).join(" · ")}
              </p>
            </div>
            <div className="bg-cetiem-card border border-white/5 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-cetiem-gray">Total Relaciones</span>
                <Link className="h-4 w-4 text-cetiem-lime" />
              </div>
              <div className="text-2xl font-heading font-bold text-white">{stats.totalRelations}</div>
              <p className="text-xs text-cetiem-gray mt-1 truncate">
                {stats.relationTypes.map(t => `${t.type}: ${t.count}`).join(" · ")}
              </p>
            </div>
          </div>
        )}

        {/* Query Editor */}
        <div className="bg-cetiem-card border border-white/5 rounded-2xl p-5 mb-6">
          <h2 className="font-heading font-semibold text-white mb-1 flex items-center gap-2">
            <Search className="h-4 w-4 text-cetiem-teal" />
            Consulta Cypher
          </h2>
          <p className="text-cetiem-gray text-xs mb-4">Escribe una consulta Cypher para explorar el grafo de conocimiento</p>

          {/* Preset queries */}
          <div className="flex flex-wrap gap-2 mb-4">
            {presetQueries.map((preset, i) => (
              <button
                key={i}
                onClick={() => setQuery(preset.query)}
                className="text-xs border border-white/10 hover:border-cetiem-teal/40 text-cetiem-gray hover:text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                {preset.name}
              </button>
            ))}
          </div>

          {/* Query input */}
          <div className="mb-4">
            <label className="text-xs text-cetiem-gray mb-1.5 block">Consulta:</label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="MATCH (n) RETURN n"
              className="w-full h-10 px-3 border border-white/10 rounded-xl text-sm font-mono bg-white/5 text-white placeholder:text-cetiem-gray/40 focus:outline-none focus:border-cetiem-teal/40"
            />
          </div>

          <button
            onClick={executeQuery}
            disabled={loading}
            className="flex items-center gap-2 bg-cetiem-teal hover:bg-cetiem-teal/90 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
          >
            <Search className="h-4 w-4" />
            {loading ? "Ejecutando..." : "Ejecutar Consulta"}
          </button>

          {error && (
            <div className="mt-4 p-4 bg-cetiem-red/10 border border-cetiem-red/20 rounded-xl text-cetiem-red text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="bg-cetiem-card border border-white/5 rounded-2xl p-5 mb-6">
            <h2 className="font-heading font-semibold text-white mb-4">Resultados ({results.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    {headers.map((header, i) => (
                      <th key={i} className="text-left p-3 text-xs font-medium text-cetiem-gray uppercase tracking-wider">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((row, i) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      {headers.map((header, j) => (
                        <td key={j} className="p-3 text-white font-mono text-xs">
                          {String(row[header] || "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Help */}
        <div className="bg-cetiem-teal/5 border border-cetiem-teal/10 rounded-2xl p-5">
          <h3 className="font-heading font-semibold text-cetiem-teal text-sm mb-3">¿Cómo usar Cypher?</h3>
          <div className="space-y-1.5 text-sm text-cetiem-gray">
            {[
              ["MATCH (n)", "Seleccionar todos los nodos"],
              ["MATCH (n:ORGANIZATION)", "Seleccionar organizaciones"],
              ["MATCH (a)-[r]-(b)", "Seleccionar relaciones"],
              ["RETURN n.name", "Devolver el nombre del nodo"],
              ['WHERE n.name = "DriveApp"', "Filtrar por nombre"],
              ["LIMIT 50", "Limitar la cantidad de resultados"],
            ].map(([code, desc]) => (
              <p key={code}>
                <strong className="text-white font-mono text-xs">{code}</strong>
                <span className="text-cetiem-gray/70"> — {desc}</span>
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
