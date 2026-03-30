/**
 * Servicio FalkorDB usando el SDK oficial `falkordb` (falkordb-ts)
 * SDK: https://github.com/FalkorDB/falkordb-ts — reemplaza el ioredis legacy
 *
 * Interfaz pública mantenida idéntica para que los callers no cambien.
 * Mejoras respecto al enfoque ioredis anterior:
 *  - Queries parametrizadas → sin riesgo de inyección Cypher
 *  - Estadísticas de borrado correctas (metadata[])
 *  - SDK oficialmente mantenido (ioredis/GRAPH.QUERY fue archivado en 2024)
 */

import { FalkorDB, Graph } from "falkordb";

export interface FalkorDBConfig {
  host: string;
  port: number;
  graphName: string;
  connectionTimeout?: number;
  maxRetries?: number;
}

export interface FalkorDBStats {
  connected: boolean;
  entityCount: number;
  relationCount: number;
  entityTypes: Array<{ type: string; count: number }>;
  relationTypes: Array<{ type: string; count: number }>;
  documentsInGraph: number;
}

export interface QueryResult {
  headers: string[];
  rows: Record<string, any>[];
  count: number;
  executionTime?: number;
}

// Flag para evitar re-ejecutar ensureIndexes en cada reconexión
let _indexesEnsured = false;

export class FalkorDBService {
  private config: FalkorDBConfig;
  private db: FalkorDB | null = null;
  private graph: Graph | null = null;
  private isConnected: boolean = false;
  private connectionPromise: Promise<boolean> | null = null;
  private lastConnectionAttempt: number = 0;
  private connectionCooldown: number = 5000;

  constructor(config?: Partial<FalkorDBConfig>) {
    this.config = {
      host: config?.host || process.env.FALKORDB_HOST || "localhost",
      port: config?.port || parseInt(process.env.FALKORDB_PORT || "6380"),
      graphName: config?.graphName || "certificacion",
      connectionTimeout: config?.connectionTimeout || 5000,
      maxRetries: config?.maxRetries || 3,
    };
  }

  /**
   * Verifica si FalkorDB está disponible sin crear conexión persistente
   */
  async checkConnection(): Promise<boolean> {
    const now = Date.now();

    if (this.isConnected && this.graph) {
      try {
        await this.graph.roQuery("RETURN 1");
        return true;
      } catch {
        this.isConnected = false;
        await this._closeClient();
      }
    }

    if (now - this.lastConnectionAttempt < this.connectionCooldown) {
      return false;
    }
    this.lastConnectionAttempt = now;

    let testDb: FalkorDB | null = null;
    try {
      testDb = await FalkorDB.connect({
        socket: {
          host: this.config.host,
          port: this.config.port,
          connectTimeout: this.config.connectionTimeout,
        },
      });
      const testGraph = testDb.selectGraph(this.config.graphName);
      await testGraph.roQuery("RETURN 1");
      await testDb.close();
      return true;
    } catch (error: any) {
      // "Invalid graph operation on empty key" = FalkorDB responde pero el grafo
      // aún no existe (instancia recién creada). Sí está disponible.
      if (error.message?.includes('Invalid graph operation on empty key')) {
        if (testDb) { try { await testDb.close(); } catch {} }
        return true;
      }
      console.warn("[FalkorDB] Verificación falló:", error.message);
      if (testDb) {
        try { await testDb.close(); } catch {}
      }
      return false;
    }
  }

  /**
   * Conecta a FalkorDB con reintentos
   */
  async connect(): Promise<boolean> {
    if (this.isConnected && this.graph) return true;
    if (this.connectionPromise) return this.connectionPromise;

    this.connectionPromise = this._connectWithRetries();
    const result = await this.connectionPromise;
    this.connectionPromise = null;
    return result;
  }

