"use client";

import { Database, Search, RefreshCw, Link as LinkIcon, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRole } from "@/lib/role-context";

interface GraphStats {
  entityTypes: Array<{ type: string; count: number }>;
  relationTypes: Array<{ type: string; count: number }>;
  totalEntities: number;
  totalRelations: number;
}

export default function GraphQueryPage() {
  const router = useRouter();
  const { role } = useRole();

  const [query, setQuery] = useState(
    'MATCH (n) RETURN labels(n)[0] AS tipo, n.name AS nombre LIMIT 20'
  );
  const [results, setResults] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState<GraphStats | null>(null);
  const [falkorDisconnected, setFalkorDisconnected] = useState(false);

  // Solo assessors y admins pueden acceder al grafo global
  useEffect(() => {
    if (role && role === "company") router.replace("/dashboard");
  }, [role, router]);

  const loadStats = async () => {
    try {
      const response = await fetch("/api/graph/stats");
      if (response.ok) {
        const data = await response.json();
        setFalkorDisconnected(data.status === "disconnected" || data.connected === false);
        if (data.status === "connected") setStats(data);
      }
    } catch (err) {
      console.error("Error loading stats:", err);
      setFalkorDisconnected(true);
    }
  };

  useEffect(() => { loadStats(); }, []);

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
      <div className="flex items-center justify-between px-8 py-5 border-b border-border">
        <div>
          <h1 className="font-sans font-bold text-2xl text-foreground">Consultar Grafo</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Grafo de conocimiento global · Consulta Cypher</p>
        </div>
        <button
          onClick={loadStats}
          className="flex items-center gap-2 text-xs border border-border hover:border-economia-info/40 text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Actualizar Stats
        </button>
      </div>

      {falkorDisconnected && (
        <div className="mx-8 mt-4 flex items-center gap-2 px-4 py-3 bg-economia-error/10 border border-economia-error/20 rounded-xl text-economia-error text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>FalkorDB no disponible — el grafo de conocimiento está desconectado. Verifica que el contenedor esté corriendo.</span>
        </div>
      )}

      <div className="flex-1 p-8 overflow-auto">
        {/* Stats */}
        {stats && (
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Total Entidades</span>
                <Database className="h-4 w-4 text-economia-info" />
              </div>
              <div className="text-2xl font-sans font-bold text-foreground">{stats.totalEntities}</div>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {stats.entityTypes.map(t => `${t.type}: ${t.count}`).join(" · ")}
              </p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Total Relaciones</span>
                <LinkIcon className="h-4 w-4 text-economia-success" />
              </div>
              <div className="text-2xl font-sans font-bold text-foreground">{stats.totalRelations}</div>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {stats.relationTypes.map(t => `${t.type}: ${t.count}`).join(" · ")}
              </p>
            </div>
          </div>
        )}

        {/* Query Editor */}
        <div className="bg-card border border-border rounded-2xl p-5 mb-6">
          <h2 className="font-sans font-semibold text-foreground mb-1 flex items-center gap-2">
            <Search className="h-4 w-4 text-economia-info" />
            Consulta Cypher
          </h2>
          <p className="text-muted-foreground text-xs mb-4">Escribe una consulta Cypher para explorar el grafo de conocimiento</p>

          {/* Preset queries */}
          <div className="flex flex-wrap gap-2 mb-4">
            {presetQueries.map((preset, i) => (
              <button
                key={i}
                onClick={() => setQuery(preset.query)}
                className="text-xs border border-border hover:border-economia-info/40 text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg transition-colors"
              >
                {preset.name}
              </button>
            ))}
          </div>

          {/* Query input */}
          <div className="mb-4">
            <label className="text-xs text-muted-foreground mb-1.5 block">Consulta:</label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="MATCH (n) RETURN n"
              className="w-full h-10 px-3 border border-border rounded-xl text-sm font-mono bg-muted text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-economia-info/40"
            />
          </div>

          <button
            onClick={executeQuery}
            disabled={loading}
            className="flex items-center gap-2 bg-economia-info hover:bg-economia-info/90 text-primary-foreground text-sm font-medium px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
          >
            <Search className="h-4 w-4" />
            {loading ? "Ejecutando..." : "Ejecutar Consulta"}
          </button>

          {error && (
            <div className="mt-4 p-4 bg-economia-error/10 border border-economia-error/20 rounded-xl text-economia-error text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-5 mb-6">
            <h2 className="font-sans font-semibold text-foreground mb-4">Resultados ({results.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {headers.map((header, i) => (
                      <th key={i} className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((row, i) => (
                    <tr key={i} className="border-b border-border hover:bg-muted transition-colors">
                      {headers.map((header, j) => (
                        <td key={j} className="p-3 text-foreground font-mono text-xs">
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
        <div className="bg-economia-info/5 border border-economia-info/10 rounded-2xl p-5">
          <h3 className="font-sans font-semibold text-economia-info text-sm mb-3">¿Cómo usar Cypher?</h3>
          <div className="space-y-1.5 text-sm text-muted-foreground">
            {[
              ["MATCH (n)", "Seleccionar todos los nodos"],
              ["MATCH (n:ORGANIZATION)", "Seleccionar organizaciones"],
              ["MATCH (a)-[r]-(b)", "Seleccionar relaciones"],
              ["RETURN n.name", "Devolver el nombre del nodo"],
              ['WHERE n.name = "DriveApp"', "Filtrar por nombre"],
              ["LIMIT 50", "Limitar la cantidad de resultados"],
            ].map(([code, desc]) => (
              <p key={code}>
                <strong className="text-foreground font-mono text-xs">{code}</strong>
                <span className="text-muted-foreground/70"> — {desc}</span>
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
