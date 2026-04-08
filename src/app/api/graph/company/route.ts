/**
 * GET /api/graph/company
 *
 * [NUEVO — Mejora 2] Retorna el grafo de conocimiento consolidado de la empresa autenticada.
 * Incluye TODAS las entidades y relaciones de todos sus documentos procesados,
 * permitiendo al Assessor ver la visión cross-documento de la empresa.
 *
 * Query params:
 *   - limit?: number (default 200, max 500)
 *   - merge?: "true" para ejecutar mergeSharedEntities antes de retornar
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { falkorDBService } from '@/lib/falkordb';
import { prisma } from '@/lib/db';

export async function GET(req: Request): Promise<NextResponse> {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const rawLimit = parseInt(searchParams.get('limit') || '200');
        const limit = Math.min(Math.max(1, rawLimit), 500);
        const shouldMerge = searchParams.get('merge') === 'true';

        // El companyId es el userId del propietario de los documentos
        // Para un Assessor, puede consultarse por empresa específica
        const role = (session.user as any).role;
        let companyId = session.user.id;

        // Si es Assessor o Admin, acepta un parámetro ?companyId=...
        if (role === 'ASSESSOR' || role === 'ADMIN') {
            const requestedCompanyId = searchParams.get('companyId');
            if (requestedCompanyId) {
                // Verificar que la empresa existe y está asignada a este assessor
                const company = await prisma.user.findFirst({
                    where: {
                        id: requestedCompanyId,
                        ...(role === 'ASSESSOR' ? { assessorId: session.user.id } : {}),
                    },
                    select: { id: true, companyName: true },
                });

                if (!company) {
                    return NextResponse.json({ error: 'Empresa no encontrada o sin acceso' }, { status: 403 });
                }
                companyId = requestedCompanyId;
            }
        }

        // Verificar conectividad FalkorDB
        const isHealthy = await falkorDBService.checkConnection();
        if (!isHealthy) {
            return NextResponse.json(
                { error: 'Servicio de grafo no disponible', entities: [], relations: [], documentCount: 0 },
                { status: 503 }
            );
        }

        // [Opcional] Generar relaciones SAME_AS antes de retornar
        let mergedCount = 0;
        if (shouldMerge) {
            mergedCount = await falkorDBService.mergeSharedEntities(companyId);
        }

        // Obtener grafo completo de la empresa
        const graph = await falkorDBService.getCompanyGraph(companyId, limit);

        // Metadatos adicionales: documentos de esta empresa
        const documents = await prisma.document.findMany({
            where: { userId: companyId, status: { in: ['ANALYZED', 'INDEXED'] } },
            select: { id: true, name: true, domain: true, status: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json({
            companyId,
            documentCount: graph.documentCount,
            entityCount: graph.entities.length,
            relationCount: graph.relations.length,
            mergedEntities: mergedCount,
            entities: graph.entities,
            relations: graph.relations,
            documents,
            meta: {
                limit,
                requestedMerge: shouldMerge,
                generatedAt: new Date().toISOString(),
            },
        });
    } catch (error: any) {
        console.error('[API /graph/company] Error:', error.message);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