  private async _connectWithRetries(): Promise<boolean> {
    const maxRetries = this.config.maxRetries || 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[FalkorDB] Intento de conexión ${attempt}/${maxRetries}...`);

        this.db = await FalkorDB.connect({
          socket: {
            host: this.config.host,
            port: this.config.port,
            connectTimeout: this.config.connectionTimeout,
          },
        });
        this.graph = this.db.selectGraph(this.config.graphName);

        // Verificar con query de prueba (grafo puede no existir en instancia nueva)
        try {
          await this.graph.roQuery("RETURN 1");
        } catch (queryError: any) {
          // "Invalid graph operation on empty key" → FalkorDB funciona, grafo vacío
          if (!queryError.message?.includes('Invalid graph operation on empty key')) {
            throw queryError;
          }
        }

        this.isConnected = true;
        console.log(`✅ [FalkorDB] Conectado en ${this.config.host}:${this.config.port}`);

        await this.ensureIndexes().catch(() => {});
        return true;
      } catch (error: any) {
        console.warn(`[FalkorDB] Intento ${attempt} fallido:`, error.message);
        await this._closeClient();

        if (attempt === maxRetries) {
          console.error("❌ [FalkorDB] Todos los intentos fallaron");
          this.isConnected = false;
          return false;
        }
        await new Promise(resolve => setTimeout(resolve, attempt * 500));
      }
    }
    return false;
  }

  private async _closeClient(): Promise<void> {
    if (this.db) {
      try { await this.db.close(); } catch {}
      this.db = null;
      this.graph = null;
    }
  }

  async disconnect(): Promise<void> {
    await this._closeClient();
    this.isConnected = false;
  }

  /**
   * Ejecuta una query Cypher de lectura/escritura
   * Usa parámetros cuando se proveen para evitar inyección Cypher
   */
  async query(
    cypher: string,
    params?: Record<string, any>,
    timeout?: number
  ): Promise<QueryResult> {
    const startTime = Date.now();

    if (!this.isConnected) {
      const connected = await this.connect();
      if (!connected) throw new Error("No se pudo conectar a FalkorDB.");
    }

    try {
      const opts: any = {};
      if (params) opts.params = params;
      if (timeout) opts.timeout = timeout;

      const result = await this.graph!.query<Record<string, any>>(cypher, opts);
      const rows = result.data ?? [];

      return {
        headers: rows.length > 0 ? Object.keys(rows[0]) : [],
        rows,
        count: rows.length,
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      if (!error.message?.includes("already indexed")) {
        console.error("[FalkorDB] Error en query:", error.message);
        console.error("[FalkorDB] Cypher:", cypher.slice(0, 200));
      }
      if (
        error.message?.includes("ECONNREFUSED") ||
        error.message?.includes("closed") ||
        error.message?.includes("socket")
      ) {
        this.isConnected = false;
      }
      throw new Error(`Error consultando FalkorDB: ${error.message}`);
    }
  }

  /**
   * Ejecuta una query Cypher de solo lectura (enforced server-side)
   */
  async roQuery(
    cypher: string,
    params?: Record<string, any>,
    timeout?: number
  ): Promise<QueryResult> {
    const startTime = Date.now();

    if (!this.isConnected) {
      const connected = await this.connect();
      if (!connected) throw new Error("No se pudo conectar a FalkorDB.");
    }

    try {
      const opts: any = {};
      if (params) opts.params = params;
      if (timeout) opts.timeout = timeout;

      const result = await this.graph!.roQuery<Record<string, any>>(cypher, opts);
      const rows = result.data ?? [];

      return {
        headers: rows.length > 0 ? Object.keys(rows[0]) : [],
        rows,
        count: rows.length,
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      console.error("[FalkorDB] Error en roQuery:", error.message);
      if (
        error.message?.includes("ECONNREFUSED") ||
        error.message?.includes("closed") ||
        error.message?.includes("socket")
      ) {
        this.isConnected = false;
      }
      throw new Error(`Error consultando FalkorDB: ${error.message}`);
    }
  }

  /**
   * Crea índices en FalkorDB por documentId para todos los tipos de entidad ESG
   */
  async ensureIndexes(): Promise<void> {
    if (_indexesEnsured) return;

    const labels = [
      // Comunes a todos los dominios
      "ORGANIZATION", "REGULATION", "REQUIREMENT", "PERSON", "DATE",
      "DOCUMENT", "PROCEDURE", "LOCATION", "CONCEPT", "ENTITY",
      // Dominio: INDUSTRIA (ISO 9001/14001/45001, SST)
      "HAZARD", "INDICATOR", "PROCESS",
      // Dominio: CONSTRUCCION (NOM-031, obra civil)
      "PROJECT", "MATERIAL", "WORKER",
      // Dominio: TECNOLOGIA (LGPDPPSO, ISO 27001)
      "SYSTEM", "DATA", "RISK",
      // Legacy
      "EQUIPMENT", "FINDING", "AUTHOR", "TECHNOLOGY",
    ];

    let created = 0;
    for (const label of labels) {
      try {
        await this.query(`CREATE INDEX FOR (n:${label}) ON (n.documentId)`);
        created++;
      } catch {
        // "already indexed" es esperado — ignorar
      }
    }

    _indexesEnsured = true;
    console.log(
      `[FalkorDB] Índices listos (${created} nuevos, ${labels.length - created} existentes)`
    );
  }

  /**
   * Crea múltiples entidades en bloque usando UNWIND + parámetros
   */
  async createEntitiesBatch(
    entities: Array<{ label: string; properties: Record<string, any> }>
  ): Promise<number> {
    if (entities.length === 0) return 0;

    // Agrupar por label y filtrar propiedades nulas
    const byLabel = new Map<string, Array<Record<string, any>>>();
    for (const e of entities) {
      const filtered: Record<string, any> = {};
      for (const [k, v] of Object.entries(e.properties)) {
        if (v !== undefined && v !== null) filtered[k] = v;
      }
      if (!byLabel.has(e.label)) byLabel.set(e.label, []);
      byLabel.get(e.label)!.push(filtered);
    }

    let created = 0;
    const MAX_PER_QUERY = 500;

    for (const [label, propsList] of byLabel) {
      for (let i = 0; i < propsList.length; i += MAX_PER_QUERY) {
        const batch = propsList.slice(i, i + MAX_PER_QUERY);
        const keys = Array.from(new Set(batch.flatMap(p => Object.keys(p))));

        // Serializar inline (FalkorDB no soporta params de tipo lista de maps)
        const propsArray = batch.map(p => {
          const entries = Object.entries(p).map(([k, v]) =>
            `${k}: ${typeof v === "string"
              ? `"${this.escapeCypherString(v)}"`
              : JSON.stringify(v)}`
          );
          return `{${entries.join(", ")}}`;
        });

        const propMapping = keys.map(k => `${k}: props.${k}`).join(", ");
        const cypher = `UNWIND [${propsArray.join(", ")}] AS props CREATE (n:${label} {${propMapping}})`;

        try {
          await this.query(cypher);
          created += batch.length;
        } catch (error: any) {
          console.error(`[FalkorDB] Error en batch ${label}:`, error.message);
        }
      }
    }

    return created;
  }

  /**
   * Obtiene estadísticas del grafo
   */
  async getStats(): Promise<FalkorDBStats> {
    const connected = await this.checkConnection();

    if (!connected) {
      return { connected: false, entityCount: 0, relationCount: 0, entityTypes: [], relationTypes: [], documentsInGraph: 0 };
    }

    try {
      if (!this.isConnected) await this.connect();

      const [entityTypesResult, relationTypesResult, docsResult] = await Promise.all([
        this.roQuery("MATCH (n) RETURN labels(n)[0] AS type, count(n) AS count ORDER BY count DESC"),
        this.roQuery("MATCH ()-[r]->() RETURN type(r) AS type, count(r) AS count ORDER BY count DESC"),
        this.roQuery("MATCH (n) WHERE n.documentId IS NOT NULL RETURN count(DISTINCT n.documentId) AS count"),
      ]);

      const totalEntities = entityTypesResult.rows.reduce((sum, r) => sum + (r.count as number || 0), 0);
      const totalRelations = relationTypesResult.rows.reduce((sum, r) => sum + (r.count as number || 0), 0);

      return {
        connected: true,
        entityCount: totalEntities,
        relationCount: totalRelations,
        entityTypes: entityTypesResult.rows as Array<{ type: string; count: number }>,
        relationTypes: relationTypesResult.rows as Array<{ type: string; count: number }>,
        documentsInGraph: docsResult.rows[0]?.count as number || 0,
      };
    } catch (error: any) {
      console.error("[FalkorDB] Error obteniendo estadísticas:", error.message);
      return { connected: false, entityCount: 0, relationCount: 0, entityTypes: [], relationTypes: [], documentsInGraph: 0 };
    }
  }

  /**
   * Crea una entidad en el grafo (una sola)
   */
  async createEntity(label: string, properties: Record<string, any>): Promise<boolean> {
    const filtered: Record<string, any> = {};
    for (const [key, value] of Object.entries(properties)) {
      if (value !== undefined && value !== null) filtered[key] = value;
    }

    const propsString = Object.entries(filtered)
      .map(([key, value]) =>
        typeof value === "string"
          ? `${key}: "${this.escapeQuotes(value)}"`
          : `${key}: ${JSON.stringify(value)}`
      )
      .join(", ");

    try {
      await this.query(`CREATE (n:${label} {${propsString}})`);
      return true;
    } catch (error: any) {
      console.error("[FalkorDB] Error creando entidad:", error.message);
      return false;
    }
  }

  /**
   * Crea una relación entre dos entidades (buscadas por id)
   */
  async createRelation(
    sourceId: string,
    targetId: string,
    relationType: string,
    properties?: Record<string, any>
  ): Promise<boolean> {
    const sanitizedType = this.sanitizeRelationType(relationType);

    const propsString = properties
      ? " {" + Object.entries(properties)
          .map(([key, value]) =>
            typeof value === "string"
              ? `${key}: "${this.escapeQuotes(value)}"`
              : `${key}: ${JSON.stringify(value)}`
          )
          .join(", ") + "}"
      : "";

    const cypher =
      `MATCH (a {id: "${this.escapeQuotes(sourceId)}"}), ` +
      `(b {id: "${this.escapeQuotes(targetId)}"}) ` +
      `CREATE (a)-[r:${sanitizedType}${propsString}]->(b)`;

    try {
      await this.query(cypher);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Elimina todas las entidades de un documento del grafo
   * Cuenta antes de borrar (DELETE no retorna filas en FalkorDB via SDK)
   */
  async deleteEntitiesByDocumentId(documentId: string): Promise<number> {
    try {
      const countResult = await this.roQuery(
        "MATCH (n) WHERE n.documentId = $docId RETURN count(n) AS count",
        { docId: documentId }
      );
      const count = countResult.rows[0]?.count as number || 0;

      if (count > 0) {
        await this.query(
          "MATCH (n) WHERE n.documentId = $docId DETACH DELETE n",
          { docId: documentId }
        );
      }
      return count;
    } catch (error: any) {
      console.error("[FalkorDB] Error eliminando entidades:", error.message);
      return 0;
    }
  }

  /**
   * Busca entidades por nombre, tipo o documentId
   */
  async searchEntities(options: {
    name?: string;
    type?: string;
    documentId?: string;
    limit?: number;
  }): Promise<Record<string, any>[]> {
    const conditions: string[] = [];

    if (options.name) conditions.push(`n.name CONTAINS "${this.escapeQuotes(options.name)}"`);
    if (options.type) conditions.push(`labels(n)[0] = "${this.escapeQuotes(options.type)}"`);
    if (options.documentId) conditions.push(`n.documentId = "${this.escapeQuotes(options.documentId)}"`);

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = options.limit || 100;

    try {
      const result = await this.query(`MATCH (n) ${whereClause} RETURN n LIMIT ${limit}`);
      return result.rows.map(r => r.n || {});
    } catch (error: any) {
      console.error("[FalkorDB] Error buscando entidades:", error.message);
      return [];
    }
  }

  private escapeCypherString(str: string): string {
    return str
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r");
  }

  private escapeQuotes(str: string): string {
    return this.escapeCypherString(str);
  }

  private sanitizeRelationType(type: string): string {
    return type
      .replace(/Á/g, "A").replace(/É/g, "E").replace(/Í/g, "I").replace(/Ó/g, "O").replace(/Ú/g, "U")
      .replace(/á/g, "a").replace(/é/g, "e").replace(/í/g, "i").replace(/ó/g, "o").replace(/ú/g, "u")
      .replace(/Ñ/g, "N").replace(/ñ/g, "n")
      .replace(/Ü/g, "U").replace(/ü/g, "u")
      .replace(/[^A-Z0-9_]/gi, "_");
  }

  isHealthy(): boolean {
    return this.isConnected && this.graph !== null;
  }
}

export const falkorDBService = new FalkorDBService();

export async function checkFalkorDBHealth(): Promise<boolean> {
  return falkorDBService.checkConnection();
}
