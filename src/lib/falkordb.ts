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
        if (testDb) { try { await testDb.close(); } catch { } }
        return true;
      }
      console.warn("[FalkorDB] Verificación falló:", error.message);
      if (testDb) {
        try { await testDb.close(); } catch { }
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

        await this.ensureIndexes().catch(() => { });
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
      try { await this.db.close(); } catch { }
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
    timeout: number = 30_000
  ): Promise<QueryResult> {
    const startTime = Date.now();

    if (!this.isConnected) {
      const connected = await this.connect();
      if (!connected) throw new Error("No se pudo conectar a FalkorDB.");
    }

    try {
      const opts: any = {};
      if (params) opts.params = params;
      opts.timeout = timeout;

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
    timeout: number = 30_000
  ): Promise<QueryResult> {
    const startTime = Date.now();

    if (!this.isConnected) {
      const connected = await this.connect();
      if (!connected) throw new Error("No se pudo conectar a FalkorDB.");
    }

    try {
      const opts: any = {};
      if (params) opts.params = params;
      opts.timeout = timeout;

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
   * [Mejora] También crea índices por companyId para el grafo global cross-documento
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
      // [Mejora] Índice adicional por companyId para grafo global
      try {
        await this.query(`CREATE INDEX FOR (n:${label}) ON (n.companyId)`);
      } catch {
        // "already indexed" es esperado — ignorar
      }
    }

    // Vector index HNSW (FalkorDB 4.0+) para búsqueda semántica por embeddings
    // Dimensión 768 coincide con NemoRetriever-300M; similarity cosine para textos ESG
    // Todos los labels de los 3 dominios (INDUSTRIA, CONSTRUCCION, TECNOLOGIA) + comunes
    const vectorLabels = [
      "ORGANIZATION", "REGULATION", "REQUIREMENT", "PROCESS", "CONCEPT", "ENTITY",
      "HAZARD", "INDICATOR",                      // INDUSTRIA
      "PROJECT", "MATERIAL", "WORKER",            // CONSTRUCCION
      "SYSTEM", "DATA", "RISK",                   // TECNOLOGIA
      "PERSON", "DOCUMENT", "PROCEDURE", "LOCATION", // Comunes
    ];
    for (const label of vectorLabels) {
      try {
        await this.query(
          `CREATE VECTOR INDEX FOR (n:${label}) ON (n.embedding) OPTIONS {dimension: 2048, similarityFunction: "cosine"}`
        );
      } catch {
        // "already indexed" esperado tras primera ejecución
      }
    }

    _indexesEnsured = true;
    console.log(
      `[FalkorDB] Índices listos (${created} nuevos por documentId + companyId, ${labels.length - created} existentes; vector HNSW habilitado)`
    );
  }

  /**
   * Almacena embeddings vectoriales en nodos ya creados usando MATCH + SET parametrizado.
   * Procesa en batches de 50 (una query por batch) para reducir round-trips a FalkorDB.
   * @param items Array de { id: entityId, embedding: float32 array de dimensión 768 }
   */
  async setEntityEmbeddings(items: Array<{ id: string; embedding: number[] }>): Promise<void> {
    if (items.length === 0) return;

    const BATCH_SIZE = 50;
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      try {
        // One query per batch: chain N MATCH+SET clauses with WITH 1 AS _ to reset scope.
        // Uses named params $id0..$idN and $emb0..$embN — avoids UNWIND limitation.
        const parts: string[] = [];
        const params: Record<string, any> = {};
        batch.forEach(({ id, embedding }, idx) => {
          parts.push(`MATCH (n${idx}) WHERE n${idx}.id = $id${idx} SET n${idx}.embedding = $emb${idx}`);
          params[`id${idx}`] = id;
          params[`emb${idx}`] = embedding;
        });
        const cypher = parts.join('\nWITH 1 AS _\n');
        await this.query(cypher, params, 30_000);
      } catch (err: any) {
        console.warn(`[FalkorDB] Batch embedding falló, reintentando individualmente:`, err.message);
        await Promise.allSettled(
          batch.map(({ id, embedding }) =>
            this.query(
              "MATCH (n) WHERE n.id = $id SET n.embedding = $emb",
              { id, emb: embedding },
              5_000
            ).catch((e: Error) => {
              console.warn(`[FalkorDB] No se pudo guardar embedding para ${id}:`, e.message);
            })
          )
        );
      }
    }
  }

  /**
   * Búsqueda semántica por vector (HNSW) para un label dado.
   * Requiere FalkorDB 4.0+ con vector index creado previamente.
   * Devuelve vacío si el índice no existe o FalkorDB es pre-4.0.
   */
  async vectorSearch(
    label: string,
    queryEmbedding: number[],
    limit: number = 10,
    documentId?: string,
    companyId?: string
  ): Promise<Array<{ type: string; name: string; description?: string; score: number }>> {
    // Validate label — FalkorDB procedure args don't resolve $params, must be literal
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(label)) return [];
    // LIMIT doesn't accept parameters in FalkorDB — use validated integer literal
    const safeK = Math.min(1000, Math.max(1, Math.floor(limit)));

    try {
      // Build WHERE clause: always filter by companyId when available (multi-tenant safety)
      const conditions: string[] = [];
      if (companyId) conditions.push("n.companyId = $cid");
      if (documentId) conditions.push("n.documentId = $docId");
      const filterClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")} ` : "";

      const params: Record<string, any> = { vec: queryEmbedding };
      if (companyId) params.cid = companyId;
      if (documentId) params.docId = documentId;

      const result = await this.roQuery(
        `CALL db.idx.vector.queryNodes('${label}', 'embedding', ${safeK}, vecf32($vec)) YIELD node AS n, score
         ${filterClause}RETURN labels(n)[0] AS type, n.name AS name, n.description AS description, score
         ORDER BY score DESC LIMIT ${safeK}`,
        params,
        10_000
      );
      return result.rows.map(r => ({
        type: r.type || label,
        name: r.name,
        description: r.description,
        score: r.score,
      }));
    } catch {
      // Vector index no disponible (FalkorDB < 4.0 o sin datos aún)
      return [];
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // [Mejora 2] GRAFO GLOBAL — Consultas cross-documento por empresa
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Retorna todas las entidades y relaciones de una empresa, agrupadas por documento.
   * Permite al Assessor ver la visión consolidada de conocimiento de una empresa.
   */
  async getCompanyGraph(companyId: string, limit: number = 200): Promise<{
    entities: Array<{ type: string; name: string; description?: string; documentId: string; page?: number }>;
    relations: Array<{ source: string; type: string; target: string; documentId: string }>;
    documentCount: number;
  }> {
    try {
      const [entitiesResult, relationsResult, docCountResult] = await Promise.all([
        this.roQuery(
          `MATCH (n)
           WHERE n.companyId = $cid
           RETURN labels(n)[0] AS type, n.name AS name, n.description AS description,
                  n.documentId AS documentId, n.page AS page
           ORDER BY n.documentId, labels(n)[0], n.name
           LIMIT $lim`,
          { cid: companyId, lim: limit }
        ),
        this.roQuery(
          `MATCH (a)-[r]->(b)
           WHERE a.companyId = $cid AND b.companyId = $cid
           RETURN a.name AS source, type(r) AS type, b.name AS target, a.documentId AS documentId
           LIMIT $lim`,
          { cid: companyId, lim: limit }
        ),
        this.roQuery(
          `MATCH (n) WHERE n.companyId = $cid
           RETURN count(DISTINCT n.documentId) AS count`,
          { cid: companyId }
        ),
      ]);

      return {
        entities: entitiesResult.rows.map(r => ({
          type: r.type,
          name: r.name,
          description: r.description,
          documentId: r.documentId,
          page: r.page,
        })),
        relations: relationsResult.rows.map(r => ({
          source: r.source,
          type: r.type,
          target: r.target,
          documentId: r.documentId,
        })),
        documentCount: docCountResult.rows[0]?.count || 0,
      };
    } catch (error: any) {
      console.error('[FalkorDB] Error obteniendo grafo de empresa:', error.message);
      return { entities: [], relations: [], documentCount: 0 };
    }
  }

  /**
   * Detecta entidades con el mismo nombre y tipo en diferentes documentos de una empresa
   * y crea relaciones SAME_AS entre ellas para el grafo global.
   * Llamar después de procesar un documento para mantener el grafo sincronizado.
   */
  async mergeSharedEntities(companyId: string): Promise<number> {
    try {
      // Buscar entidades duplicadas por nombre+tipo en distintos documentos de la misma empresa.
      // Filtramos por companyId PRIMERO para garantizar aislamiento multi-tenant.
      const duplicates = await this.roQuery(
        `MATCH (a)
         WHERE a.companyId = $cid
         WITH a.name AS name, labels(a)[0] AS type, collect(a) AS nodes
         WHERE size(nodes) > 1
         UNWIND nodes AS n
         RETURN n.id AS id, name, type, n.documentId AS documentId`,
        { cid: companyId }
      );

      if (duplicates.rows.length === 0) return 0;

      // Agrupar por name+type
      const groups = new Map<string, Array<{ id: string; documentId: string }>>();
      for (const row of duplicates.rows) {
        const key = `${row.type}::${row.name}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push({ id: row.id, documentId: row.documentId });
      }

      let linked = 0;
      for (const [, nodes] of groups) {
        // Crear relación SAME_AS entre el primer nodo y todos los demás
        const pivot = nodes[0];
        for (let i = 1; i < nodes.length; i++) {
          const other = nodes[i];
          if (pivot.documentId === other.documentId) continue; // mismo doc — ignorar
          try {
            await this.query(
              `MATCH (a {id: $aId}), (b {id: $bId})
               WHERE NOT (a)-[:SAME_AS]->(b)
               CREATE (a)-[:SAME_AS {companyId: $cid, autoLinked: true}]->(b)`,
              { aId: pivot.id, bId: other.id, cid: companyId }
            );
            linked++;
          } catch {
            // Relación ya existe o entidad no encontrada — ignorar
          }
        }
      }

      console.log(`[FalkorDB] mergeSharedEntities: ${linked} relaciones SAME_AS creadas para empresa ${companyId}`);
      return linked;
    } catch (error: any) {
      console.error('[FalkorDB] Error en mergeSharedEntities:', error.message);
      return 0;
    }
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
      try {
        this.validateCypherIdentifier(label, "createEntitiesBatch:label");
      } catch (err: any) {
        console.error(`[FalkorDB] Skipping batch with invalid label: ${err.message}`);
        continue;
      }

      for (let i = 0; i < propsList.length; i += MAX_PER_QUERY) {
        const batch = propsList.slice(i, i + MAX_PER_QUERY);
        const keys = Array.from(new Set(batch.flatMap(p => Object.keys(p))));

        // Validate all property keys against allow-list
        const invalidKey = keys.find(k => !/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(k));
        if (invalidKey) {
          console.error(`[FalkorDB] Skipping batch: invalid property key "${invalidKey}"`);
          continue;
        }

        // Serializar inline (FalkorDB no soporta params de tipo lista de maps en UNWIND)
        // Usar JSON.stringify para strings — produce literales Cypher válidos
        let propsArray: string[];
        try {
          propsArray = batch.map(p => {
            const entries = Object.entries(p).map(([k, v]) =>
              `${k}: ${typeof v === "string" ? this.safeInlineString(v) : JSON.stringify(v)}`
            );
            return `{${entries.join(", ")}}`;
          });
        } catch (err: any) {
          console.error(`[FalkorDB] Skipping batch: prohibited string value: ${err.message}`);
          continue;
        }

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
    this.validateCypherIdentifier(label, "createEntity:label");

    const filtered: Record<string, any> = {};
    for (const [key, value] of Object.entries(properties)) {
      if (value !== undefined && value !== null) {
        this.validateCypherIdentifier(key, `createEntity:key(${key})`);
        filtered[key] = value;
      }
    }

    try {
      await this.query(`CREATE (n:${label}) SET n = $props`, { props: filtered });
      return true;
    } catch (error: any) {
      console.error("[FalkorDB] Error creando entidad:", error.message);
      return false;
    }
  }

  /**
   * Crea una relación entre dos entidades (buscadas por id).
   * Usa parámetros $src / $tgt para evitar inyección Cypher.
   */
  async createRelation(
    sourceId: string,
    targetId: string,
    relationType: string,
    properties?: Record<string, any>
  ): Promise<boolean> {
    const sanitizedType = this.sanitizeRelationType(relationType);

    // Properties as inline literal — keys are trusted (sanitized by caller),
    // values serialised with JSON.stringify to avoid injection.
    const propsString = properties && Object.keys(properties).length > 0
      ? " {" + Object.entries(properties)
          .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
          .join(", ") + "}"
      : "";

    // IDs go through $src / $tgt parameters — never string-interpolated.
    const cypher =
      `MATCH (a {id: $src}), (b {id: $tgt}) ` +
      `CREATE (a)-[r:${sanitizedType}${propsString}]->(b)`;

    try {
      await this.query(cypher, { src: sourceId, tgt: targetId });
      return true;
    } catch (err: any) {
      console.warn(`[FalkorDB] createRelation ${sanitizedType} (${sourceId}→${targetId}):`, err.message);
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
    const params: Record<string, string> = {};

    if (options.name) {
      conditions.push("n.name CONTAINS $name");
      params.name = options.name;
    }
    if (options.type) {
      conditions.push("labels(n)[0] = $type");
      params.type = options.type;
    }
    if (options.documentId) {
      conditions.push("n.documentId = $docId");
      params.docId = options.documentId;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    // LIMIT doesn't accept parameters in FalkorDB — validate as safe integer before interpolating
    const limit = Math.min(1000, Math.max(1, Math.floor(options.limit ?? 100)));

    try {
      const result = await this.query(`MATCH (n) ${whereClause} RETURN n LIMIT ${limit}`, params);
      return result.rows.map(r => r.n || {});
    } catch (error: any) {
      console.error("[FalkorDB] Error buscando entidades:", error.message);
      return [];
    }
  }

  // Allow-list for Cypher identifiers (labels and property keys).
  // Throws if the value could be used to inject Cypher.
  private validateCypherIdentifier(s: string, ctx: string): void {
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(s)) {
      throw new Error(`[FalkorDB] Invalid Cypher identifier in ${ctx}: "${s}"`);
    }
  }

  // Safe string for inline Cypher: use JSON.stringify (same escapes as Cypher)
  // and reject null bytes and backticks which JSON.stringify won't handle.
  private safeInlineString(value: string): string {
    if (value.includes('\x00') || value.includes('`')) {
      throw new Error('[FalkorDB] String contains prohibited characters (null byte or backtick)');
    }
    return JSON.stringify(value); // e.g. "hello \"world\"\n" → valid Cypher string literal
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
