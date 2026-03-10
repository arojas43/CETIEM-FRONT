"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    {
      name: "Todas las entidades",
      query: 'MATCH (n) RETURN labels(n)[0] AS tipo, n.name AS nombre LIMIT 50',
    },
    {
      name: "Todas las relaciones",
      query: 'MATCH (a)-[r]->(b) RETURN a.name AS origen, type(r) AS relacion, b.name AS destino LIMIT 50',
    },
    {
      name: "Organizaciones",
      query: 'MATCH (n:ORGANIZATION) RETURN n.name AS nombre',
    },
    {
      name: "Conceptos",
      query: 'MATCH (n:CONCEPT) RETURN n.name AS concepto',
    },
    {
      name: "Contar por tipo",
      query: 'MATCH (n) RETURN labels(n)[0] AS tipo, count(n) AS cantidad',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Database className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Consultar Grafo</h1>
              <p className="text-sm text-gray-500">FalkorDB + Cognee</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={loadStats}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Stats */}
        {stats && (
          <div className="grid md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Entidades
                </CardTitle>
                <Database className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">
                  {stats.totalEntities}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.entityTypes.map(t => `${t.type}: ${t.count}`).join(", ")}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Relaciones
                </CardTitle>
                <Link className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">
                  {stats.totalRelations}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.relationTypes.map(t => `${t.type}: ${t.count}`).join(", ")}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Query Editor */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Consulta Cypher
            </CardTitle>
            <CardDescription>
              Escribe una consulta Cypher para consultar el grafo de conocimiento
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Preset Queries */}
              <div className="flex flex-wrap gap-2">
                {presetQueries.map((preset, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    onClick={() => setQuery(preset.query)}
                  >
                    {preset.name}
                  </Button>
                ))}
              </div>

              {/* Query Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Consulta:</label>
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="MATCH (n) RETURN n"
                  className="font-mono"
                />
              </div>

              {/* Execute Button */}
              <Button onClick={executeQuery} disabled={loading}>
                <Search className="h-4 w-4 mr-2" />
                {loading ? "Ejecutando..." : "Ejecutar Consulta"}
              </Button>

              {/* Error */}
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  {error}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {results.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Resultados ({results.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      {headers.map((header, i) => (
                        <th key={i} className="text-left p-3 font-medium">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((row, i) => (
                      <tr key={i} className="border-b hover:bg-gray-50">
                        {headers.map((header, j) => (
                          <td key={j} className="p-3">
                            {String(row[header] || "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Help */}
        <Card className="mt-8 bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle>¿Cómo usar Cypher?</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-700 space-y-2">
            <p><strong className="text-blue-900">MATCH (n)</strong> - Seleccionar todos los nodos</p>
            <p><strong className="text-blue-900">MATCH (n:ORGANIZATION)</strong> - Seleccionar organizaciones</p>
            <p><strong className="text-blue-900">MATCH (a)-[r]-(b)</strong> - Seleccionar relaciones</p>
            <p><strong className="text-blue-900">RETURN n.name</strong> - Devolver el nombre</p>
            <p><strong className="text-blue-900">WHERE n.name = &quot;DriveApp&quot;</strong> - Filtrar por nombre</p>
            <p><strong className="text-blue-900">LIMIT 50</strong> - Limitar resultados</p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
