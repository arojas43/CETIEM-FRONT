/**
 * Servicio mejorado para FalkorDB con manejo robusto de errores
 * y verificación de conexión
 */

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const Redis = require("ioredis");

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

export class FalkorDBService {
  private config: FalkorDBConfig;
  private client: any = null;
  private isConnected: boolean = false;
  private connectionPromise: Promise<boolean> | null = null;
  private lastConnectionAttempt: number = 0;
  private connectionCooldown: number = 5000; // 5 segundos entre intentos

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
    
    // Si ya está conectado, retornar verdadero
    if (this.isConnected && this.client) {
      try {
        await this.client.ping();
        return true;
      } catch {
        this.isConnected = false;
        this.client = null;
      }
    }

    // Respetar cooldown entre intentos
    if (now - this.lastConnectionAttempt < this.connectionCooldown) {
      return false;
    }

    this.lastConnectionAttempt = now;

    let client;
    try {
      client = new Redis({
        host: this.config.host,
        port: this.config.port,
        lazyConnect: true,
        connectionTimeout: this.config.connectionTimeout,
        maxRetriesPerRequest: 1,
        retryStrategy: (times: number) => {
          if (times > 2) return null;
          return Math.min(times * 100, 500);
        },
      });

      await client.connect();
      await client.ping();
      
      // Verificar que FalkorDB responde comandos GRAPH
      await client.call('GRAPH.QUERY', this.config.graphName, 'RETURN 1');
      
      await client.quit();
      return true;
    } catch (error: any) {
      console.warn('[FalkorDB] Verificación falló:', error.message);
      if (client) {
        try { await client.quit(); } catch {}
      }
      return false;
    }
  }

  /**
   * Conecta a FalkorDB con reintentos
   */
  async connect(): Promise<boolean> {
    if (this.isConnected && this.client) {
      return true;
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

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

        this.client = new Redis({
          host: this.config.host,
          port: this.config.port,
          lazyConnect: true,
          connectionTimeout: this.config.connectionTimeout,
          maxRetriesPerRequest: 3,
          retryStrategy: (times: number) => {
            if (times > 3) return null;
            return Math.min(times * 200, 2000);
          },
        });

        await this.client.connect();
        await this.client.ping();

        // Verificar que FalkorDB responde
        await this.client.call('GRAPH.QUERY', this.config.graphName, 'RETURN "connected" AS status');

        this.isConnected = true;
        console.log(`✅ [FalkorDB] Conectado exitosamente en ${this.config.host}:${this.config.port}`);
        // Await ensureIndexes antes de liberar la conexión.
        // Si corre en background, los GRAPH.RO_QUERY que llegan inmediatamente
        // después se bloquean esperando el lock exclusivo de CREATE INDEX → timeout.
        await this.ensureIndexes().catch(() => {});
        return true;
      } catch (error: any) {
        console.warn(`[FalkorDB] Intento ${attempt} fallido:`, error.message);
        
        if (this.client) {
          try { await this.client.quit(); } catch {}
          this.client = null;
        }

        if (attempt === maxRetries) {
          console.error('❌ [FalkorDB] Todos los intentos de conexión fallaron');
          this.isConnected = false;
          return false;
        }

        // Esperar antes del siguiente intento
        await new Promise(resolve => setTimeout(resolve, attempt * 500));
      }
    }

    return false;
  }

  /**
   * Desconecta de FalkorDB
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
      } catch (error) {
        console.warn('[FalkorDB] Error al desconectar:', error);
      } finally {
        this.client = null;
        this.isConnected = false;
      }
    }
  }

  /**
   * Ejecuta una consulta Cypher con manejo de errores
   */
  async query(cypher: string, timeout?: number): Promise<QueryResult> {
    const startTime = Date.now();

    if (!this.isConnected) {
      const connected = await this.connect();
      if (!connected) {
        throw new Error('No se pudo conectar a FalkorDB. Verifica que el servicio esté corriendo.');
      }
    }

    try {
      const result = await Promise.race([
        this.client.call('GRAPH.QUERY', this.config.graphName, cypher),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout en consulta')), timeout || 30000)
        ),
      ]);

      if (!result || !result[0] || !result[1]) {
        return { headers: [], rows: [], count: 0 };
      }

      const headers = result[0];
      const rows = result[1].map((row: any[]) => {
        const obj: Record<string, any> = {};
        headers.forEach((header: string, i: number) => {
          obj[header] = row[i];
        });
        return obj;
      });

      return {
        headers,
        rows,
        count: rows.length,
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      // "already indexed" es esperado en ensureIndexes() — no loggear
      if (!error.message?.includes('already indexed')) {
        console.error('[FalkorDB] Error en consulta:', error.message);
        console.error('[FalkorDB] Cypher:', cypher);
      }

      if (error.message.includes('ECONNREFUSED') || error.message.includes('closed')) {
        this.isConnected = false;
      }

      throw new Error(`Error consultando FalkorDB: ${error.message}`);
    }
  }

  /**
   * Ejecuta una consulta Cypher de solo lectura (GRAPH.RO_QUERY)
   * Permite ejecución paralela a diferencia de GRAPH.QUERY que bloquea escrituras
   */
  async roQuery(cypher: string, timeout?: number): Promise<QueryResult> {
    const startTime = Date.now();

    if (!this.isConnected) {
      const connected = await this.connect();
      if (!connected) {
        throw new Error('No se pudo conectar a FalkorDB. Verifica que el servicio esté corriendo.');
      }
    }

    try {
      const result = await Promise.race([
        this.client.call('GRAPH.RO_QUERY', this.config.graphName, cypher),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout en consulta')), timeout || 30000)
        ),
      ]);

      if (!result || !result[0] || !result[1]) {
        return { headers: [], rows: [], count: 0 };
      }

      const headers = result[0];
      const rows = result[1].map((row: any[]) => {
        const obj: Record<string, any> = {};
        headers.forEach((header: string, i: number) => {
          obj[header] = row[i];
        });
        return obj;
      });

      return {
        headers,
        rows,
        count: rows.length,
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      // Si GRAPH.RO_QUERY no está disponible (versión antigua), usar GRAPH.QUERY
      if (error.message?.includes('unknown command') || error.message?.includes('ERR')) {
        return this.query(cypher, timeout);
      }
      console.error('[FalkorDB] Error en roQuery:', error.message);
      if (error.message.includes('ECONNREFUSED') || error.message.includes('closed')) {
        this.isConnected = false;
      }
      throw new Error(`Error consultando FalkorDB: ${error.message}`);
    }
  }

  /**
   * Crea índices en FalkorDB para mejorar el rendimiento de consultas por documentId.
   * Primero consulta los índices existentes para evitar errores "already indexed"
   * que saturan el log en cada reconexión.
   */
  async ensureIndexes(): Promise<void> {
    if (_indexesEnsured) return;

    const labels = [
      // Comunes a todos los dominios
      'ORGANIZATION', 'REGULATION', 'REQUIREMENT', 'PERSON', 'DATE',
      'DOCUMENT', 'PROCEDURE', 'LOCATION', 'CONCEPT', 'ENTITY',
      // Dominio: INDUSTRIA (ISO 9001/14001/45001, SST)
      'HAZARD', 'INDICATOR', 'PROCESS',
      // Dominio: CONSTRUCCION (NOM-031, obra civil)
      'PROJECT', 'MATERIAL', 'WORKER',
      // Dominio: TECNOLOGIA (LGPDPPSO, ISO 27001)
      'SYSTEM', 'DATA', 'RISK',
      // Legacy / otros (pueden aparecer en documentos procesados antes)
      'EQUIPMENT', 'FINDING', 'AUTHOR', 'TECHNOLOGY',
    ];

    // Intentar crear cada índice. Si ya existe FalkorDB devuelve "already indexed",
    // que query() ya no loggea — es un error esperado e inofensivo.
    let created = 0;
    for (const label of labels) {
      try {
        await this.query(`CREATE INDEX FOR (n:${label}) ON (n.documentId)`);
        created++;
      } catch {
        // Índice ya existe o label sin nodos — ignorar
      }
    }

    _indexesEnsured = true;
    console.log(`[FalkorDB] Índices listos (${created} nuevos, ${labels.length - created} existentes)`);
  }

  /**
   * Crea múltiples entidades en bloque usando UNWIND.
   * Agrupa por label y lanza una sola query por tipo — órdenes de magnitud más rápido
   * que una CREATE por entidad para documentos grandes.
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

        // Recolectar todas las claves únicas del batch
        const keys = Array.from(new Set(batch.flatMap(p => Object.keys(p))));

        // Serializar lista de maps inline
        const propsArray = batch.map(p => {
          const entries = Object.entries(p).map(([k, v]) =>
            `${k}: ${typeof v === 'string' ? `"${this.escapeCypherString(v)}"` : JSON.stringify(v)}`
          );
          return `{${entries.join(', ')}}`;
        });

        // Mapeo explícito de propiedades en CREATE para que FalkorDB lea de props.*
        const propMapping = keys.map(k => `${k}: props.${k}`).join(', ');
        const cypher = `UNWIND [${propsArray.join(', ')}] AS props CREATE (n:${label} {${propMapping}})`;

        try {
          await this.query(cypher);
          created += batch.length;
        } catch (error: any) {
          console.error(`[FalkorDB] Error en createEntitiesBatch ${label}:`, error.message);
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
      return {
        connected: false,
        entityCount: 0,
        relationCount: 0,
        entityTypes: [],
        relationTypes: [],
        documentsInGraph: 0,
      };
    }

    try {
      // Conectar si es necesario
      if (!this.isConnected) {
        await this.connect();
      }

      // Contar entidades por tipo (read-only para no bloquear escrituras)
      const entityTypesResult = await this.roQuery(
        'MATCH (n) RETURN labels(n)[0] AS type, count(n) AS count ORDER BY count DESC'
      );

      // Contar relaciones por tipo
      const relationTypesResult = await this.roQuery(
        'MATCH ()-[r]->() RETURN type(r) AS type, count(r) AS count ORDER BY count DESC'
      );

      // Contar documentos en el grafo
      const docsResult = await this.roQuery(
        'MATCH (n) WHERE n.documentId IS NOT NULL RETURN count(DISTINCT n.documentId) AS count'
      );

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
      console.error('[FalkorDB] Error obteniendo estadísticas:', error.message);
      return {
        connected: false,
        entityCount: 0,
        relationCount: 0,
        entityTypes: [],
        relationTypes: [],
        documentsInGraph: 0,
      };
    }
  }

  /**
   * Crea una entidad en el grafo
   */
  async createEntity(label: string, properties: Record<string, any>): Promise<boolean> {
    // Filtrar propiedades undefined o null
    const filteredProperties: Record<string, any> = {};
    for (const [key, value] of Object.entries(properties)) {
      if (value !== undefined && value !== null) {
        filteredProperties[key] = value;
      }
    }

    const propsString = Object.entries(filteredProperties)
      .map(([key, value]) => {
        if (typeof value === 'string') {
          return `${key}: "${this.escapeQuotes(value)}"`;
        }
        return `${key}: ${JSON.stringify(value)}`;
      })
      .join(', ');

    const cypher = `CREATE (n:${label} {${propsString}})`;

    try {
      await this.query(cypher);
      return true;
    } catch (error: any) {
      console.error('[FalkorDB] Error creando entidad:', error.message);
      return false;
    }
  }

  /**
   * Crea una relación entre dos entidades
   * IMPORTANTE: Sanitiza el tipo de relación para FalkorDB (solo ASCII)
   */
  async createRelation(
    sourceId: string,
    targetId: string,
    relationType: string,
    properties?: Record<string, any>
  ): Promise<boolean> {
    // Sanitizar tipo de relación: eliminar caracteres especiales (ñ, ó, í, etc.)
    const sanitizedRelationType = this.sanitizeRelationType(relationType);
    
    const propsString = properties
      ? ' {' + Object.entries(properties)
          .map(([key, value]) => {
            if (typeof value === 'string') {
              return `${key}: "${this.escapeQuotes(value)}"`;
            }
            return `${key}: ${JSON.stringify(value)}`;
          })
          .join(', ') + '}'
      : '';

    const cypher = `MATCH (a {id: "${sourceId}"}), (b {id: "${targetId}"}) CREATE (a)-[r:${sanitizedRelationType}${propsString}]->(b)`;

    try {
      await this.query(cypher);
      return true;
    } catch (error: any) {
      // La relación puede fallar si los nodos no existen, no es crítico
      return false;
    }
  }

  /**
   * Sanitiza el tipo de relación para FalkorDB
   * Elimina caracteres especiales y los reemplaza por equivalentes ASCII
   */
  private sanitizeRelationType(type: string): string {
    return type
      .replace(/Á/g, 'A').replace(/É/g, 'E').replace(/Í/g, 'I').replace(/Ó/g, 'O').replace(/Ú/g, 'U')
      .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i').replace(/ó/g, 'o').replace(/ú/g, 'u')
      .replace(/Ñ/g, 'N').replace(/ñ/g, 'n')
      .replace(/Ü/g, 'U').replace(/ü/g, 'u')
      .replace(/[^A-Z0-9_]/g, '_'); // Reemplazar cualquier otro carácter especial por _
  }

  /**
   * Elimina entidades por documentId
   */
  async deleteEntitiesByDocumentId(documentId: string): Promise<number> {
    try {
      // Contar antes de borrar (DETACH DELETE no devuelve filas via ioredis)
      const countResult = await this.roQuery(
        `MATCH (n {documentId: "${documentId}"}) RETURN count(n) AS count`
      );
      const count = countResult.rows[0]?.count as number || 0;

      if (count > 0) {
        await this.query(`MATCH (n {documentId: "${documentId}"}) DETACH DELETE n`);
      }
      return count;
    } catch (error: any) {
      console.error('[FalkorDB] Error eliminando entidades:', error.message);
      return 0;
    }
  }

  /**
   * Busca entidades por nombre o tipo
   */
  async searchEntities(options: {
    name?: string;
    type?: string;
    documentId?: string;
    limit?: number;
  }): Promise<Record<string, any>[]> {
    const conditions: string[] = [];
    
    if (options.name) {
      conditions.push(`n.name CONTAINS "${this.escapeQuotes(options.name)}"`);
    }
    
    if (options.type) {
      conditions.push(`labels(n)[0] = "${this.escapeQuotes(options.type)}"`);
    }
    
    if (options.documentId) {
      conditions.push(`n.documentId = "${this.escapeQuotes(options.documentId)}"`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = options.limit || 100;
    const cypher = `MATCH (n) ${whereClause} RETURN n LIMIT ${limit}`;

    try {
      const result = await this.query(cypher);
      return result.rows.map(r => r.n || {});
    } catch (error: any) {
      console.error('[FalkorDB] Error buscando entidades:', error.message);
      return [];
    }
  }

  private escapeCypherString(str: string): string {
    return str
      .replace(/\\/g, '\\\\') // Backslashes primero
      .replace(/"/g, '\\"')   // Comillas dobles
      .replace(/\n/g, '\\n')  // Saltos de línea
      .replace(/\r/g, '\\r'); // Retorno de carro
  }

  // Alias para compatibilidad interna
  private escapeQuotes(str: string): string {
    return this.escapeCypherString(str);
  }

  /**
   * Verifica si hay una conexión activa
   */
  isHealthy(): boolean {
    return this.isConnected && this.client !== null;
  }
}

// Flag para evitar re-ejecutar ensureIndexes en cada reconexión
let _indexesEnsured = false;

// Instancia singleton para usar en toda la aplicación
export const falkorDBService = new FalkorDBService();

// Función de utilidad para verificar conexión rápida
export async function checkFalkorDBHealth(): Promise<boolean> {
  return falkorDBService.checkConnection();
}
